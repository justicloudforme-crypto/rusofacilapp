import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, isLocale, locales } from "@/i18n/config";
import { isLessonSlug, isLevelSlug } from "@/lib/courses";
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
 * a paying, non-expired subscription. This runs before the route renders,
 * so an unauthenticated or lapsed user never sees the lesson at all.
 *
 * 'owner' and 'admin' accounts bypass the subscription check entirely —
 * staff get full access to every lesson by default, no payment required.
 */
async function protectLessonRoute(request: NextRequest, segments: string[]) {
  const [lang, section, level, lesson] = segments;
  if (section !== "courses" || !isLevelSlug(level) || !isLessonSlug(level, lesson)) {
    return null;
  }

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

// Sections that now require an active, non-expired subscription for every
// route beneath them — including their own listing/catalog page, not just
// individual pieces of content. Vocabulary/Media/Word games had no gate
// at all before (open to every visitor); Stories had its own per-story
// free/premium split (most stories were deliberately free), which this
// supersedes — everything under /stories now needs a subscription too,
// same bar as the other three sections.
const GATED_SECTIONS = new Set(["vocabulary", "stories", "media", "word-games"]);

/**
 * Gate for /{lang}/vocabulary, /{lang}/stories, /{lang}/media, and
 * /{lang}/word-games — every route under these four sections, not just
 * individual lessons/puzzles/stories. Mirrors protectLessonRoute's shape
 * (staff bypass, redirect to /pricing) but matches on the section name
 * alone rather than a specific nested pattern, since the whole section is
 * gated here rather than just its content pages.
 */
async function protectContentRoute(request: NextRequest, segments: string[]) {
  const [lang, section] = segments;
  if (!section || !GATED_SECTIONS.has(section)) return null;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const parsed = token ? verifySessionToken(token) : null;
  if (!parsed) return redirectToPricing(request, lang);

  const user = await db.user.findUnique({
    where: { id: parsed.userId },
    select: { role: true, sessionVersion: true },
  });
  if (!user || user.sessionVersion !== parsed.sessionVersion) return redirectToPricing(request, lang);
  if (isStaff(user.role)) return null;

  const subscription = await lookupSubscriptionSafely(parsed.userId);

  if (!isSubscriptionActive(subscription)) return redirectToPricing(request, lang);

  return null;
}

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

  const contentAccessDenied = await protectContentRoute(request, segments);
  if (contentAccessDenied) return contentAccessDenied;

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
    "/((?!api/|_next/static|_next/image|favicon.ico|sw\\.js$|.*\\.(?:svg|png|jpg|jpeg|webp|ico|webmanifest|html|mp4|webm|mov|ogv|ogg|mp3|wav|m4a)$).*)",
  ],
};
