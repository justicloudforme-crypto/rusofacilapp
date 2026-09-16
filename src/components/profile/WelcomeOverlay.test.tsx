import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import WelcomeOverlay from "./WelcomeOverlay";
import { WELCOME_SHOWN_COOKIE } from "@/lib/welcome-shown";
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
 */

const USER = "usr_vasya";
const DAY = "2026-09-17";
const NEXT_DAY = "2026-09-18";

function overlay(todayKey: string, userId = USER) {
  return (
    <WelcomeOverlay
      userId={userId}
      todayKey={todayKey}
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

beforeEach(() => wipeDevice());
afterEach(() => cleanup());

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
});
