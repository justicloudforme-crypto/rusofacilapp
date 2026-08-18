import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { hashPassword, isPasswordStrongEnough } from "@/lib/password";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getRateLimiter, requestIp } from "@/lib/rate-limit";
import { captureReferralOnRegister } from "@/lib/referral";

const registerLimiter = getRateLimiter("register", 60_000, 10);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;
  const redirectTo = String(formData.get("redirectTo") ?? `/${lang}/profile`);
  const referralCode = String(formData.get("ref") ?? "");

  const fail = (error: string) => {
    const url = new URL(`/${lang}/register`, request.url);
    url.searchParams.set("error", error);
    if (redirectTo) url.searchParams.set("redirectTo", redirectTo);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (await registerLimiter.check(requestIp(request))) return fail("rate_limited");
  if (!email || !email.includes("@")) return fail("invalid_email");
  if (!isPasswordStrongEnough(password)) return fail("weak_password");

  const existing = await db.user.findUnique({ where: { email } });

  // An existing row with no password is a leftover from the old
  // passwordless demo-login flow, not a real registered account — this
  // request "claims" it by setting a password, rather than being blocked as
  // a duplicate. There's no email-verification step for registration itself
  // (unlike password-reset/account-deletion, which do use one — see
  // src/lib/verification-token.ts), so this trusts whoever controls the
  // email address right now — an acceptable gap pre-launch.
  if (existing?.passwordHash) return fail("email_taken");

  const passwordHash = await hashPassword(password);
  const user = existing
    ? await db.user.update({ where: { id: existing.id }, data: { passwordHash } })
    : await db.user.create({ data: { email, passwordHash } });

  // Referral attribution only applies to a genuinely new account — claiming
  // an old passwordless demo row isn't a new signup.
  if (!existing && referralCode) {
    await captureReferralOnRegister(user.id, referralCode);
  }

  await createSession(user.id, user.sessionVersion);

  return NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 });
}
