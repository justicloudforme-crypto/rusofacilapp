import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { signVerificationToken } from "@/lib/verification-token";
import { sendEmail } from "@/lib/email";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getRateLimiter, requestIp } from "@/lib/rate-limit";
import { readRequestForm } from "@/lib/request-form";

const forgotLimiterByIp = getRateLimiter("forgotPasswordByIp", 60_000, 10);
const forgotLimiterByEmail = getRateLimiter("forgotPasswordByEmail", 15 * 60_000, 5);

export async function POST(request: NextRequest) {
  const read = await readRequestForm(request);
  if (!read.ok) return read.response;
  const formData = read.form;
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

  if (await forgotLimiterByIp.check(requestIp(request))) return done();
  if (!email || !email.includes("@")) return done();
  if (await forgotLimiterByEmail.check(email)) return done();

  const user = await db.user.findUnique({ where: { email } });
  // 7.267: и учётке без пароля (вход через Google) — письмо со ссылкой,
  // по которой пароль заводится впервые. Ответ странице при этом тот же,
  // что и всем: по нему нельзя узнать, есть ли учётка и есть ли у неё пароль.
  if (user) {
    const hasPassword = Boolean(user.passwordHash);
    const token = signVerificationToken("password_reset", user.id, user.passwordHash);
    const origin = new URL(request.url).origin;
    // ДОЛГ 164: токен во ФРАГМЕНТЕ, а не в строке запроса. Фрагмент —
    // единственный кусок адреса, который браузер на сервер не отправляет
    // вовсе: он не попадает ни в журнал, ни в `Referer`, ни в событие
    // Sentry, к которому SDK прикладывает полный адрес страницы. Читает
    // его уже в браузере src/components/auth/HashTokenForm.tsx, он же
    // стирает фрагмент из адреса сразу после чтения.
    const resetUrl = `${origin}/${lang}/reset-password#token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: user.email,
      subject: hasPassword
        ? "RusoFácilapp — restablecer contraseña / сброс пароля"
        : "RusoFácilapp — crear contraseña / создание пароля",
      html: hasPassword
        ? `
        <p>Solicitaste restablecer tu contraseña en RusoFácilapp. Este enlace es válido durante 1 hora:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Si no fuiste tú, puedes ignorar este mensaje.</p>
        <hr />
        <p>Вы запросили сброс пароля на RusoFácilapp. Ссылка действительна 1 час:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Если это были не вы — просто проигнорируйте это письмо.</p>
      `
        : `
        <p>Tu cuenta de RusoFácilapp entra con Google y no tiene contraseña. Si quieres entrar también con tu correo y una contraseña, créala con este enlace (válido durante 1 hora):</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Puedes seguir entrando con Google como siempre. Si no fuiste tú, ignora este mensaje.</p>
        <hr />
        <p>Ваш аккаунт RusoFácilapp входит через Google, пароля у него нет. Если хотите входить и по email с паролем, задайте его по этой ссылке (действует 1 час):</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Входить через Google можно и дальше. Если это были не вы — просто проигнорируйте письмо.</p>
      `,
    });
  }

  return done();
}
