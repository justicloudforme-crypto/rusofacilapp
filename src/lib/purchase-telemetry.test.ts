import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ACCESS_LATE_MS,
  accessTimedOut,
  purchaseCancelled,
  purchaseFailed,
  purchaseTapped,
  serverConfirmed,
  setTelemetryDepsForTests,
  storeConfirmed,
  type TelemetryDeps,
} from "./purchase-telemetry";

/**
 * ДИАГНОСТИКА ПОКУПКИ (заход 7.264): на покупку — не больше трёх событий,
 * в них только внутренние величины, без почты и имени.
 */

interface Sent {
  name: string;
  level: string;
  tags: Record<string, string>;
  extra: Record<string, number | string | boolean>;
}

let clock = 0;
let timers: { at: number; fn: () => void; id: number }[] = [];
let nextId = 1;
let sent: Sent[] = [];
let locks = { present: 4, visible: 4 };
let profile: { badge: string | null; topRow: string | null; updating: boolean } = {
  badge: null,
  topRow: null,
  updating: false,
};

function advance(ms: number): void {
  const until = clock + ms;
  for (;;) {
    timers.sort((a, b) => a.at - b.at);
    const next = timers[0];
    if (!next || next.at > until) break;
    timers.shift();
    clock = next.at;
    next.fn();
  }
  clock = until;
}

beforeEach(() => {
  clock = 0;
  timers = [];
  sent = [];
  locks = { present: 4, visible: 4 };
  profile = { badge: null, topRow: null, updating: false };
  const deps: Partial<TelemetryDeps> = {
    send: (name, level, tags, extra) => sent.push({ name, level, tags, extra }),
    now: () => clock,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.push({ at: clock + ms, fn, id });
      return id;
    },
    clearTimer: (h) => {
      timers = timers.filter((t) => t.id !== h);
    },
    readLocks: () => locks,
    readProfile: () => profile,
    platform: () => "android",
    shellVersion: () => "15",
  };
  setTelemetryDepsForTests(deps);
});

afterEach(() => setTelemetryDepsForTests(null));

describe("NativePurchaseTiming", () => {
  it("успех: одно событие с отрезками в миллисекундах, платформой и версией оболочки", () => {
    purchaseTapped();
    advance(9_000);
    storeConfirmed();
    advance(2_000);
    serverConfirmed("standard");
    advance(300);
    locks = { present: 4, visible: 0 }; // метка на <html> спрятала замки
    advance(700);
    locks = { present: 0, visible: 0 }; // перерисовка убрала их из разметки
    advance(20_000);

    const timing = sent.filter((e) => e.name === "NativePurchaseTiming");
    expect(timing).toHaveLength(1);
    expect(timing[0].level).toBe("info");
    expect(timing[0].tags).toMatchObject({ outcome: "success", platform: "android", shell_version: "15" });
    expect(timing[0].extra).toMatchObject({
      ms_tap_to_store: 9_000,
      ms_store_to_server: 2_000,
      // Шаг замера — 100 мс: замки сменились сразу ПОСЛЕ тика, увидены
      // следующим.
      ms_server_to_hidden: 400,
      ms_server_to_refreshed: 1_100,
      locks_at_server: 4,
    });
    expect(sent).toHaveLength(1);
    // Только время и итог: уровень доступа и сведения об учётке — не здесь.
    expect(Object.keys(timing[0].tags).sort()).toEqual(["outcome", "platform", "shell_version"]);
  });

  it("сервер раньше магазина (порядок с видео 13.10) — отрезок отрицательный, «опоздания» нет", () => {
    purchaseTapped();
    advance(6_000);
    serverConfirmed("standard");
    locks = { present: 0, visible: 0 };
    advance(2_000);
    storeConfirmed();
    advance(20_000);
    expect(sent.map((e) => e.name)).toEqual(["NativePurchaseTiming"]);
  });

  it("ошибка магазина — итог «error» с кодом", () => {
    purchaseTapped();
    advance(3_000);
    purchaseFailed("RC-BUY-5");
    expect(sent).toHaveLength(1);
    expect(sent[0].tags).toMatchObject({ outcome: "error", code: "RC-BUY-5" });
  });

  it("отмена человеком — ни одного события", () => {
    purchaseTapped();
    advance(3_000);
    purchaseCancelled();
    advance(60_000);
    expect(sent).toEqual([]);
  });
});

describe("NativePurchaseAccessLate", () => {
  it("«куплено», а доступа нет 15 с — одно предупреждение, потом итог «timeout»", () => {
    purchaseTapped();
    advance(5_000);
    storeConfirmed();
    advance(ACCESS_LATE_MS - 1);
    expect(sent).toEqual([]);
    advance(1);
    expect(sent.map((e) => [e.name, e.level])).toEqual([["NativePurchaseAccessLate", "warning"]]);
    expect(sent[0].extra.ms_waited).toBe(ACCESS_LATE_MS);
    advance(15_000);
    accessTimedOut();
    expect(sent.map((e) => e.name)).toEqual(["NativePurchaseAccessLate", "NativePurchaseTiming"]);
    expect(sent[1].tags.outcome).toBe("timeout");
  });

  it("доступ пришёл на 14-й секунде — предупреждения нет", () => {
    purchaseTapped();
    storeConfirmed();
    advance(14_000);
    serverConfirmed("standard");
    locks = { present: 0, visible: 0 };
    advance(30_000);
    expect(sent.map((e) => e.name)).toEqual(["NativePurchaseTiming"]);
  });
});

describe("NativePurchaseStateConflict", () => {
  it("долг 359: «Activa» над «Expirada» дольше 500 мс — одно предупреждение", () => {
    purchaseTapped();
    profile = { badge: "active", topRow: "expired", updating: false };
    advance(400);
    expect(sent).toEqual([]);
    advance(300);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ name: "NativePurchaseStateConflict", level: "warning" });
    expect(sent[0].tags.conflict).toBe("badge-active+history-expired");
    advance(10_000);
    expect(sent).toHaveLength(1);
  });

  it("«Actualizando…» вместо истории — это не противоречие", () => {
    purchaseTapped();
    profile = { badge: "active", topRow: "expired", updating: true };
    advance(5_000);
    expect(sent).toEqual([]);
  });

  it("противоречие короче 500 мс не сообщается", () => {
    purchaseTapped();
    profile = { badge: "activating", topRow: "expired", updating: false };
    advance(300);
    profile = { badge: "activating", topRow: null, updating: true };
    advance(5_000);
    expect(sent).toEqual([]);
  });

  it("замки видны дольше 500 мс после ответа сервера — предупреждение", () => {
    purchaseTapped();
    storeConfirmed();
    serverConfirmed("standard");
    advance(1_200);
    expect(sent.map((e) => e.tags.conflict)).toContain("granted+locks-visible");
  });
});

describe("без личных данных", () => {
  it("ни в метках, ни в величинах нет почты", () => {
    purchaseTapped();
    storeConfirmed();
    advance(ACCESS_LATE_MS);
    serverConfirmed("premium");
    advance(20_000);
    const text = JSON.stringify(sent);
    expect(text).not.toMatch(/@/);
    expect(sent.length).toBeLessThanOrEqual(3);
  });
});
