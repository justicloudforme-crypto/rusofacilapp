import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVATION_POLL_MS,
  ACTIVATION_TIMEOUT_MS,
  activationState,
  beginPurchase,
  endPurchase,
  purchaseScreenOpen,
  registerPurchaseScreen,
  resetActivationForTests,
  startActivationWatch,
  subscribeActivation,
  type ActivationDeps,
  type ActivationState,
} from "./access-activation";

/**
 * ДОЛГ 304: ОЖИДАНИЕ ДОСТУПА ОБЯЗАНО ПЕРЕЖИТЬ ЗАКРЫТИЕ ШТОРКИ.
 *
 * Дефект, который эти примеры запирают, воспроизведён прогоном
 * 24.09.2026 (Chromium, настоящий мост Capacitor, подставной магазин,
 * вебхук через 6 секунд): шторку закрыли на надписи «Activando…» — и на
 * странице уровня A1 осталось 32 знака платного, в том числе через 15
 * секунд после того, как сервер доступ открыл.
 *
 * Причина была в том, ГДЕ жил цикл ожидания, а не в том, что он делал.
 * Поэтому и примеры здесь — про место: подписчик, который «ушёл»
 * (отписался, как отписывается размонтированный экран покупки), не
 * должен мешать остальным узнать о выдаче доступа.
 */

/** Стенд времени и сервера. Аргументы поддельных функций НАЗВАНЫ явно:
 *  `vi.fn(async () => …)` выводит вызов беспараметрическим, и прочитать
 *  аргументы потом нечем (ловушка 7.228, пункт 3). */
function bench(tiers: (string | null)[]): { deps: ActivationDeps; slept: number[] } {
  let clock = 0;
  const slept: number[] = [];
  let index = 0;
  return {
    slept,
    deps: {
      readTier: vi.fn(async (): Promise<string | null> => tiers[Math.min(index++, tiers.length - 1)]),
      sleep: vi.fn(async (ms: number): Promise<void> => {
        slept.push(ms);
        clock += ms;
      }),
      now: () => clock,
    },
  };
}

afterEach(() => {
  resetActivationForTests();
});

describe("ожидание доступа живёт вне компонента", () => {
  it("подписчик, который ушёл, НЕ мешает остальным узнать о выдаче доступа", async () => {
    const seenByLeaver: ActivationState[] = [];
    const seenByStayer: ActivationState[] = [];
    const unsubscribeLeaver = subscribeActivation((s) => seenByLeaver.push(s));
    subscribeActivation((s) => seenByStayer.push(s));

    const { deps } = bench(["free", "free", "standard"]);
    const watch = startActivationWatch("free", deps);
    // Ровно то, что делает закрытая шторка: экран покупки уезжает.
    unsubscribeLeaver();
    await watch;

    expect(seenByLeaver.map((s) => s.kind), "ушедший увидел только начало — и это правильно").toEqual(["waiting"]);
    expect(
      seenByStayer.map((s) => s.kind),
      "ПОСТОЯННЫЙ подписчик не узнал о выдаче доступа — ровно дефект 24.09.2026",
    ).toEqual(["waiting", "granted"]);
  });

  it("новый уровень доступа называется в состоянии — перерисовывать страницу есть на основании чего", async () => {
    const { deps } = bench(["free", "standard"]);
    const final = await startActivationWatch("free", deps);
    expect(final).toEqual({ kind: "granted", tier: "standard" });
    expect(activationState()).toEqual({ kind: "granted", tier: "standard" });
  });

  it("тот же уровень доступа выдачей не считается — иначе «готово» показалось бы до вебхука", async () => {
    const { deps, slept } = bench(["standard"]);
    const final = await startActivationWatch("standard", deps);
    expect(final.kind, "уровень не менялся, а ожидание объявило доступ открытым").toBe("slow");
    expect(slept.length, "опрос шёл не тем шагом").toBe(ACTIVATION_TIMEOUT_MS / ACTIVATION_POLL_MS);
    expect(new Set(slept)).toEqual(new Set([ACTIVATION_POLL_MS]));
  });

  it("отказ чтения не бросает ожидание: оплата уже прошла, следующий круг пробует снова", async () => {
    let call = 0;
    const deps: ActivationDeps = {
      readTier: vi.fn(async (): Promise<string | null> => {
        call += 1;
        if (call === 1) throw new Error("сеть моргнула");
        return "standard";
      }),
      sleep: vi.fn(async (ms: number): Promise<void> => {
        void ms;
      }),
      now: () => 0,
    };
    const final = await startActivationWatch("free", deps);
    expect(final.kind).toBe("granted");
    expect(call).toBe(2);
  });

  it("второй запуск, пока идёт первый, не заводит второй опрос сервера", async () => {
    const { deps } = bench(["free", "free", "standard"]);
    const first = startActivationWatch("free", deps);
    const second = await startActivationWatch("free", deps);
    expect(second.kind, "второй вызов начал своё ожидание вместо того, чтобы вернуть текущее").toBe("waiting");
    await first;
    expect((deps.readTier as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);
  });

  it("после срока ожидание кончается «долго», а не молчанием: у экрана есть «Восстановить покупки»", async () => {
    const { deps } = bench(["free"]);
    const final = await startActivationWatch("free", deps);
    expect(final.kind).toBe("slow");
  });
});

/**
 * ЗАХОД 7.264 — ВИДЕО ПЕРВОЙ НАСТОЯЩЕЙ ПОКУПКИ 13.10.2026: вебхук записал
 * доступ на ≈16,9 с, а магазин ответил «куплено» только после 19,0 с.
 * Пока покупка идёт, сервер спрашивается тем же вопросом.
 */
describe("сервер спрашивается уже во время покупки", () => {
  it("новый уровень во время «purchasing» — сразу «granted», не дожидаясь ответа магазина", async () => {
    const { deps } = bench(["free", "standard"]);
    const seen: ActivationState["kind"][] = [];
    subscribeActivation((next) => seen.push(next.kind));
    beginPurchase("free", deps);
    await vi.waitFor(() => expect(activationState()).toEqual({ kind: "granted", tier: "standard" }));
    expect(seen).toEqual(["purchasing", "granted"]);
  });

  it("ответ магазина ПОСЛЕ выдачи не опускает «granted» в «waiting» — «Listo» не сменяется «Activando…»", async () => {
    const { deps } = bench(["standard"]);
    beginPurchase("free", deps);
    await vi.waitFor(() => expect(activationState().kind).toBe("granted"));
    const after = await startActivationWatch("free", deps);
    expect(after).toEqual({ kind: "granted", tier: "standard" });
  });

  it("отмена человеком останавливает опрос: после «idle» сервер больше не спрашивается", async () => {
    let clock = 0;
    let release: () => void = () => {};
    const readTier = vi.fn(async (): Promise<string | null> => "standard");
    const deps: ActivationDeps = {
      readTier,
      sleep: () =>
        new Promise<void>((resolve) => {
          release = () => {
            clock += ACTIVATION_POLL_MS;
            resolve();
          };
        }),
      now: () => clock,
    };
    beginPurchase("free", deps);
    endPurchase();
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(readTier).not.toHaveBeenCalled();
    expect(activationState().kind).toBe("idle");
  });

  it("тот же уровень во время покупки выдачей не считается", async () => {
    const { deps, slept } = bench(["free"]);
    beginPurchase("free", deps);
    await vi.waitFor(() => expect(slept.length).toBeGreaterThan(3));
    expect(activationState().kind).toBe("purchasing");
    endPurchase();
  });

  it("экран покупки на виду считается, пока смонтирован, и снимается один раз", () => {
    expect(purchaseScreenOpen()).toBe(false);
    const off = registerPurchaseScreen();
    expect(purchaseScreenOpen()).toBe(true);
    off();
    off();
    expect(purchaseScreenOpen()).toBe(false);
  });
});
