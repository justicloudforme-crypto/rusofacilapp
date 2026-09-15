import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, cleanup } from "@testing-library/react";
import SignedOutCachePurge from "./SignedOutCachePurge";
import { personalPageCaches } from "@/lib/signed-out";
import { KEPT_LOCAL_KEYS, personalLocalKeys } from "@/lib/signed-out-local";
import { getProgressEntries } from "@/lib/flashcard-progress";

/**
 * ПОСЛЕ ВЫХОДА ГОСТЬ НЕ ВИДИТ УЧЕБНОЙ ИСТОРИИ АККАУНТА — 7.199, часть 2.
 *
 * Стенд — ровно сценарий владельца: аккаунт занимался (в карте прогресса
 * лежат «молоко» и «арендатор», те самые слова с видео), человек нажал
 * «Cerrar sesión», маршрут выхода увёл на гостевую страницу с признаком
 * `?signedout=1`, страница открылась. После этого учебной истории на
 * устройстве быть не должно.
 *
 * ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ ЗДЕСЬ НЕ СИНТЕТИЧЕСКИЙ. Он показывает, что
 * уборка 7.198 этот случай не закрывала и закрыть не могла: её правило
 * (`personalPageCaches`) на ТЕХ ЖЕ ключах возвращает пустой список —
 * оно судит другое хранилище. То есть слово «молоко» пережило бы выход
 * целиком, что владелец и снял.
 */

const PROGRESS_KEY = "rusofacil:flashcard-progress";

/** Карта прогресса аккаунта в том виде, в каком её оставляет вход
 *  (`syncKnownWords` сливает серверную с локальной и пишет обратно). */
const ACCOUNT_PROGRESS = JSON.stringify({
  milk: { known: true, updatedAt: 1_757_900_000_000 },
  tenant: { known: true, updatedAt: 1_757_900_001_000 },
  "flexible-schedule": { known: true, updatedAt: 1_757_900_002_000 },
});

function signOutAndOpen(search: string) {
  window.history.replaceState(null, "", `/es/${search}`);
  render(<SignedOutCachePurge />);
}

function seedDevice() {
  window.localStorage.clear();
  window.localStorage.setItem(PROGRESS_KEY, ACCOUNT_PROGRESS);
  window.localStorage.setItem("rusofacil:flashcard-srs", JSON.stringify({ milk: { box: 2, correctStreak: 0, lastSeenAt: 1 } }));
  window.localStorage.setItem("rusofacil:story-progress", JSON.stringify({ "dia-de-colada": { currentPage: 4, queueIndex: null, totalPages: 6, percent: 65, isCompleted: false, updatedAt: 1 } }));
  window.localStorage.setItem("rusofasil:pending-progress", "[]");
  window.localStorage.setItem("rusofasil:glossary-seen-terms", JSON.stringify(["dativo"]));
  window.localStorage.setItem("rusofasil:glossary-mastered-terms", JSON.stringify(["dativo"]));
  window.localStorage.setItem("lesson-passed:a1:1", "1");
  window.localStorage.setItem("rf-welcome-shown:usr_vasya:2026-09-15", "1");
  // Настройки устройства — они обязаны пережить выход.
  for (const key of KEPT_LOCAL_KEYS) window.localStorage.setItem(key, "1");
}

beforeEach(seedDevice);

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("часть 2 — выход уносит учебную историю с устройства", () => {
  it("после выхода карты прогресса нет, и «Продолжить» строить не из чего", async () => {
    await act(async () => {
      signOutAndOpen("?signedout=1");
    });
    expect(window.localStorage.getItem(PROGRESS_KEY)).toBeNull();
    expect(getProgressEntries()).toEqual({});
    expect(personalLocalKeys(Object.keys(window.localStorage))).toHaveLength(0);
    // Ни одного слова с видео владельца.
    expect(JSON.stringify(window.localStorage)).not.toContain("milk");
    expect(JSON.stringify(window.localStorage)).not.toContain("tenant");
  });

  it("настройки устройства остаются — это не учебная история", async () => {
    await act(async () => {
      signOutAndOpen("?signedout=1");
    });
    for (const key of KEPT_LOCAL_KEYS) expect(window.localStorage.getItem(key)).toBe("1");
  });

  it("признак уходит из адреса, чтобы не уехать в закладку", async () => {
    await act(async () => {
      signOutAndOpen("?signedout=1");
    });
    expect(window.location.search).toBe("");
  });

  it("обычное открытие страницы гостем ничего не стирает", async () => {
    await act(async () => {
      signOutAndOpen("");
    });
    expect(window.localStorage.getItem(PROGRESS_KEY)).toBe(ACCOUNT_PROGRESS);
  });

  // ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ НА НАСТОЯЩЕМ КОДЕ ДО ПРАВКИ: правило 7.198
  // судит кеши документов и на этих ключах молчит.
  it("уборка 7.198 этот случай не закрывала — её правило здесь пустое", () => {
    const keys = Object.keys(window.localStorage);
    expect(keys).toContain(PROGRESS_KEY);
    expect(personalPageCaches(keys)).toHaveLength(0);
    expect(personalLocalKeys(keys).length).toBeGreaterThan(0);
  });

  it("правило называет ключ с переменным хвостом по приставке", () => {
    expect(personalLocalKeys(["lesson-passed:b2:17"])).toEqual(["lesson-passed:b2:17"]);
    expect(personalLocalKeys(["rf-welcome-shown:usr_x:2026-09-15"])).toHaveLength(1);
    expect(personalLocalKeys(["rusofacil-sound-enabled"])).toHaveLength(0);
  });
});
