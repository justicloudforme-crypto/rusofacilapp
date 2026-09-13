"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { nativeShellCookiePresent, setNativeShellCookie } from "@/lib/native-shell-client";

/**
 * Страховка признака нативной оболочки (долг 179).
 *
 * Обычный путь такой: первый запрос приложения несёт токен в User-Agent,
 * `src/proxy.ts` видит его и ставит куку, дальше оболочку узнают по куке —
 * в том числе на переходах, которые делает service worker и которые токена
 * не несут. Разбор, почему так, — в шапке `src/lib/native-shell.ts`.
 *
 * Остаётся один случай, который этим не закрыт: страницу отдал воркер из
 * своего кеша, к серверу запрос не ходил вовсе, и куку ставить было некому.
 * Тогда её ставит этот компонент — он знает про оболочку без всякого
 * запроса, напрямую от Capacitor.
 *
 * `router.refresh()` после установки — потому что документ, который человек
 * уже видит, отрисован сервером, НЕ знавшим про оболочку. Один раз за
 * запуск: флажок в `sessionStorage` не даёт этому стать петлёй, если
 * сервер по какой-то причине куку не примет.
 */
const ONCE_KEY = "rf-native-shell-refreshed";

export default function NativeShellCookie() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (nativeShellCookiePresent()) return;
    setNativeShellCookie();
    let already = false;
    try {
      already = sessionStorage.getItem(ONCE_KEY) === "1";
      sessionStorage.setItem(ONCE_KEY, "1");
    } catch {
      // Приватный режим/запрет хранилища — тогда просто не обновляемся:
      // следующий переход всё равно уедет на сервер уже с кукой.
      already = true;
    }
    if (!already) router.refresh();
  }, [router]);

  return null;
}
