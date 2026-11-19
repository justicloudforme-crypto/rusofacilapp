import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ДОЛГ 302 (заход 7.292): «промис моста не завершается никогда» — подсадка
 * в каждом вызове вне экрана покупки.
 *
 * Плагины подменены так, что КАЖДЫЙ их метод возвращает промис, который не
 * завершится никогда (ровно то, что делает `cap.nativePromise`, когда
 * `postToNative` не поднялся). Утверждение — каждая открытая функция
 * `notifications.ts` и `native-media-session.ts` всё же завершается, и
 * Sentry получает имя шага. На коде до 7.292 каждая из них висит вечно —
 * позитивный контроль снят на `main` (журнал захода 7.292).
 */

const capture = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureMessage: (...args: unknown[]) => capture(...args) }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));

const never = () => new Promise<never>(() => {});
const calls: string[] = [];
/** `setActionHandler` на Android идёт через `cap.nativeCallback` и
 *  возвращает НОМЕР обратного вызова — строку, а не промис. */
let actionHandlerReturns: "never" | "callback-id" = "never";

function hangingPlugin(name: string) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return undefined;
        return () => {
          calls.push(`${name}.${String(prop)}`);
          if (prop === "setActionHandler" && actionHandlerReturns === "callback-id") return "17";
          return never();
        };
      },
    },
  );
}

vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: hangingPlugin("LocalNotifications") }));
vi.mock("@capgo/capacitor-media-session", () => ({ MediaSession: hangingPlugin("MediaSession") }));

import { NATIVE_DEADLINE_MS, NATIVE_HUMAN_DEADLINE_MS, NativeDeadline, resetNativeDeadlineReportsForTests, withinNative } from "./native-deadline";
import * as notifications from "./notifications";
import * as media from "./native-media-session";

/** Завершилась ли работа к моменту `ms` по часам теста. */
async function settlesWithin(work: () => Promise<unknown>, ms: number): Promise<{ settled: boolean; error: unknown }> {
  let settled = false;
  let error: unknown = null;
  work().then(
    () => {
      settled = true;
    },
    (e) => {
      settled = true;
      error = e;
    },
  );
  await vi.advanceTimersByTimeAsync(ms + 1);
  return { settled, error };
}

beforeEach(() => {
  vi.useFakeTimers();
  capture.mockClear();
  calls.length = 0;
  actionHandlerReturns = "never";
  resetNativeDeadlineReportsForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("withinNative — срок и имя шага", () => {
  it("промис, не завершающийся никогда, отклоняется NativeDeadline с именем шага ровно по сроку", async () => {
    const report = vi.fn();
    const p = withinNative(never(), "Plugin.method", 1000, report);
    const seen = p.catch((e) => e);
    await vi.advanceTimersByTimeAsync(999);
    expect(report).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    const error = await seen;
    expect(error).toBeInstanceOf(NativeDeadline);
    expect((error as NativeDeadline).step).toBe("Plugin.method");
    expect(report).toHaveBeenCalledWith("Plugin.method", 1000);
  });

  it("быстрый ответ проходит как есть, таймер не остаётся", async () => {
    const report = vi.fn();
    await expect(withinNative(Promise.resolve(5), "P.m", 1000, report)).resolves.toBe(5);
    expect(vi.getTimerCount()).toBe(0);
    expect(report).not.toHaveBeenCalled();
  });

  it("не промис (номер обратного вызова) отдаётся как есть", async () => {
    await expect(withinNative("17", "P.cb", 1000)).resolves.toBe("17");
  });
});

const FAST: [string, () => Promise<unknown>][] = [
  ["notificationPermissionGranted", () => notifications.notificationPermissionGranted()],
  ["clearDeliveredNotifications", () => notifications.clearDeliveredNotifications()],
  ["cancelStreakReminder", () => notifications.cancelStreakReminder()],
  // проверка разрешения + (не дошло) расписание: один срок
  ["scheduleStreakReminder", () => notifications.scheduleStreakReminder("es", "usr_1")],
  ["setNativeMediaMetadata", () => media.setNativeMediaMetadata({ title: "t" })],
  ["setNativePlaybackState", () => media.setNativePlaybackState(true)],
  ["setNativeActionHandler", () => media.setNativeActionHandler("play", () => {})],
  ["setNativeSeekToHandler", () => media.setNativeSeekToHandler(() => {})],
  ["setNativePositionState", () => media.setNativePositionState(null)],
];

describe("каждая открытая функция завершается, когда мост молчит вечно (долг 302)", () => {
  for (const [name, work] of FAST) {
    it(`${name} — завершается за срок`, async () => {
      const { settled, error } = await settlesWithin(work, NATIVE_DEADLINE_MS);
      expect(settled, `${name} висит: мост не ответил, срока нет`).toBe(true);
      expect(error, `${name} отклонилась вместо тихого «не применилось»`).toBeNull();
      expect(capture, `${name}: Sentry не узнал о просрочке`).toHaveBeenCalled();
      const step = capture.mock.calls[0][1]?.tags?.native_step as string;
      expect(step).toMatch(/^(LocalNotifications|MediaSession)\.\w+$/);
    });
  }

  it("clearNativeMediaSession — два шага подряд: второй не ждёт первого вечно", async () => {
    const { settled } = await settlesWithin(() => media.clearNativeMediaSession(), 2 * NATIVE_DEADLINE_MS);
    expect(settled).toBe(true);
    expect(calls).toEqual(["MediaSession.setPositionState", "MediaSession.setPlaybackState"]);
  });

  it("окно разрешения ждёт человека долгим сроком, а не коротким", async () => {
    const early = await settlesWithin(() => notifications.requestNotificationPermission(), NATIVE_DEADLINE_MS);
    expect(early.settled, "окно разрешения оборвано через 10 с — человек не успел бы нажать").toBe(false);
    await vi.advanceTimersByTimeAsync(NATIVE_HUMAN_DEADLINE_MS);
    expect(capture).toHaveBeenCalledWith("native_bridge_deadline", expect.objectContaining({ tags: { native_step: "LocalNotifications.requestPermissions" } }));
  });

  it("enableStreakReminder завершается за долгий срок и честно говорит «не включено»", async () => {
    let result: boolean | undefined;
    void notifications.enableStreakReminder("es", null).then((r) => {
      result = r;
    });
    await vi.advanceTimersByTimeAsync(NATIVE_HUMAN_DEADLINE_MS + 1);
    expect(result).toBe(false);
  });

  it("одна запись в Sentry на шаг за загрузку, а не на каждый вызов", async () => {
    await settlesWithin(() => media.setNativePlaybackState(true), NATIVE_DEADLINE_MS);
    await settlesWithin(() => media.setNativePlaybackState(false), NATIVE_DEADLINE_MS);
    expect(capture).toHaveBeenCalledTimes(1);
  });
});

describe("setActionHandler на Android возвращает номер обратного вызова, а не промис", () => {
  it("функция не отклоняется TypeError «.catch is not a function»", async () => {
    actionHandlerReturns = "callback-id";
    await expect(media.setNativeActionHandler("play", () => {})).resolves.toBeUndefined();
    await expect(media.setNativeSeekToHandler(() => {})).resolves.toBeUndefined();
    expect(capture).not.toHaveBeenCalled();
  });
});
