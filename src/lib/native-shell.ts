import "server-only";
import { cookies, headers } from "next/headers";
import {
  NATIVE_SHELL_COOKIE,
  NATIVE_SHELL_COOKIE_VALUE,
  userAgentIsNativeShell,
} from "@/lib/native-shell-token";

/**
 * Признак того, что страницу открыл НЕ браузер, а нативная оболочка —
 * webview приложения из App Store или Google Play.
 *
 * Зачем это вообще нужно на сервере (долг 79). Оболочка Capacitor здесь
 * не несёт внутри себя сайт: она грузит боевой адрес удалённо
 * (`server.url` в `capacitor.config.ts`), то есть запрашивает ровно те же
 * страницы, что и обычный браузер, и получает ровно тот же HTML. Замер
 * 7.180: `/es/pricing`, запрошенная с User-Agent мобильного Safari,
 * отдавала те же ТРИ формы `action="/api/checkout"`, что и вебу. Внутри
 * приложения такая страница — не «неудобство», а отклонение на ревью:
 * App Store 3.1.1 и Google Play Payments запрещают уводить на внешнюю
 * оплату цифрового содержимого.
 *
 * ДВА ПРИЗНАКА, А НЕ ОДИН — И ЭТО ПРАВКА 13.09.2026 (заход 7.192, долг
 * 179). До неё признак был ровно один: токен {@link NATIVE_USER_AGENT_TOKEN}
 * в User-Agent запроса. Владелец увидел на живом телефоне (POCO X6 Pro,
 * сборка 7191) полную веб-страницу цен ВНУТРИ приложения — с
 * переключателем «Карта / Наличные», инструкцией OXXO и рабочей кнопкой
 * оплаты наличными, — то есть ровно то, что долг 79 объявлял закрытым.
 *
 * Почему одного токена мало по построению. Capacitor дописывает токен
 * ровно в одном месте — `WebSettings.setUserAgentString` у самого
 * webview (`Bridge.java:592…596` в `@capacitor/android`). Запрос, который
 * webview делает САМ, токен несёт. Запрос, который от его имени делает
 * НАШ service worker (`src/app/sw.ts`, стратегия NetworkFirst обслуживает
 * все переходы), уходит из контекста ServiceWorkerController — у него своя
 * `ServiceWorkerWebSettings`, к которой Capacitor не притрагивается и у
 * которой в Android вообще нет установщика User-Agent. Такой запрос
 * приходит к нам как обычный браузерный, и сервер честно отдаёт ему
 * веб-кассу. Ровно поэтому замер 7.184 (свежая установка, отладочный
 * сокет, воркер ещё не владеет страницей) прошёл, а живое приложение
 * через несколько запусков показало веб-кассу.
 *
 * Второй признак — КУКА {@link NATIVE_SHELL_COOKIE}. Куку ставит
 * `src/proxy.ts` на первом же запросе, который токен принёс (первый
 * запуск после установки — всегда прямой переход webview, воркера ещё
 * нет), и дублирует клиент (`src/components/NativeShellCookie.tsx`) по
 * `Capacitor.isNativePlatform()`. Куку браузер прикладывает к ЛЮБОМУ
 * запросу своего источника, включая тот, что делает service worker, —
 * поэтому дыра закрывается целиком, а не для одного пути.
 *
 * Развести это на КЛИЕНТЕ (`Capacitor.isNativePlatform()`) в одиночку
 * по-прежнему недостаточно: клиентская ветка убирает формы из ЖИВОГО DOM
 * после гидрации, но в ответе сервера они остаются, и ровно этот ответ
 * читает и человек с «просмотром исходного кода», и ревью магазина.
 *
 * Обычный браузер ни токена, ни куки не шлёт никогда, поэтому веб-ответ
 * от этой ветки не меняется ни на один байт.
 */
/**
 * Значения признаков живут в `src/lib/native-shell-token.ts` — без единого
 * серверного импорта, потому что их читает ещё и `src/proxy.ts`, а в
 * middleware `next/headers` запрещён. Здесь они только перевыставлены,
 * чтобы читателю этого модуля не приходилось знать про два файла.
 */
export {
  NATIVE_USER_AGENT_TOKEN,
  NATIVE_SHELL_COOKIE,
  NATIVE_SHELL_COOKIE_VALUE,
  NATIVE_SHELL_COOKIE_MAX_AGE,
  userAgentIsNativeShell,
} from "@/lib/native-shell-token";

/** true, если запрос пришёл из нативной оболочки приложения. */
export async function isNativeShellRequest(): Promise<boolean> {
  const ua = (await headers()).get("user-agent");
  if (userAgentIsNativeShell(ua)) return true;
  const cookie = (await cookies()).get(NATIVE_SHELL_COOKIE)?.value;
  return cookie === NATIVE_SHELL_COOKIE_VALUE;
}
