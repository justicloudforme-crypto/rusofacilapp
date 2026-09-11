import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, isLocale, locales } from "@/i18n/config";
import { LOCALE_HEADER, NOT_FOUND_REWRITE_SEGMENT } from "@/lib/locale-header";
import { isSpanishOnlyRoute } from "@/lib/spanish-only-routes";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";
import { db } from "@/lib/db";
import { isStaff } from "@/lib/roles";
import { APEX_REDIRECT_STATUS, apexRedirectTarget } from "@/lib/canonical-host";

function getPreferredLocale(request: NextRequest): string {
  const header = request.headers.get("accept-language");
  if (!header) return defaultLocale;

  const preferred = header
    .split(",")
    .map((part) => part.split(";")[0]?.trim().toLowerCase())
    .filter(Boolean);

  for (const lang of preferred) {
    const short = lang.split("-")[0];
    if (isLocale(short)) return short;
  }

  return defaultLocale;
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

export async function proxy(request: NextRequest) {
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
    const locale = getPreferredLocale(request);
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


  // No `x-pathname` header any more. It existed so [lang]/layout.tsx could
  // build canonical/hreflang for every route from one place; reading it
  // there meant calling headers() inside a layout's generateMetadata, which
  // opts the whole route tree out of static rendering. Each route now
  // derives its own canonical from its own params (routeAlternates in
  // lib/site.ts), so nothing reads this header — setting it would only
  // rebuild the request headers on every request for no reader.
  return NextResponse.next({ request: { headers: requestHeaders } });
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
