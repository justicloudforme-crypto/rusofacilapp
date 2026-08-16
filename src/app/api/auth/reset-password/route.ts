import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, isPasswordStrongEnough } from "@/lib/password";
import { decodeVerificationToken, matchesCurrentPassword } from "@/lib/verification-token";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getRateLimiter, requestIp } from "@/lib/rate-limit";

const resetLimiter = getRateLimiter("resetPassword", 60_000, 20);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;

  const fail = (error: string) => {
    const url = new URL(`/${lang}/reset-password`, request.url);
    url.searchParams.set("token", token);
    url.searchParams.set("error", error);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (resetLimiter.check(requestIp(request))) return fail("rate_limited");
  if (!isPasswordStrongEnough(password)) return fail("weak_password");

  const decoded = decodeVerificationToken(token, "password_reset");
  if (!decoded) return fail("invalid_token");

  const user = await db.user.findUnique({ where: { id: decoded.userId } });
  if (!user?.passwordHash || !matchesCurrentPassword(decoded.fingerprint, user.passwordHash)) {
    return fail("invalid_token");
  }

  const passwordHash = await hashPassword(password);
  // Bumping sessionVersion here (not just changing the password) signs out
  // every device that was logged in — appropriate for a reset specifically,
  // since the whole point is "I may not be the only one who could get in
  // right now." A user changing a password they still remember uses
  // change-password instead, which keeps the current device signed in.
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  });

  return NextResponse.redirect(new URL(`/${lang}/login?reset=success`, request.url), { status: 303 });
}
