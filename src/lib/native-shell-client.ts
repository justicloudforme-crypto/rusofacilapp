"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  NATIVE_SHELL_COOKIE,
  NATIVE_SHELL_COOKIE_MAX_AGE,
  NATIVE_SHELL_COOKIE_VALUE,
} from "@/lib/native-shell-token";

/**
 * Клиентская половина признака нативной оболочки (долг 179).
 *
 * Серверная половина — `src/lib/native-shell.ts`; читать надо её, там
 * записано, почему признаков два и почему одного User-Agent мало.
 *
 * Здесь два дела, и оба маленькие:
 *   1. сказать компоненту, что он внутри приложения (нижняя панель
 *      перестаёт прятаться при прокрутке — решение владельца 13.09.2026);
 *   2. поставить ту же куку с клиента, если сервер её ещё не видел, —
 *      страховка на случай, когда самый первый запрос почему-то пришёл
 *      без токена (например, страницу отдал service worker из кеша).
 */
/** Стоит ли уже кука. `document.cookie` в SSR не существует — зовётся
 *  только из эффекта. */
export function nativeShellCookiePresent(): boolean {
  return document.cookie.split("; ").some((part) => part === `${NATIVE_SHELL_COOKIE}=${NATIVE_SHELL_COOKIE_VALUE}`);
}

/** Ставит куку. `secure` — только по https, ровно как в `src/proxy.ts`. */
export function setNativeShellCookie(): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${NATIVE_SHELL_COOKIE}=${NATIVE_SHELL_COOKIE_VALUE}; path=/; max-age=${NATIVE_SHELL_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/**
 * true, когда страница открыта в нативной оболочке.
 *
 * Отвечает `false` на первом рендере и на сервере и только потом, из
 * эффекта, говорит правду — иначе разошлась бы разметка гидрации:
 * `Capacitor.isNativePlatform()` на сервере не существует вовсе.
 */
export function useIsNativeShell(): boolean {
  const [native, setNative] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Capacitor.isNativePlatform() || nativeShellCookiePresent()) setNative(true);
  }, []);

  return native;
}
