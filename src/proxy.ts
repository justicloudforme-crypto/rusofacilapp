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
  const userId = token ? verifySessionToken(token) : null;
  if (!userId) return redirectToPricing(request, lang);

  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return redirectToPricing(request, lang);
  if (isStaff(user.role)) return null;

  const subscription = await db.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

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
  const userId = token ? verifySessionToken(token) : null;
  if (!userId) {
    const url = request.nextUrl.clone();
    url.pathname = `/${lang}/login`;
    url.search = "";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || !isStaff(user.role)) {
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
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|mp4|webm|mov|ogv|ogg|mp3|wav|m4a)$).*)",
  ],
};
