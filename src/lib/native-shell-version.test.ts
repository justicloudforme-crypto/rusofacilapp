/**
 * ВЕРСИЯ ОБОЛОЧКИ — ОДНА ФУНКЦИЯ ЧТЕНИЯ И ЕЁ ПРАВИЛА (долг 235, заход
 * 7.223).
 *
 * Главное утверждение этого файла — не «новая оболочка читается», а
 * СТАРАЯ. Сборка 7202 (`versionCode 2`) лежит в закрытом тесте Google
 * Play у 25 тестировщиков, обновятся они не в один день, и обе сборки
 * будут жить одновременно. Сайт, который на старом токене отвечает
 * `null` или бросает, — это сломанное приложение у половины теста.
 */
import { describe, it, expect } from "vitest";
import {
  LEGACY_NATIVE_SHELL_VERSION,
  MIN_SUPPORTED_NATIVE_SHELL_VERSION,
  NATIVE_SHELL_COOKIE_VALUE,
  NATIVE_USER_AGENT_TOKEN,
  nativeShellAtLeast,
  nativeShellVersion,
  userAgentIsNativeShell,
} from "@/lib/native-shell-token";

/** Настоящая строка User-Agent webview Android с дописанным токеном.
 *  Не «RFNativeShell» в одиночку: токен приезжает В КОНЦЕ длинной
 *  строки, и регулярка обязана работать именно так. */
const CHROME =
  "Mozilla/5.0 (Linux; Android 16; 23113RKC6G) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Mobile Safari/537.36";
const UA_7202 = `${CHROME} ${NATIVE_USER_AGENT_TOKEN}`;
const UA_V3 = `${CHROME} ${NATIVE_USER_AGENT_TOKEN}/3`;

describe("nativeShellVersion", () => {
  it("браузер — не оболочка ни одной версии", () => {
    expect(nativeShellVersion({ userAgent: CHROME })).toBeNull();
    expect(nativeShellVersion({})).toBeNull();
    expect(nativeShellVersion({ userAgent: null, versionCookie: null, shellCookie: null })).toBeNull();
  });

  it("СТАРАЯ ОБОЛОЧКА 7202: токен без числа читается как версия 2", () => {
    expect(userAgentIsNativeShell(UA_7202)).toBe(true);
    expect(nativeShellVersion({ userAgent: UA_7202 })).toBe(LEGACY_NATIVE_SHELL_VERSION);
    expect(LEGACY_NATIVE_SHELL_VERSION).toBe(2);
  });

  it("новая оболочка: число берётся из токена", () => {
    expect(nativeShellVersion({ userAgent: UA_V3 })).toBe(3);
    // Признак оболочки от добавленной версии не пострадал — иначе
    // нативная витрина исчезла бы ровно на обновлении.
    expect(userAgentIsNativeShell(UA_V3)).toBe(true);
  });

  it("токен главнее куки: на обновлении правда в ЭТОМ запросе", () => {
    expect(nativeShellVersion({ userAgent: UA_V3, versionCookie: "2" })).toBe(3);
    expect(nativeShellVersion({ userAgent: UA_7202, versionCookie: "3" })).toBe(2);
  });

  it("запрос service worker'а: токена нет, версию несёт кука", () => {
    expect(nativeShellVersion({ userAgent: CHROME, versionCookie: "3" })).toBe(3);
  });

  it("запрос service worker'а СТАРОЙ сборки: куки версии нет, признак есть", () => {
    expect(
      nativeShellVersion({ userAgent: CHROME, shellCookie: NATIVE_SHELL_COOKIE_VALUE }),
    ).toBe(LEGACY_NATIVE_SHELL_VERSION);
  });

  it("мусор в куке не становится версией", () => {
    for (const bad of ["", "3.0", "-1", "0", "v3", "3a", "١٢", " 3", "3 ", "Infinity"]) {
      expect(nativeShellVersion({ userAgent: CHROME, versionCookie: bad })).toBeNull();
    }
  });

  it("мусор в куке не отменяет признак оболочки", () => {
    expect(
      nativeShellVersion({
        userAgent: CHROME,
        versionCookie: "не число",
        shellCookie: NATIVE_SHELL_COOKIE_VALUE,
      }),
    ).toBe(LEGACY_NATIVE_SHELL_VERSION);
  });

  it("двузначные и большие номера читаются целиком", () => {
    expect(nativeShellVersion({ userAgent: `${CHROME} ${NATIVE_USER_AGENT_TOKEN}/42` })).toBe(42);
    expect(nativeShellVersion({ userAgent: `${CHROME} ${NATIVE_USER_AGENT_TOKEN}/1024` })).toBe(1024);
  });
});

describe("nativeShellAtLeast", () => {
  it("браузер не является оболочкой никакой версии", () => {
    expect(nativeShellAtLeast(1, { userAgent: CHROME })).toBe(false);
    expect(nativeShellAtLeast(0, { userAgent: CHROME })).toBe(false);
  });

  it("равная и старшая версии проходят, младшая — нет", () => {
    expect(nativeShellAtLeast(3, { userAgent: UA_V3 })).toBe(true);
    expect(nativeShellAtLeast(2, { userAgent: UA_V3 })).toBe(true);
    expect(nativeShellAtLeast(4, { userAgent: UA_V3 })).toBe(false);
  });

  it("минимум поддержки равен версии 7202 — блокирующего экрана не получит никто", () => {
    expect(MIN_SUPPORTED_NATIVE_SHELL_VERSION).toBe(LEGACY_NATIVE_SHELL_VERSION);
    expect(nativeShellAtLeast(MIN_SUPPORTED_NATIVE_SHELL_VERSION, { userAgent: UA_7202 })).toBe(true);
    expect(nativeShellAtLeast(MIN_SUPPORTED_NATIVE_SHELL_VERSION, { userAgent: UA_V3 })).toBe(true);
  });
});
