import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ЭКРАН ПОКУПКИ НЕ ИМЕЕТ ПРАВА ВИСЕТЬ БЕЗ КОНЦА — заход 7.225.
 *
 * Эти примеры написаны по НАСТОЯЩЕМУ дефекту, снятому владельцем с
 * телефона 23.09.2026: «Загружаем варианты…» навсегда, ошибки нет,
 * в RevenueCat ноль клиентов.
 *
 * ГЛАВНАЯ ПОДСАДКА ЗДЕСЬ — ПРОМИС, КОТОРЫЙ НЕ ЗАВЕРШАЕТСЯ НИКОГДА
 * (`new Promise(() => {})`). Это не выдумка «на всякий случай»: мост
 * Capacitor умеет отдать ровно такой промис двумя разными способами
 * (`native-bridge.js`, `cap.toNative` — глотает отказ и возвращает `null`,
 * а созданный `cap.nativePromise` промис остаётся висеть), и именно так
 * вёл себя телефон. Прибор обязан такую подсадку ЛОВИТЬ: `loadStore`
 * должна завершиться сроком, а не ждать вечно.
 *
 * Время здесь поддельное (`vi.useFakeTimers`) — иначе каждый такой пример
 * стоил бы пятнадцати настоящих секунд.
 */

const NEVER = () => new Promise<never>(() => {});

type PluginStub = Record<string, (...args: unknown[]) => Promise<unknown>>;

let platform = "android";
let isNative = true;
let plugin: PluginStub;

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => platform,
    isNativePlatform: () => isNative,
  },
}));

vi.mock("@revenuecat/purchases-capacitor", () => ({
  get Purchases() {
    return plugin;
  },
}));

/** Свежий модуль на каждый пример: `configured` в нём — состояние модуля. */
async function freshClient() {
  vi.resetModules();
  return import("./revenuecat-client");
}

/** Предложение с одним пакетом — «магазин ответил и товары есть». */
function offeringWith(ids: string[]) {
  return {
    current: {
      identifier: "default",
      availablePackages: ids.map((identifier) => ({
        identifier,
        product: { priceString: "—" },
      })),
    },
  };
}

function workingPlugin(offerings: unknown = offeringWith(["$rc_annual", "$rc_monthly"])): PluginStub {
  return {
    configure: async () => ({}),
    logIn: async () => ({ customerInfo: {} }),
    logOut: async () => ({}),
    getOfferings: async () => offerings,
    getCustomerInfo: async () => ({ customerInfo: {} }),
    restorePurchases: async () => ({ customerInfo: {} }),
    purchasePackage: async () => ({ customerInfo: {} }),
  };
}

beforeEach(() => {
  platform = "android";
  isNative = true;
  plugin = workingPlugin();
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { onLine: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Доводит поддельное время до конца срока и отдаёт результат. */
async function settle<T>(work: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(16_000);
  return work;
}

describe("loadStore завершается ВСЕГДА", () => {
  it("товары пришли — порядок наш, а не тот, в котором приехали", async () => {
    const { loadStore } = await freshClient();
    const result = await settle(loadStore("user-1"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.packages.map((p) => p.identifier)).toEqual(["$rc_monthly", "$rc_annual"]);
  });

  /**
   * ТОТ САМЫЙ ДЕФЕКТ. Каждый шаг по очереди подменяется промисом, который
   * не завершается никогда. До 7.225 любой из них вешал экран навсегда.
   */
  it.each([
    ["configure", "RC-CONN-CFG"],
    ["logIn", "RC-CONN-LOG"],
    ["getOfferings", "RC-CONN-OFR"],
  ])("шаг %s не отвечает никогда — срок, а не вечное ожидание (%s)", async (method, code) => {
    plugin = { ...workingPlugin(), [method]: NEVER };
    const { loadStore } = await freshClient();
    const result = await settle(loadStore("user-1"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("store-unreachable");
    expect(result.code).toBe(code);
  });

  /**
   * ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ К ПОДСАДКЕ ВЫШЕ, без которого она не значит
   * ничего: до срока результата быть НЕ должно. Иначе «поймали» могло бы
   * означать «прибор всегда отвечает отказом».
   */
  it("до истечения срока ответа ещё нет — прибор не отвечает отказом заранее", async () => {
    plugin = { ...workingPlugin(), getOfferings: NEVER };
    const { loadStore } = await freshClient();
    let done = false;
    const work = loadStore("user-1").then((r) => {
      done = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(14_000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    await work;
    expect(done).toBe(true);
  });

  it("мост проглотил вызов молча — тот же исход, что и молчание", async () => {
    // Ровно поведение `cap.toNative`: промис создан, отказ проглочен.
    plugin = { ...workingPlugin(), configure: NEVER };
    const { loadStore } = await freshClient();
    const result = await settle(loadStore("user-1"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.step).toBe("configure");
  });
});

describe("четыре исхода отличаются друг от друга", () => {
  it("это не оболочка — «плагина нет», и сразу, без срока", async () => {
    isNative = false;
    const { loadStore } = await freshClient();
    const result = await loadStore("user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("plugin-missing");
      expect(result.code).toBe("RC-PLG-IMP");
    }
  });

  it("платформа без ключа — «плагина нет»", async () => {
    platform = "ios";
    const { loadStore } = await freshClient();
    const result = await loadStore("user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("plugin-missing");
  });

  it("плагин отвечает «не реализовано» — это «плагина нет», а не «магазин молчит»", async () => {
    plugin = {
      ...workingPlugin(),
      configure: async () => {
        throw Object.assign(new Error('"Purchases.configure()" is not implemented on android'), {
          code: "UNIMPLEMENTED",
        });
      },
    };
    const { loadStore } = await freshClient();
    const result = await settle(loadStore("user-1"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("plugin-missing");
      expect(result.code).toBe("RC-PLG-CFG");
    }
  });

  /**
   * ОТДЕЛЬНЫЙ ИСХОД, И ЭТО ВАЖНО. Так выглядит аккаунт Google, не
   * допущенный к треку закрытого теста: магазин ОТВЕТИЛ, товаров нет.
   * Повтор тут не поможет — поможет список тестировщиков, и текст на
   * экране обязан говорить об этом, а не «попробуйте ещё раз».
   */
  it("магазин ответил, товаров нет — «товаров нет», а не «не достучались»", async () => {
    plugin = workingPlugin({ current: { identifier: "default", availablePackages: [] } });
    const { loadStore } = await freshClient();
    const result = await settle(loadStore("user-1"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no-products");
      expect(result.code).toBe("RC-EMPTY-OFR");
    }
  });

  it("предложения `default` нет вовсе — тот же исход «товаров нет»", async () => {
    plugin = workingPlugin({ current: null });
    const { loadStore } = await freshClient();
    const result = await settle(loadStore("user-1"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no-products");
  });

  it("телефон без сети — «нет сети», и ни одного обращения к магазину", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const configure = vi.fn(async () => ({}));
    plugin = { ...workingPlugin(), configure };
    const { loadStore } = await freshClient();
    const result = await loadStore("user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("offline");
      expect(result.code).toBe("RC-NET-IMP");
    }
    expect(configure).not.toHaveBeenCalled();
  });

  it("отказ сети из SDK — «нет сети», а не «магазин молчит»", async () => {
    plugin = {
      ...workingPlugin(),
      getOfferings: async () => {
        throw Object.assign(new Error("network error"), { code: "10" });
      },
    };
    const { loadStore } = await freshClient();
    const result = await settle(loadStore("user-1"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("offline");
      expect(result.code).toBe("RC-NET-OFR");
    }
  });
});

describe("объект плагина не возвращается голым", () => {
  /**
   * Корень дефекта 23.09.2026, записанный примером. `Purchases` —
   * Proxy, чья ловушка `get` отдаёт функцию на ЛЮБОЕ имя свойства,
   * включая `then`. `return` такого объекта из `async`-функции — это
   * `Promise.resolve(thenable)`, который ОБЯЗАН позвать
   * `thenable.then(resolve, reject)`; обёртка Capacitor аргументы
   * игнорирует, и промис не завершается НИКОГДА.
   */
  it("thenable, возвращённый из async-функции, не завершается — вот он, дефект", async () => {
    vi.useRealTimers();
    const capacitorLikeProxy = new Proxy(
      {},
      {
        get: (_t, prop) => {
          if (prop === "$$typeof" || prop === "toJSON") return undefined;
          return () => {
            const rejected = Promise.reject(new Error(`"Purchases.${String(prop)}()" is not implemented on android`));
            // Обработчик — только чтобы отказ не шумел в отчёте прогона.
            // Смысл подсадки от него не меняется: ни `resolve`, ни
            // `reject` вызвавшего обёртка не зовёт всё равно.
            rejected.catch(() => {});
            return rejected;
          };
        },
      },
    ) as { then?: unknown };

    expect(typeof capacitorLikeProxy.then).toBe("function");

    const bare = async () => capacitorLikeProxy;
    let settled = false;
    void bare().then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(settled, "промис с голым thenable не завершается — это и есть причина вечного «Загружаем варианты…»").toBe(
      false,
    );

    // А обёртка — обычный объект, и он завершается.
    const wrapped = async () => ({ api: capacitorLikeProxy });
    await expect(wrapped()).resolves.toHaveProperty("api");
  });

  it("сам клиент заворачивает плагин и доходит до configure", async () => {
    const configure = vi.fn(async () => ({}));
    plugin = { ...workingPlugin(), configure };
    const { configureRevenueCat } = await freshClient();
    const ok = await settle(configureRevenueCat());
    expect(ok).toBe(true);
    expect(configure).toHaveBeenCalledTimes(1);
  });
});
