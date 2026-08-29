import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, isLocale, locales } from "@/i18n/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";
import { db } from "@/lib/db";
import { isStaff } from "@/lib/roles";

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

  const adminAccessDenied = await protectAdminRoute(request, segments);
  if (adminAccessDenied) return adminAccessDenied;

  // No `x-pathname` header any more. It existed so [lang]/layout.tsx could
  // build canonical/hreflang for every route from one place; reading it
  // there meant calling headers() inside a layout's generateMetadata, which
  // opts the whole route tree out of static rendering. Each route now
  // derives its own canonical from its own params (routeAlternates in
  // lib/site.ts), so nothing reads this header — setting it would only
  // rebuild the request headers on every request for no reader.
  return NextResponse.next();
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
