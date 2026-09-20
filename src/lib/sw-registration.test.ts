import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isKnownNonInteractiveCrawler,
  registerServiceWorkerOnce,
  resetRegistrationStateForTests,
  ServiceWorkerRegistrationFailed,
  type RegistrationDeps,
} from "./sw-registration";

/**
 * ПРАВИЛО РЕГИСТРАЦИИ SERVICE WORKER — заход 7.219, 20.09.2026.
 *
 * Два утверждения, ради которых файл существует:
 *   1. `register()` зовётся РОВНО ОДИН РАЗ за загрузку страницы, сколько бы
 *      раз компонент ни смонтировался;
 *   2. уход со страницы во время регистрации НЕ порождает необработанного
 *      отказа промиса — именно этим классом набежало 1300 событий
 *      `Error: Rejected` в JAVASCRIPT-NEXTJS-9.
 *
 * Позитивные контроли стоят рядом с каждым: без них зелёный цвет значил бы
 * только «функция ничего не делает».
 */

function deps(overrides: Partial<RegistrationDeps> = {}): RegistrationDeps {
  return {
    serwist: { register: vi.fn(async () => undefined) },
    userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/150 Mobile Safari/537.36",
    hasServiceWorker: true,
    pageLoaded: async () => {},
    swUrl: "/sw.js",
    onExpectedFailure: vi.fn(),
    onUnexpectedFailure: vi.fn(),
    onSkip: vi.fn(),
    ...overrides,
  };
}

/** Ловушка на необработанные отказы промисов внутри одного теста. */
function trapUnhandledRejections(): { seen: unknown[]; stop: () => void } {
  const seen: unknown[] = [];
  const onUnhandled = (reason: unknown) => seen.push(reason);
  process.on("unhandledRejection", onUnhandled);
  return { seen, stop: () => process.off("unhandledRejection", onUnhandled) };
}

beforeEach(() => resetRegistrationStateForTests());
afterEach(() => vi.restoreAllMocks());

describe("регистрация зовётся ровно один раз за загрузку страницы", () => {
  it("три монтирования подряд дают один вызов register()", async () => {
    const register = vi.fn(async () => undefined);
    const shared = { register };
    const outcomes = [];
    for (let i = 0; i < 3; i++) {
      outcomes.push(await registerServiceWorkerOnce(deps({ serwist: shared })));
    }
    expect(register).toHaveBeenCalledTimes(1);
    expect(outcomes).toEqual([
      "registered",
      "skipped-already-registered",
      "skipped-already-registered",
    ]);
  });

  it("два монтирования В ОДНОМ КАДРЕ тоже дают один вызов", async () => {
    // Флаг ставится ДО ожидания полной загрузки. Если бы он ставился после,
    // оба вызова прошли бы проверку и оба дождались бы `load`.
    const register = vi.fn(async () => undefined);
    const shared = { register };
    let releaseLoad = () => {};
    const loaded = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const both = Promise.all([
      registerServiceWorkerOnce(deps({ serwist: shared, pageLoaded: () => loaded })),
      registerServiceWorkerOnce(deps({ serwist: shared, pageLoaded: () => loaded })),
    ]);
    releaseLoad();
    const outcomes = await both;
    expect(register).toHaveBeenCalledTimes(1);
    expect(outcomes).toContain("skipped-already-registered");
  });

  it("позитивный контроль: без флага те же три монтирования дают три вызова", async () => {
    const register = vi.fn(async () => undefined);
    const shared = { register };
    for (let i = 0; i < 3; i++) {
      resetRegistrationStateForTests(); // изображает отсутствие защиты
      await registerServiceWorkerOnce(deps({ serwist: shared }));
    }
    expect(register).toHaveBeenCalledTimes(3);
  });

  it("регистрация ждёт полной загрузки страницы, а не первого эффекта", async () => {
    const order: string[] = [];
    const register = vi.fn(async () => {
      order.push("register");
    });
    let releaseLoad = () => {};
    const loaded = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const run = registerServiceWorkerOnce(
      deps({
        serwist: { register },
        pageLoaded: () => loaded,
      }),
    );
    await Promise.resolve();
    expect(register).not.toHaveBeenCalled();
    order.push("load");
    releaseLoad();
    await run;
    expect(order).toEqual(["load", "register"]);
  });
});

describe("уход со страницы во время регистрации не даёт необработанного отказа", () => {
  it("отказ AbortError ловится, зовёт ожидаемый путь и в Sentry не идёт", async () => {
    const trap = trapUnhandledRejections();
    const abort = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    const onExpectedFailure = vi.fn();
    const onUnexpectedFailure = vi.fn();
    const outcome = await registerServiceWorkerOnce(
      deps({
        serwist: {
          register: async () => {
            throw abort;
          },
        },
        onExpectedFailure,
        onUnexpectedFailure,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    trap.stop();
    expect(outcome).toBe("failed-expected");
    expect(onExpectedFailure).toHaveBeenCalledWith(abort);
    expect(onUnexpectedFailure).not.toHaveBeenCalled();
    expect(trap.seen).toEqual([]);
  });

  it("позитивный контроль: тот же отказ БЕЗ обработчика ловушка видит", async () => {
    const trap = trapUnhandledRejections();
    // Прежнее поведение библиотеки: `void serwist.register()` без .catch().
    void Promise.reject(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    trap.stop();
    expect(trap.seen).toHaveLength(1);
  });

  it("вызывающий не обязан ловить: функция сама не отвергается", async () => {
    const trap = trapUnhandledRejections();
    void registerServiceWorkerOnce(
      deps({
        serwist: {
          register: async () => {
            throw new Error("Rejected");
          },
        },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    trap.stop();
    expect(trap.seen).toEqual([]);
  });
});

describe("неожиданный отказ уходит с внятным текстом, а не словом «Rejected»", () => {
  it("голое «Rejected» становится именованным событием с адресом скрипта", async () => {
    const onUnexpectedFailure = vi.fn();
    const outcome = await registerServiceWorkerOnce(
      deps({
        serwist: {
          register: async () => {
            throw new Error("Rejected");
          },
        },
        onUnexpectedFailure,
      }),
    );
    expect(outcome).toBe("failed-unexpected");
    const reported = onUnexpectedFailure.mock.calls[0][0] as ServiceWorkerRegistrationFailed;
    expect(reported.name).toBe("ServiceWorkerRegistrationFailed");
    expect(reported.message).toContain("/sw.js");
    expect(reported.message).toContain("Error: Rejected");
    expect(reported.cause).toBeInstanceOf(Error);
    // Позитивный контроль текста: прежний заголовок в Sentry был ровно
    // «Error: Rejected» — ни адреса, ни имени класса.
    expect(reported.message).not.toBe("Rejected");
  });

  it("ожидаемый отказ (приватное окно Safari) в Sentry не идёт", async () => {
    const onUnexpectedFailure = vi.fn();
    const outcome = await registerServiceWorkerOnce(
      deps({
        serwist: {
          register: async () => {
            throw Object.assign(new Error("Script https://rusofacilapp.com/sw.js load failed"), {
              name: "SecurityError",
            });
          },
        },
        onUnexpectedFailure,
      }),
    );
    expect(outcome).toBe("failed-expected");
    expect(onUnexpectedFailure).not.toHaveBeenCalled();
  });
});

describe("неинтерактивные обходчики не получают вызова вовсе", () => {
  const AGENTS = [
    ["PlayStore-Google", true],
    ["Mozilla/5.0 (compatible; GoogleOther)", true],
    ["Google-InspectionTool", true],
    ["Mozilla/5.0 (Linux; Android 14) Chrome/150 Mobile Safari/537.36", false],
    ["Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15", false],
  ] as const;

  it.each(AGENTS)("%s → обходчик: %s", (agent, expected) => {
    expect(isKnownNonInteractiveCrawler(agent)).toBe(expected);
  });

  it("проверяющий Google Play (JAVASCRIPT-NEXTJS-Q) вызова не делает", async () => {
    const register = vi.fn(async () => undefined);
    const outcome = await registerServiceWorkerOnce(
      deps({ serwist: { register }, userAgent: "PlayStore-Google" }),
    );
    expect(outcome).toBe("skipped-crawler");
    expect(register).not.toHaveBeenCalled();
  });

  it("позитивный контроль: обычный телефон вызов получает", async () => {
    const register = vi.fn(async () => undefined);
    const outcome = await registerServiceWorkerOnce(deps({ serwist: { register } }));
    expect(outcome).toBe("registered");
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("пропуск по обходчику НЕ съедает право следующей загрузки", async () => {
    // Флаг не должен ставиться на пути пропуска: иначе один заход краулера
    // в том же процессе обесценил бы регистрацию для живого читателя.
    const register = vi.fn(async () => undefined);
    await registerServiceWorkerOnce(deps({ serwist: { register }, userAgent: "PlayStore-Google" }));
    const outcome = await registerServiceWorkerOnce(deps({ serwist: { register } }));
    expect(outcome).toBe("registered");
  });
});

describe("приватное окно и отсутствующий провайдер", () => {
  it("без navigator.serviceWorker вызова нет и ошибки нет", async () => {
    const register = vi.fn(async () => undefined);
    const outcome = await registerServiceWorkerOnce(
      deps({ serwist: { register }, hasServiceWorker: false }),
    );
    expect(outcome).toBe("skipped-no-service-worker");
    expect(register).not.toHaveBeenCalled();
  });

  it("пока провайдер не создал объект, ничего не происходит", async () => {
    const outcome = await registerServiceWorkerOnce(deps({ serwist: null }));
    expect(outcome).toBe("skipped-no-serwist");
  });
});
