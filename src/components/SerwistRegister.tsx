"use client";

import { useEffect } from "react";
import { useSerwist } from "@serwist/next/react";
import * as Sentry from "@sentry/nextjs";
import {
  registerServiceWorkerOnce,
  type RegistrationOutcome,
  type ServiceWorkerRegistrationFailed,
} from "@/lib/sw-registration";

/**
 * `SerwistProvider` (см. [lang]/layout.tsx) смонтирован с `register={false}`,
 * и вебпак-плагин Serwist тоже отключён от регистрации (`register: false` в
 * next.config.ts) — единственный вызов `register()` в проекте живёт здесь.
 * Собственный путь библиотеки зовёт его как `void window.serwist.register()`
 * без `.catch()` (node_modules/@serwist/next/src/index.react.tsx), то есть
 * любой отказ уходил бы в браузер настоящим необработанным промисом.
 *
 * ВСЁ ПРАВИЛО — В `src/lib/sw-registration.ts`, ЗДЕСЬ ТОЛЬКО ПРОВОДКА.
 * Там же числа из Sentry, разбор «почему именно /login» и причина, по
 * которой отказ песочного обходчика поймать нечем. Компонент остаётся
 * тонким намеренно: у правила есть юнит-тест
 * (`src/lib/sw-registration.test.ts`), у компонента его быть не может без
 * настоящего браузера.
 */

/** Страница догрузилась целиком. Регистрация не должна соревноваться с ней за сеть. */
function pageLoaded(): Promise<void> {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
  });
}

function logSkip(reason: RegistrationOutcome): void {
  if (reason === "skipped-crawler") {
    console.warn("[serwist] Non-interactive crawler — skipping service worker registration.");
  }
  if (reason === "skipped-no-service-worker") {
    console.warn("[serwist] Service workers are unavailable here — continuing without offline caching.");
  }
}

export default function SerwistRegister() {
  const { serwist } = useSerwist();

  useEffect(() => {
    // Промис НАМЕРЕННО не привязан к жизни эффекта и не отменяется его
    // уборкой: уход со страницы во время регистрации не должен оставить
    // отказ без обработчика. Функция уборки здесь не возвращается вовсе.
    void registerServiceWorkerOnce({
      serwist,
      userAgent: navigator.userAgent,
      hasServiceWorker: "serviceWorker" in navigator,
      pageLoaded,
      swUrl: "/sw.js",
      onExpectedFailure: (error) => {
        console.warn(
          "[serwist] Service worker registration failed — continuing without offline caching.",
          error,
        );
      },
      onUnexpectedFailure: (error: ServiceWorkerRegistrationFailed) => {
        console.warn("[serwist] Service worker registration failed unexpectedly.", error);
        Sentry.captureException(error, {
          level: "warning",
          tags: { area: "service-worker-registration" },
        });
      },
      onSkip: logSkip,
    });
  }, [serwist]);

  return null;
}
