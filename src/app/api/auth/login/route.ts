import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getRateLimiter, requestIp } from "@/lib/rate-limit";

/**
 * Mock login: finds or creates a user by email, no password. This stands
 * in for a real auth provider so the access-control flow below (proxy +
 * subscription checks) has a real signed-in user to evaluate.
 */
// No password means no failed-attempt signal to throttle on — the risk here
// is unlimited account creation (every new email upserts a User row), so
// this limits by IP rather than by account.
const loginLimiter = getRateLimiter("login", 60_000, 20);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;
  const redirectTo = String(formData.get("redirectTo") ?? `/${lang}/profile`);

  if (loginLimiter.check(requestIp(request))) {
    const url = new URL(`/${lang}/login`, request.url);
    url.searchParams.set("error", "rate_limited");
    return NextResponse.redirect(url, { status: 303 });
  }

  if (!email || !email.includes("@")) {
    const url = new URL(`/${lang}/login`, request.url);
    url.searchParams.set("error", "invalid_email");
    return NextResponse.redirect(url, { status: 303 });
  }

  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  await createSession(user.id);

  return NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 });
}
