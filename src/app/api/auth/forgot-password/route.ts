import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { signVerificationToken } from "@/lib/verification-token";
import { sendEmail } from "@/lib/email";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getRateLimiter, requestIp } from "@/lib/rate-limit";

const forgotLimiterByIp = getRateLimiter("forgotPasswordByIp", 60_000, 10);
const forgotLimiterByEmail = getRateLimiter("forgotPasswordByEmail", 15 * 60_000, 5);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;

  // Always the same redirect regardless of what happens below — whether the
  // email exists, has a password, or the request was rate-limited, the
  // response must look identical so it never reveals which accounts exist.
  const done = () =>
    NextResponse.redirect(new URL(`/${lang}/forgot-password?sent=1`, request.url), { status: 303 });

  if (forgotLimiterByIp.check(requestIp(request))) return done();
  if (!email || !email.includes("@")) return done();
  if (forgotLimiterByEmail.check(email)) return done();

  const user = await db.user.findUnique({ where: { email } });
  if (user?.passwordHash) {
    const token = signVerificationToken("password_reset", user.id, user.passwordHash);
    const origin = new URL(request.url).origin;
    const resetUrl = `${origin}/${lang}/reset-password?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: user.email,
      subject: "RusoFácilapp — restablecer contraseña / сброс пароля",
      html: `
        <p>Solicitaste restablecer tu contraseña en RusoFácilapp. Este enlace es válido durante 1 hora:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Si no fuiste tú, puedes ignorar este mensaje.</p>
        <hr />
        <p>Вы запросили сброс пароля на RusoFácilapp. Ссылка действительна 1 час:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Если это были не вы — просто проигнорируйте это письмо.</p>
      `,
    });
  }

  return done();
}
