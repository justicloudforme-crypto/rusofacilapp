import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { hashPassword, isPasswordStrongEnough } from "@/lib/password";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getRateLimiter, requestIp } from "@/lib/rate-limit";
import { captureReferralOnRegister } from "@/lib/referral";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { readRequestForm } from "@/lib/request-form";

const registerLimiter = getRateLimiter("register", 60_000, 10);

export async function POST(request: NextRequest) {
  const read = await readRequestForm(request);
  if (!read.ok) return read.response;
  const formData = read.form;
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

  // The e2e suite creates a throwaway account per test (see
  // e2e/helpers/auth.ts) — fullyParallel workers registering from the
  // same localhost IP blow past this limiter's real-world budget almost
  // immediately. Bypassed only when E2E_TEST_SEED is set, which is only
  // ever true for the server playwright.config.ts's webServer spawns for
  // a test run (see its `env`), never on a real deployment.
  const isE2ETestRun = process.env.E2E_TEST_SEED === "1";
  if (!isE2ETestRun && (await registerLimiter.check(requestIp(request)))) return fail("rate_limited");
  if (!email || !email.includes("@")) return fail("invalid_email");
  if (!isPasswordStrongEnough(password)) return fail("weak_password");

  const existing = await db.user.findUnique({ where: { email } });

  // Адрес уже занят — регистрация не создаёт вторую учётку и не трогает
  // существующую.
  //
  // До 7.267 строка БЕЗ пароля «присваивалась»: регистрация ставила ей
  // пароль без всякой проверки почты (наследие демо-входа без пароля). С
  // входом через Google строка без пароля — это настоящая учётка человека,
  // и присвоение стало бы захватом: кто угодно, набрав чужой адрес Gmail,
  // получил бы чужой прогресс и подписку. Замер прода 7.267: таких строк
  // 0 из 36, то есть живого поведения эта правка не меняет. Пароль такой
  // учётке заводится только ссылкой из письма («¿Olvidaste tu contraseña?»,
  // `/api/auth/forgot-password`) — то есть тем, у кого почта.
  if (existing) return fail(existing.passwordHash ? "email_taken" : "account_exists_no_password");

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({ data: { email, passwordHash } });

  if (referralCode) {
    await captureReferralOnRegister(user.id, referralCode);
  }

  await createSession(user.id, user.sessionVersion);

  // See safe-redirect.ts — redirectTo is client-supplied and must not be
  // trusted as-is, same open-redirect risk as /api/auth/login.
  const target = safeRedirectPath(redirectTo, request.url, `/${lang}/profile`);
  return NextResponse.redirect(new URL(target, request.url), { status: 303 });
}
