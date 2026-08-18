import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getRateLimiter, requestIp } from "@/lib/rate-limit";
import { safeRedirectPath } from "@/lib/safe-redirect";

/**
 * Real email+password login (see src/lib/password.ts). Two rate limiters:
 * by IP (stops one attacker from hammering many accounts) and by email
 * (stops distributed attempts against one account from many IPs) — neither
 * alone covers both directions.
 */
const loginLimiterByIp = getRateLimiter("loginByIp", 60_000, 20);
const loginLimiterByEmail = getRateLimiter("loginByEmail", 10 * 60_000, 10);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;
  const redirectTo = String(formData.get("redirectTo") ?? `/${lang}/profile`);

  const fail = (error: string) => {
    const url = new URL(`/${lang}/login`, request.url);
    url.searchParams.set("error", error);
    if (redirectTo) url.searchParams.set("redirectTo", redirectTo);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (await loginLimiterByIp.check(requestIp(request))) return fail("rate_limited");
  if (!email || !email.includes("@")) return fail("invalid_email");
  if (await loginLimiterByEmail.check(email)) return fail("rate_limited");

  const user = await db.user.findUnique({ where: { email } });

  // Same generic error whether the email doesn't exist, has no password set
  // yet (a legacy demo-mode account), or the password is simply wrong — so
  // a failed attempt never reveals which of those is true (no account
  // enumeration via the error message).
  if (!user || !user.passwordHash) return fail("invalid_credentials");
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return fail("invalid_credentials");

  await createSession(user.id, user.sessionVersion);

  // redirectTo is client-supplied (a query param echoed into a hidden form
  // field) — resolving it without checking where it actually points would
  // make this an open redirect: a link to OUR login page that, after a
  // real login with real credentials, silently bounces the user to an
  // attacker's site. See safe-redirect.ts.
  const target = safeRedirectPath(redirectTo, request.url, `/${lang}/profile`);
  return NextResponse.redirect(new URL(target, request.url), { status: 303 });
}
