import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import WelcomeOverlay from "./WelcomeOverlay";
import { WELCOME_SHOWN_COOKIE, WELCOME_SHOWN_ENDPOINT, greetedOnAccountToday } from "@/lib/welcome-shown";
import { PERSONAL_LOCAL_PREFIXES } from "@/lib/signed-out-local";

/**
 * ПРИВЕТСТВИЕ ДНЯ ПРИХОДИТ ОДИН РАЗ В СУТКИ УЧЕНИКА — долг 223, 7.204.
 *
 * Стенд — ровно то, что владелец снял на видео 17.09.2026: бесплатный
 * аккаунт получил приветствие дважды за один местный день (00:40 и
 * ~03:25 по GMT+10), а между показами были ВЫХОД и повторный ВХОД.
 *
 * Выход здесь изображается тем, чем он и является в коде: уборкой
 * localStorage по списку `PERSONAL_LOCAL_PREFIXES` (7.199). Именно она и
 * съедала прежний замок, поэтому она же — положительный контроль: тест
 * «после выхода второго приветствия нет» обязан падать на замке в
 * localStorage и проходить на замке в куке.
 *
 * Полночь здесь МЕСТНАЯ, а не гринвичская: день приезжает готовым
 * (`todayKey`), посчитанным сервером в зоне аккаунта.
 *
 * ====================================================================
 * ВТОРОЙ СЛОЙ СТЕНДА — ОТМЕТКА НА АККАУНТЕ (долг 234, заход 7.206)
 * ====================================================================
 *
 * Кука — про устройство, и три случая она не закрывает: переустановка,
 * второй телефон и смена аккаунтов на одном устройстве. Правду держит
 * колонка `User.welcomeShownDateKey`, и здесь она изображена настоящей
 * парой «сервер + запрос»: `accountMarks` — это база, `fetch` на
 * `WELCOME_SHOWN_ENDPOINT` — запись в неё, а `greetedOnAccountToday` —
 * ровно то чтение, которое делает кабинет. Ни одного значения тест не
 * подставляет руками: всё, что он знает про аккаунт, приходит через тот
 * же путь, что и на проде.
 *
 * ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ этого слоя — `overlayBefore7206`, отрисовка БЕЗ
 * колонки (`greetedOnAccount` всегда `false`), то есть в точности
 * поведение 7.204. Проверки про A→B→A и про переустановку обязаны на ней
 * падать; не падающая проверка не судит ничего.
 */

const USER = "usr_vasya";
const DAY = "2026-09-17";
const NEXT_DAY = "2026-09-18";

/** «База»: какой день стоит отметкой у каждого аккаунта. */
const accountMarks = new Map<string, string>();
/** Зона аккаунта в этом стенде одна на все проверки: здесь судится
 *  порядок рубежей, а НЕ смена зоны посреди визита — та снята отдельно, в
 *  `src/lib/welcome-shown.test.ts` (долг 247). */
const ZONE = "Asia/Vladivostok";
/** Чей запрос сейчас летит: маршрут узнаёт человека по сессии, а не по
 *  телу, поэтому стенд держит «вошедшего» отдельно от разметки. */
let sessionUser = "";
let sessionDay = "";

function overlay(todayKey: string, userId = USER) {
  sessionUser = userId;
  sessionDay = todayKey;
  return (
    <WelcomeOverlay
      userId={userId}
      todayKey={todayKey}
      greetedOnAccount={greetedOnAccountToday({ welcomeShownDateKey: accountMarks.get(userId) ?? null }, todayKey, ZONE)}
      name="Vasya"
      currentStreak={3}
      greeting="¡Feliz nuevo día de ruso!"
      subtextActive="activo"
      subtextNew="nuevo"
      locale="es"
      streakDaysUnit={{ one: "día", few: "días", many: "días" }}
      continueLabel="Continuar"
    />
  );
}

/** Та же разметка, но БЕЗ колонки — код ровно такой, каким он был до
 *  захода 7.206. Служит положительным контролем. */
function overlayBefore7206(todayKey: string, userId = USER) {
  sessionUser = userId;
  sessionDay = todayKey;
  return (
    <WelcomeOverlay
      userId={userId}
      todayKey={todayKey}
      greetedOnAccount={false}
      name="Vasya"
      currentStreak={3}
      greeting="¡Feliz nuevo día de ruso!"
      subtextActive="activo"
      subtextNew="nuevo"
      locale="es"
      streakDaysUnit={{ one: "día", few: "días", many: "días" }}
      continueLabel="Continuar"
    />
  );
}

const shown = () => screen.queryAllByRole("dialog").length;

/** Выход из аккаунта так, как его делает продукт: чистка localStorage по
 *  списку 7.199. Куки он не трогает — и это ровно то, на чём стоит
 *  правка. */
function signOut() {
  for (const key of Object.keys(window.localStorage)) {
    if (PERSONAL_LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      window.localStorage.removeItem(key);
    }
  }
}

/** Переустановка приложения / другой телефон: стирается всё. Названо
 *  отдельно, потому что этот случай правка НЕ закрывает (долг 234). */
function wipeDevice() {
  window.localStorage.clear();
  for (const pair of document.cookie.split("; ")) {
    const name = pair.split("=")[0];
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
}

beforeEach(() => {
  wipeDevice();
  accountMarks.clear();
  // Запись отметки: маршрут сам считает день в зоне аккаунта и сам узнаёт
  // человека по сессии — здесь то же самое, тело запроса не читается.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url) === WELCOME_SHOWN_ENDPOINT) accountMarks.set(sessionUser, sessionDay);
      return { ok: true, json: async () => ({ ok: true }) } as unknown as Response;
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("приветствие дня", () => {
  it("первый заход в кабинет за день — приветствие есть", () => {
    render(overlay(DAY));
    expect(shown()).toBe(1);
  });

  it("второй заход в тот же местный день — приветствия нет", () => {
    render(overlay(DAY));
    cleanup();
    render(overlay(DAY));
    expect(shown()).toBe(0);
  });

  it("ВЫХОД И ВХОД в тот же день — приветствия второй раз нет (случай с видео)", () => {
    render(overlay(DAY));
    expect(shown()).toBe(1);
    cleanup();
    signOut();
    render(overlay(DAY));
    expect(shown()).toBe(0);
  });

  it("положительный контроль: прежний замок в localStorage выход НЕ переживал", () => {
    // Прежний код целиком, в двух строках: ключ с приставкой
    // `rf-welcome-shown:` и решение по его наличию.
    const legacyKey = `rf-welcome-shown:${USER}:${DAY}`;
    window.localStorage.setItem(legacyKey, "1");
    expect(window.localStorage.getItem(legacyKey)).toBe("1");
    signOut();
    expect(window.localStorage.getItem(legacyKey)).toBeNull(); // → показ второй раз
    // А нынешний замок ту же уборку переживает.
    render(overlay(DAY));
    cleanup();
    signOut();
    expect(document.cookie).toContain(WELCOME_SHOWN_COOKIE);
  });

  it("местная полночь — приветствие приходит снова", () => {
    render(overlay(DAY));
    cleanup();
    render(overlay(NEXT_DAY));
    expect(shown()).toBe(1);
  });

  it("второй человек на том же устройстве получает своё приветствие", () => {
    render(overlay(DAY));
    cleanup();
    render(overlay(DAY, "usr_maria"));
    expect(shown()).toBe(1);
  });

  // ——— ДОЛГ 234: замок про АККАУНТ ———

  it("A→B→A в один местный день — ровно одно приветствие каждому", () => {
    render(overlay(DAY, "usr_a"));
    expect(shown()).toBe(1);
    cleanup();
    signOut();

    render(overlay(DAY, "usr_b"));
    expect(shown()).toBe(1);
    cleanup();
    signOut();

    render(overlay(DAY, "usr_a"));
    expect(shown()).toBe(0); // A сегодня уже здоровался
  });

  it("положительный контроль: без колонки A→B→A здоровается с A дважды", () => {
    render(overlayBefore7206(DAY, "usr_a"));
    cleanup();
    signOut();
    render(overlayBefore7206(DAY, "usr_b"));
    cleanup();
    signOut();
    render(overlayBefore7206(DAY, "usr_a"));
    expect(shown()).toBe(1); // ровно та беда, ради которой заведён долг 234
  });

  it("переустановка приложения в тот же день — второго приветствия нет", () => {
    render(overlay(DAY));
    expect(shown()).toBe(1);
    cleanup();
    wipeDevice(); // куки и localStorage стёрты; отметка на аккаунте цела
    render(overlay(DAY));
    expect(shown()).toBe(0);
  });

  it("положительный контроль: без колонки переустановка здоровается снова", () => {
    render(overlayBefore7206(DAY));
    cleanup();
    wipeDevice();
    render(overlayBefore7206(DAY));
    expect(shown()).toBe(1);
  });

  it("новый местный день после A→B→A — каждому снова по одному", () => {
    render(overlay(DAY, "usr_a"));
    cleanup();
    signOut();
    render(overlay(DAY, "usr_b"));
    cleanup();
    signOut();

    render(overlay(NEXT_DAY, "usr_a"));
    expect(shown()).toBe(1);
    cleanup();
    signOut();
    render(overlay(NEXT_DAY, "usr_b"));
    expect(shown()).toBe(1);
  });

  it("сеть молчит — приветствие всё равно не чаще, чем было до 7.206", () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("сеть молчит"); }));
    render(overlay(DAY));
    expect(shown()).toBe(1);
    cleanup();
    // Отметка на аккаунт не легла, но кука на месте — второго показа на
    // ЭТОМ устройстве нет, ровно как в 7.204.
    render(overlay(DAY));
    expect(shown()).toBe(0);
  });
});
