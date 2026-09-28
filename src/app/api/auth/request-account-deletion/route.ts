import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { signVerificationToken } from "@/lib/verification-token";
import { sendEmail } from "@/lib/email";
import { getRateLimiter } from "@/lib/rate-limit";
import { getSubscriptionsForUser } from "@/lib/subscription";
import { hasRenewingStoreSubscription } from "@/lib/store-subscription";
import { ACCOUNT_DELETION_COPY, PLAY_SUBSCRIPTIONS_URL } from "@/lib/legal/account-deletion";

// Step 1 of account deletion's two-factor confirmation: the password
// (something the user knows, proves it's really them at the keyboard right
// now) gets a confirmation link emailed (something the user has access to,
// proves the account's inbox) — the link itself does the actual delete,
// via a GET-safe confirmation page + a separate POST (see
// /api/auth/confirm-account-deletion), never straight from an email click.
const requestDeletionLimiter = getRateLimiter("requestAccountDeletion", 60_000, 5);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (await requestDeletionLimiter.check(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const langRaw = typeof body?.lang === "string" ? body.lang : "";

  if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "invalid_password" }, { status: 400 });
  }

  const token = signVerificationToken("delete_account", user.id, user.passwordHash);
  const origin = new URL(request.url).origin;
  // Долг 164, тот же класс: токен во фрагменте, на сервер он не уезжает.
  const confirmUrl = `${origin}/${langRaw || "es"}/confirm-delete-account#token=${encodeURIComponent(token)}`;

  // 7.242, долг 344: подписку Google Play удаление не отменяет — письмо,
  // по которому человек подтверждает удаление, обязано сказать это тем, у
  // кого она продлевается.
  const playWarning = hasRenewingStoreSubscription(await getSubscriptionsForUser(user.id).catch(() => []));
  const playLine = (lang: "es" | "ru") =>
    playWarning
      ? `<p><strong>${ACCOUNT_DELETION_COPY[lang].playWarning}</strong> <a href="${PLAY_SUBSCRIPTIONS_URL}">${PLAY_SUBSCRIPTIONS_URL}</a></p>`
      : "";

  await sendEmail({
    to: user.email,
    subject: "RusoFácilapp — confirmar eliminación de cuenta / подтверждение удаления аккаунта",
    html: `
      <p>Solicitaste eliminar tu cuenta de RusoFácilapp. Esta acción es irreversible y borra todo tu progreso. Este enlace es válido durante 30 minutos:</p>
      ${playLine("es")}
      <p><a href="${confirmUrl}">${confirmUrl}</a></p>
      <p>Si no fuiste tú, cambia tu contraseña de inmediato.</p>
      <hr />
      <p>Вы запросили удаление аккаунта RusoFácilapp. Это действие необратимо и удалит весь ваш прогресс. Ссылка действительна 30 минут:</p>
      ${playLine("ru")}
      <p><a href="${confirmUrl}">${confirmUrl}</a></p>
      <p>Если это были не вы — немедленно смените пароль.</p>
    `,
  });

  return NextResponse.json({ ok: true });
}
