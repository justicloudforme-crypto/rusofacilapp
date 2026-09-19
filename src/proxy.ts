import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, isLocale, locales } from "@/i18n/config";
import { localeForPrefixlessPath } from "@/lib/locale-decision";
import { LOCALE_HEADER, NOT_FOUND_REWRITE_SEGMENT } from "@/lib/locale-header";
import { isSpanishOnlyRoute } from "@/lib/spanish-only-routes";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";
import { db } from "@/lib/db";
import { isStaff } from "@/lib/roles";
import { APEX_REDIRECT_STATUS, apexRedirectTarget } from "@/lib/canonical-host";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  localeOfPath,
} from "@/lib/remembered-locale";
import {
  NATIVE_SHELL_COOKIE,
  NATIVE_SHELL_COOKIE_MAX_AGE,
  NATIVE_SHELL_COOKIE_VALUE,
  userAgentIsNativeShell,
} from "@/lib/native-shell-token";

// ПОРЯДОК ИСТОЧНИКОВ ЯЗЫКА ЖИВЁТ В `src/lib/locale-decision.ts` (7.214).
// Здесь остаётся только СБОР фактов: что лежит в куке и что пришло в
// заголовке. Ни выбора, ни `??` между источниками в этом файле больше
// нет — иначе порядок можно поменять местами, и ни один прогон не
// покраснеет. Полный разбор и замер на проде — в шапке того модуля.
function localeForRoot(request: NextRequest): string {
  return localeForPrefixlessPath({
    remembered: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });
}

// No section is blanket-gated here any more as of 2026-08-28 (lessons were
// the last holdout — see [lesson]/page.tsx's own comment on why its gate
// moved from a middleware redirect here to page-level content locking):
// Vocabulary/Stories/Word games/Media/Courses each has its own fixed
// free-trial sample enforced deeper in the stack instead of a section-wide
// block — GET /api/flashcards and GET /api/idioms cap results to
// FREE_TRIAL_LIMITS for a non-entitled caller (src/lib/entitlement.ts), the
// story reader page checks Story.isPremium per row (prisma/set-free-trial-stories.ts), the
// word-game puzzle page checks isFreeWordGamePuzzle, and the media detail
// page checks MediaItem.free (a curated ~7-item sample, see
// src/lib/media/mediaData.json). A blanket section-wide block would make
// all of that unreachable for exactly the visitors it's meant to reach.

/**
 * Gate for /{lang}/admin and everything under it. Only 'owner' and 'admin'
 * roles get in; everyone else (including logged-out visitors) is bounced
 * before the dashboard ever renders. Fine-grained checks (e.g. the
 * owner-only Users & Roles section) happen inside the pages themselves.
 */
async function protectAdminRoute(request: NextRequest, segments: string[]) {
  const [lang, section] = segments;
  if (section !== "admin") return null;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const parsed = token ? verifySessionToken(token) : null;
  if (!parsed) {
    const url = request.nextUrl.clone();
    url.pathname = `/${lang}/login`;
    url.search = "";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const user = await db.user.findUnique({
    where: { id: parsed.userId },
    select: { role: true, sessionVersion: true },
  });
  if (!user || user.sessionVersion !== parsed.sessionVersion || !isStaff(user.role)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${lang}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return null;
}

/**
 * ГОСТЬ УХОДИТ С КАБИНЕТА НА ВХОД ОТВЕТОМ СЕРВЕРА — 7.201, долг 226.
 *
 * ЧТО БЫЛО ИЗМЕРЕНО (прод, 16.09.2026, без сессии). `GET /ru/profile`
 * отвечал **200**, а не переадресацией, и в теле стояло
 * `<meta http-equiv="refresh" content="1;url=/ru/login?redirectTo=/ru/profile">`;
 * то же на `/es/profile` и, через 307 со страницы-псевдонима, на обоих
 * адресах `account`. Человек получал целый документ на 147 КиБ и уходил на
 * вход ЧЕРЕЗ СЕКУНДУ после его загрузки.
 *
 * ПОЧЕМУ ТАК ВЫХОДИЛО. Рядом с `[lang]/profile/page.tsx` лежит
 * `loading.tsx` — единственный в проекте. Next оборачивает такую страницу
 * в Suspense и отдаёт оболочку документа клиенту ДО того, как страница
 * дочитает `getCurrentUser()`; после первого байта настоящей
 * 307-переадресации уже не сделать, и `redirect()` из тела страницы
 * вырождается в `<meta refresh>`. Проверено: перенос той же проверки в
 * `layout.tsx` рядом со страницей НЕ помогает — макет отдаётся тем же
 * потоком (замер: мета-обновление осталось на всех четырёх адресах).
 * Помогает только ответ, данный ДО рендера, — то есть здесь.
 *
 * ЧЕМ ЭТО ПЛОХО ПРИБОРУ. Перепись платных поверхностей открывает экран,
 * ждёт `domcontentloaded` и переписывает органы через `page.evaluate` —
 * единственный вызов Playwright без своего срока. Мета-обновление срывает
 * исполняемый контекст ровно на 1000-й миллисекунде, то есть посреди этой
 * переписи, и на бегунке CI ожидание нового контекста бесконечно. Отсюда
 * «/ru/account (guest): экран не ответил за 240 с» — три красных прогона
 * доли 3/3 из четырёх.
 *
 * ПОЧЕМУ ПРОВЕРКА ТОЛЬКО ПО ТОКЕНУ, БЕЗ ЧТЕНИЯ БАЗЫ. Ровно как первая
 * половина `protectAdminRoute` выше: подписанного токена нет — человек
 * заведомо гость, и это единственный случай, который вообще попадает на
 * этот путь. Токен с устаревшим `sessionVersion` (пароль сменили на другом
 * устройстве) проверку проходит и упирается в проверку самой страницы —
 * там останется прежнее мета-обновление; платить за этот редкий случай
 * лишним чтением базы на КАЖДОМ открытии кабинета дороже, чем он стоит.
 *
 * КУДА ВЕДЁТ `redirectTo`. Туда, куда человек шёл: кабинет — это
 * `/[lang]/profile`, а `/[lang]/account` только его псевдоним. Запрос
 * сохраняется целиком, иначе гость, вернувшийся из кассы с
 * `?checkout=success`, потерял бы исход покупки на входе.
 */
function protectCabinetRoute(request: NextRequest, segments: string[]) {
  const [lang, section] = segments;
  if (section !== "profile" && section !== "account") return null;
  if (!isLocale(lang)) return null;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && verifySessionToken(token)) return null;

  const url = request.nextUrl.clone();
  const search = request.nextUrl.search;
  url.pathname = `/${lang}/login`;
  url.search = "";
  url.searchParams.set("redirectTo", `/${lang}/profile${search}`);
  return NextResponse.redirect(url);
}

async function route(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Сведение www к апексу — ПЕРВЫМ, до всего остального.
  //
  // Порядок здесь и есть смысл правки: если бы проверка хоста стояла
  // после локального редиректа, запрос на `www.…/pricing` сначала уехал
  // бы на `www.…/es/pricing` и только потом на апекс — две «постоянные»
  // ссылки вместо одной, и обе на несуществующем каноническом хосте.
  // Сейчас цепочка ровно одна, и её конец совпадает с тем, что написано
  // в `rel=canonical` этой же страницы (обе строки из `SITE_URL`).
  //
  // Рама не тронута: ни один заголовок ответа, ни один рендер, ни одна
  // страница отсюда не меняется. Для запроса на апекс функция ниже
  // возвращает null, и ветка не выполняется вовсе — 330 замороженных
  // URL живут на апексе и в неё не попадают по построению.
  //
  // Чего эта правка НЕ покрывает, в отличие от настройки домена в
  // Vercel: matcher ниже нарочно исключает `/robots.txt`, `/sitemap.xml`
  // и статику, так что `www.…/sitemap.xml` останется отвечать 200. Это
  // осознанно и безвредно — оба файла на обоих хостах побайтово
  // одинаковы и называют только апекс, — но полное сведение хоста
  // делается на границе, а не здесь.
  const apex = apexRedirectTarget(request.headers.get("host"), pathname, request.nextUrl.search);
  if (apex) return NextResponse.redirect(apex, APEX_REDIRECT_STATUS);

  const pathnameHasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (!pathnameHasLocale) {
    // ЗАПОМНЕННЫЙ ВЫБОР ИДЁТ ПЕРВЫМ, ЗАГОЛОВОК УСТРОЙСТВА — ВТОРЫМ,
    // МОЛЧАЛИВЫЙ ОТВЕТ ТРЕТЬИМ (7.198 часть 3 «а», порядок накрыт
    // сторожем `check:locale-priority` в 7.214).
    //
    // Наблюдение владельца 18.09.2026 — испанский телефон, голый адрес,
    // человек попал на `/ru` — это ПРАВИЛЬНОЕ поведение, а не дефект:
    // выбор человека сильнее языка устройства. Оболочка грузит именно
    // этот адрес —
    // корневой, без локали, — и до правки решение принимал только
    // `Accept-Language`, то есть язык ТЕЛЕФОНА. Поэтому выбранный
    // русский не переживал ни одного перезапуска приложения.
    //
    // Ничего не запомнено — прежнее поведение слово в слово. Полный
    // разбор и границы — в шапке `src/lib/remembered-locale.ts`.
    const locale = localeForRoot(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  const segments = pathname.split("/").filter(Boolean);

  // Локаль пути — единственному читателю, странице 404.
  //
  // `src/app/global-not-found.tsx` рисует свой документ и пропсов не
  // получает вовсе: ни `params`, ни адреса у страницы ошибки нет, и язык
  // человека взять больше негде (долг 129). Поэтому здесь — ровно одно
  // значение и ровно для неё; все остальные страницы локаль получают
  // параметром маршрута и этот заголовок не читают.
  //
  // Почему это не возвращение `x-pathname` (см. абзац ниже): тот был
  // заголовком БЕЗ читателя, и читали его там, где нельзя — в
  // `generateMetadata` корневого layout'а, что выключало статический
  // рендер всему дереву. Здесь читатель один и он вне layout'а.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, segments[0] ?? defaultLocale);

  // Испанские маршруты, запрошенные под `/ru`, — на нашу страницу 404.
  //
  // Их 16 в списке и 39 живых адресов (`SPANISH_ONLY_ROUTES`, долг 127);
  // каждый стоит под `if (lang !== "es") notFound()` в своей `page.tsx`.
  // Код ответа у них и был, и остаётся 404 — меняется только то, ЧТО
  // человек видит: `notFound()`, брошенный внутри маршрута, в этом
  // приложении не умеет нарисовать документ вовсе (причина и замер — в
  // шапке `src/app/global-not-found.tsx`), и до этого захода такой адрес
  // отдавал пустую страницу. Переписывание на несовпадающий путь уводит
  // ответ на тот же внутренний маршрут 404, которым отвечают опечатки, —
  // и человек получает нашу страницу с рамой, нужным языком и ссылками.
  //
  // Адрес в строке браузера не меняется: это rewrite, а не redirect.
  if (segments[0] && segments[0] !== "es") {
    const pathWithoutLocale = "/" + segments.slice(1).join("/");
    if (isSpanishOnlyRoute(pathWithoutLocale)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${segments[0]}/${NOT_FOUND_REWRITE_SEGMENT}`;
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }
  }

  const adminAccessDenied = await protectAdminRoute(request, segments);
  if (adminAccessDenied) return adminAccessDenied;

  const cabinetAccessDenied = protectCabinetRoute(request, segments);
  if (cabinetAccessDenied) return cabinetAccessDenied;


  // No `x-pathname` header any more. It existed so [lang]/layout.tsx could
  // build canonical/hreflang for every route from one place; reading it
  // there meant calling headers() inside a layout's generateMetadata, which
  // opts the whole route tree out of static rendering. Each route now
  // derives its own canonical from its own params (routeAlternates in
  // lib/site.ts), so nothing reads this header — setting it would only
  // rebuild the request headers on every request for no reader.
  return NextResponse.next({ request: { headers: requestHeaders } });
}

/**
 * ОБЁРТКА, КОТОРАЯ ПРЕДСТАВЛЯЕТ ОБОЛОЧКУ СЕРВЕРУ НАДОЛГО (долг 179).
 *
 * Токен нативной оболочки в User-Agent несут только те запросы, которые
 * webview делает САМ. Переход, который от его имени выполняет наш service
 * worker (`src/app/sw.ts`), уходит из другого контекста и токена не несёт
 * вовсе — Capacitor ставит User-Agent ровно на `WebSettings` самого
 * webview (`Bridge.java:592…596`), а у ServiceWorkerController свои
 * настройки, в которых установщика User-Agent в Android нет. Полный разбор
 * — в шапке `src/lib/native-shell.ts`.
 *
 * Поэтому первый же запрос с токеном (после установки он всегда прямой:
 * воркера ещё нет) оставляет КУКУ, и дальше оболочку узнают по ней — куку
 * браузер прикладывает к любому запросу своего источника, включая запросы
 * service worker'а.
 *
 * Кука ставится на ЛЮБОМ ответе, включая редиректы: первый запрос
 * приложения идёт на `https://rusofacilapp.com/` без локали и получает
 * здесь 307 на `/es` или `/ru`. Стой запись куки только на `next()`,
 * самый первый — и единственный гарантированно прямой — запрос её бы и
 * потерял.
 */
export async function proxy(request: NextRequest) {
  const response = await route(request);

  // ЗАПОМИНАНИЕ ЯЗЫКА. Пишется ровно тогда, когда значение изменилось —
  // тем же правилом, что и кука ниже: ответ без `Set-Cookie` остаётся
  // побайтово прежним, и ни один из 330 замороженных адресов от этой
  // строки не двигается.
  const visited = localeOfPath(request.nextUrl.pathname);
  if (visited && request.cookies.get(LOCALE_COOKIE)?.value !== visited) {
    response.cookies.set(LOCALE_COOKIE, visited, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
      // Как и у куки признака оболочки: `secure` берётся у самого
      // запроса, иначе на прогоне verify по http://localhost:3123 кука
      // не доехала бы ни до одной страницы и сторож мерил бы
      // собственную ошибку.
      secure: request.nextUrl.protocol === "https:",
      httpOnly: false,
    });
  }

  if (
    userAgentIsNativeShell(request.headers.get("user-agent")) &&
    request.cookies.get(NATIVE_SHELL_COOKIE)?.value !== NATIVE_SHELL_COOKIE_VALUE
  ) {
    response.cookies.set(NATIVE_SHELL_COOKIE, NATIVE_SHELL_COOKIE_VALUE, {
      path: "/",
      maxAge: NATIVE_SHELL_COOKIE_MAX_AGE,
      sameSite: "lax",
      // `secure` берётся у самого запроса, а не пишется константой: на
      // прогоне verify сервер поднят по http://localhost:3123, и кука с
      // `secure: true` там не доехала бы ни до одной страницы — сторож
      // мерил бы собственную ошибку.
      secure: request.nextUrl.protocol === "https:",
      httpOnly: false,
    });
  }
  return response;
}

export const config = {
  matcher: [
    // Root-level PWA files (manifest.ts → /manifest.webmanifest, icon.png,
    // and the Serwist-generated /sw.js — see next.config.ts) live outside
    // [lang] on purpose: a manifest/service-worker URL is a fixed contract
    // with the browser, not a page, so it must never get locale-prefixed.
    // public/offline.html (the ".html" extension below) joins them for the
    // same reason — it's the Service Worker's precached navigation fallback
    // (see sw.ts's `fallbacks` config), served in place of whatever page the
    // browser actually asked for while offline, so it must live at one
    // fixed, locale-independent URL that's known at precache time.
    // robots.ts (→ /robots.txt) and sitemap.ts (→ /sitemap.xml) join them
    // for the same reason — a crawler's contract URLs, not pages, so
    // "robots\\.txt$"/"sitemap\\.xml$" are excluded by name (not by the
    // shared extension list, since ".txt"/".xml" pages don't otherwise
    // exist on this site and shouldn't be exempted wholesale).
    "/((?!api/|_next/static|_next/image|favicon.ico|sw\\.js$|robots\\.txt$|sitemap\\.xml$|.*\\.(?:svg|png|jpg|jpeg|webp|ico|webmanifest|html|mp4|webm|mov|ogv|ogg|mp3|wav|m4a)$).*)",
  ],
};
