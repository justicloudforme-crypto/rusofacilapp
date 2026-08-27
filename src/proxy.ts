import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, isLocale, locales } from "@/i18n/config";
import { isLessonSlug, isLevelSlug, isFreeTrialLesson } from "@/lib/courses";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";
import { db } from "@/lib/db";
import { isSubscriptionActive } from "@/lib/subscription";
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

// A DB error here (e.g. schema drift between prisma/schema.prisma and the
// prod Turso DB, see the 2026-08-23 incident) must not 500 the middleware —
// this gate runs on nearly every route, so an unhandled throw would take
// down the whole site, not just one page. Fails closed (treated as "no
// subscription") so a paywalled route degrades to a pricing redirect
// instead of a raw 500, same behavior as a genuinely unsubscribed user.
async function lookupSubscriptionSafely(userId: string) {
  try {
    return await db.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("proxy: subscription lookup failed", error);
    return null;
  }
}

function redirectToPricing(request: NextRequest, lang: string) {
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}/pricing`;
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

/**
 * Gate for /{lang}/courses/{level}/{lesson} — the actual lesson content.
 * Course/level listing pages stay public; only individual lessons require
 * a paying, non-expired subscription — EXCEPT the one free-trial lesson
 * (isFreeTrialLesson, currently A1/1), which is public to anonymous
 * visitors too, same as free stories/media/word-game samples elsewhere.
 * This matters for SEO/crawlability: a lesson page that 307s every
 * logged-out request (including Googlebot) can never get indexed, and the
 * pricing page explicitly promises "1 free A1 lesson" without saying a
 * login is required to read it.
 *
 * 'owner' and 'admin' accounts bypass the subscription check entirely —
 * staff get full access to every lesson by default, no payment required.
 */
async function protectLessonRoute(request: NextRequest, segments: string[]) {
  const [lang, section, level, lesson] = segments;
  if (section !== "courses" || !isLevelSlug(level) || !isLessonSlug(level, lesson)) {
    return null;
  }

  if (isFreeTrialLesson(level, lesson)) return null;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const parsed = token ? verifySessionToken(token) : null;
  if (!parsed) return redirectToPricing(request, lang);

  const user = await db.user.findUnique({
    where: { id: parsed.userId },
    select: { role: true, sessionVersion: true },
  });
  // A version mismatch means this token predates a password change or
  // "sign out other devices" — treat it as no session, same as getCurrentUser
  // does (see src/lib/auth.ts), so a revoked session can't still pass this
  // gate even if the cookie itself is still a validly-signed token.
  if (!user || user.sessionVersion !== parsed.sessionVersion) return redirectToPricing(request, lang);
  if (isStaff(user.role)) return null;

  const subscription = await lookupSubscriptionSafely(parsed.userId);

  if (!isSubscriptionActive(subscription)) return redirectToPricing(request, lang);

  return null;
}

// No section is blanket-gated here any more as of 2026-08-24: Vocabulary/
// Stories/Word games/Media each has its own fixed free-trial sample
// enforced deeper in the stack instead of a section-wide block —
// GET /api/flashcards and GET /api/idioms cap results to FREE_TRIAL_LIMITS
// for a non-entitled caller (src/lib/entitlement.ts), the story reader page
// checks Story.isPremium per row (prisma/set-free-trial-stories.ts), the
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

  const lessonAccessDenied = await protectLessonRoute(request, segments);
  if (lessonAccessDenied) return lessonAccessDenied;

  const adminAccessDenied = await protectAdminRoute(request, segments);
  if (adminAccessDenied) return adminAccessDenied;

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
