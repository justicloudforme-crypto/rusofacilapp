import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, cleanup } from "@testing-library/react";
import SignedOutCachePurge from "./SignedOutCachePurge";
import {
  OWNED_LOCAL_KEYS,
  PERSONAL_LOCAL_KEYS,
  PERSONAL_LOCAL_PREFIXES,
  personalLocalKeys,
  purgedOwnedValue,
} from "@/lib/signed-out-local";
import { dropOtherOwners, GUEST_OWNER, keepGuestOwned } from "@/lib/progress-owner";
import { getProgressEntries, setWordKnown } from "@/lib/flashcard-progress";

/**
 * ВЫХОД НЕ УНОСИТ ГОСТЕВОЙ ПРОГРЕСС — ДОЛГ 218, заход 7.212.
 *
 * ЧТО БЫЛО, ЗАМЕРЕНО 18.09.2026 НА ПРОД-СБОРКЕ (живой браузер, одна
 * вкладка): гость отметил 3 слова — в хранилище 1 ключ,
 * `rusofacil:flashcard-progress`, 161 байт, записей 3; вошёл — те же 3
 * записи, отличить их от записей аккаунта нечем; вышел — ключей 0, то
 * есть гостевые 3 из 3 стёрты; вошёл под вторым аккаунтом — ключ заведён
 * заново, записей 0.
 *
 * ЧТО СТАЛО: у строки есть происхождение (`by`), и выход разбирает карту
 * по нему. Правило — `src/lib/progress-owner.ts`, момент —
 * `SignedOutCachePurge`.
 *
 * ПОЗИТИВНЫЙ КОНТРОЛЬ НА НАСТОЯЩЕМ СТАРОМ ПРАВИЛЕ внизу: прежняя уборка
 * (ключ целиком, `personalLocalKeys` включал обе карты) на ТЕХ ЖЕ данных
 * уносит гостевые строки. Без него «гостевое осталось» ничего не значило
 * бы: могло бы оказаться, что уборка не сработала вовсе.
 */

const PROGRESS_KEY = "rusofacil:flashcard-progress";
const SRS_KEY = "rusofacil:flashcard-srs";
const ACCOUNT = "usr_vasya";
const OTHER = "usr_petya";

/** Карта после входа: три строки гостя, две аккаунта, одна наследство. */
const MIXED = {
  "guest-milk": { known: true, updatedAt: 1_757_900_000_000, by: GUEST_OWNER },
  "guest-tenant": { known: true, updatedAt: 1_757_900_001_000, by: GUEST_OWNER },
  "guest-fridge": { known: true, updatedAt: 1_757_900_002_000, by: GUEST_OWNER },
  "acc-window": { known: true, updatedAt: 1_757_900_003_000, by: ACCOUNT },
  "acc-door": { known: true, updatedAt: 1_757_900_004_000, by: ACCOUNT },
  legacy: { known: true, updatedAt: 1_757_800_000_000 },
};

/** ПРЕЖНЕЕ правило уборки — ключ целиком. Живёт здесь, в пробе. */
function oldPurge(storage: Storage) {
  const all = Object.keys(storage);
  const matched = all.filter(
    (key) => PERSONAL_LOCAL_KEYS.includes(key) || PERSONAL_LOCAL_PREFIXES.some((p) => key.startsWith(p)),
  );
  for (const key of matched) storage.removeItem(key);
}

function signOutAndOpen() {
  window.history.replaceState(null, "", "/es/?signedout=1");
  render(<SignedOutCachePurge />);
}

function seed() {
  window.localStorage.clear();
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(MIXED));
  window.localStorage.setItem(
    SRS_KEY,
    JSON.stringify({
      "guest-milk": { box: 2, correctStreak: 0, lastSeenAt: 1, by: GUEST_OWNER },
      "acc-window": { box: 1, correctStreak: 1, lastSeenAt: 2, by: ACCOUNT },
    }),
  );
  window.localStorage.setItem("lesson-passed:a1:1", "1");
}

beforeEach(seed);
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("долг 218 — выход разбирает карту по происхождению строк", () => {
  it("гостевые три строки переживают выход, строки аккаунта и наследство — нет", async () => {
    await act(async () => {
      signOutAndOpen();
    });
    const left = getProgressEntries();
    expect(Object.keys(left).sort()).toEqual(["guest-fridge", "guest-milk", "guest-tenant"]);
    expect(JSON.stringify(window.localStorage)).not.toContain("acc-window");
    expect(JSON.stringify(window.localStorage)).not.toContain("legacy");
  });

  it("коробки повторения чистятся тем же правилом", async () => {
    await act(async () => {
      signOutAndOpen();
    });
    const srs = JSON.parse(window.localStorage.getItem(SRS_KEY) ?? "{}") as Record<string, unknown>;
    expect(Object.keys(srs)).toEqual(["guest-milk"]);
  });

  it("если гостевых строк не осталось — ключ убирается целиком, как раньше", async () => {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ "acc-window": { known: true, updatedAt: 1, by: ACCOUNT } }),
    );
    await act(async () => {
      signOutAndOpen();
    });
    expect(window.localStorage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it("обычное открытие страницы гостем по-прежнему не стирает ничего", async () => {
    window.history.replaceState(null, "", "/es/");
    await act(async () => {
      render(<SignedOutCachePurge />);
    });
    expect(JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "{}")).toEqual(MIXED);
  });

  it("ключи с картами убраны из правила «удалить целиком» — иначе разбор не успел бы случиться", () => {
    expect(personalLocalKeys(Object.keys(window.localStorage))).not.toContain(PROGRESS_KEY);
    expect(personalLocalKeys(Object.keys(window.localStorage))).not.toContain(SRS_KEY);
    // …но остальные ключи учебной истории правило по-прежнему называет.
    expect(personalLocalKeys(["lesson-passed:b2:17"])).toEqual(["lesson-passed:b2:17"]);
    expect(OWNED_LOCAL_KEYS).toEqual([PROGRESS_KEY, SRS_KEY]);
  });

  it("отметка «знаю» помечается тем, кто её пишет", () => {
    window.localStorage.clear();
    setWordKnown("word-1", true);
    // Сессии в этой пробе нет: `syncKnownWords` не звали, владелец — гость.
    expect(getProgressEntries()["word-1"].by).toBe(GUEST_OWNER);
  });

  it("переключение аккаунта уносит чужие строки и оставляет свои и гостевые", () => {
    const after = dropOtherOwners({ ...MIXED, foreign: { known: true, updatedAt: 9, by: OTHER } }, ACCOUNT);
    expect(Object.keys(after).sort()).toEqual([
      "acc-door",
      "acc-window",
      "guest-fridge",
      "guest-milk",
      "guest-tenant",
      "legacy",
    ]);
  });

  it("испорченное значение убирается целиком — чужая история не остаётся из-за разбора", () => {
    expect(purgedOwnedValue("{не json")).toBeNull();
    expect(purgedOwnedValue(null)).toBeNull();
    expect(purgedOwnedValue("[]")).toBeNull();
  });

  // ==================================================================
  // ПОЗИТИВНЫЙ КОНТРОЛЬ НА НАСТОЯЩЕМ СТАРОМ ПРАВИЛЕ
  // ==================================================================
  it("ПРЕЖНЕЕ правило на тех же данных уносит гостевые строки — вот чем это было", () => {
    oldPurge(window.localStorage);
    expect(window.localStorage.getItem(PROGRESS_KEY)).toBeNull();
    expect(Object.keys(keepGuestOwned(MIXED))).toHaveLength(3);
    // То есть старое правило теряло ровно три строки, которые новое хранит.
  });

  it("подсадка: строка без происхождения не считается гостевой", () => {
    expect(keepGuestOwned({ a: { known: true, updatedAt: 1 } })).toEqual({});
    expect(keepGuestOwned({ a: { known: true, updatedAt: 1, by: "usr_x" } })).toEqual({});
    expect(Object.keys(keepGuestOwned({ a: { known: true, updatedAt: 1, by: GUEST_OWNER } }))).toEqual(["a"]);
  });
});
