import "server-only";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { prismaAccountStore, resolveGoogleAccount } from "@/lib/google-auth/account";
import type { GoogleTokenError } from "@/lib/google-auth/id-token";
import { linkGoogleOnSignIn, prismaLinkStore } from "@/lib/google-auth/link";
import { googleLinkEmail } from "@/lib/google-auth/link-email";

/** Код ошибки, который увидит страница входа (`?error=…`). */
export type GoogleLoginError = "google_cancelled" | "google_unverified" | "google_ambiguous" | "google_failed";

export function loginErrorForToken(error: GoogleTokenError): GoogleLoginError {
  return error === "email_unverified" ? "google_unverified" : "google_failed";
}

/**
 * Проверенный адрес → наша обычная сессия. Один путь для веба и для
 * приложения: какую учётку открыть, решает `resolveGoogleAccount`; первая
 * ли это привязка Google и что при ней снять — `linkGoogleOnSignIn`
 * (долг 381, 7.268).
 */
export async function signInWithGoogleIdentity(
  identity: { email: string },
  context: { origin: string }
): Promise<{ ok: true; created: boolean } | { ok: false; error: GoogleLoginError }> {
  // Сюда доходит только токен, прошедший `verifyGoogleIdToken`, а он
  // неподтверждённый адрес уже отверг.
  const outcome = await resolveGoogleAccount(prismaAccountStore(db), { email: identity.email, emailVerified: true });
  if (outcome.kind === "refused") {
    return { ok: false, error: outcome.reason === "ambiguous" ? "google_ambiguous" : outcome.reason === "email_unverified" ? "google_unverified" : "google_failed" };
  }

  const link = await linkGoogleOnSignIn(prismaLinkStore(db), outcome.user.id);
  // Сессия ЭТОГО входа — с версией после сброса: прочие уже погасли.
  await createSession(outcome.user.id, link.sessionVersion);

  if (link.kind === "password_disabled") {
    // Письмо не должно ломать вход: пароль уже снят, сессия выдана. Неудачу
    // видно в Sentry и в журнале Vercel.
    const letter = googleLinkEmail({ email: link.email, origin: context.origin });
    const sent = await sendEmail({ to: link.email, ...letter }).catch((error: unknown) => {
      Sentry.captureException(error, { tags: { area: "google-link-email" } });
      return null;
    });
    if (sent === false) {
      console.error("[google-link] password-disabled email not sent", { userId: outcome.user.id });
      Sentry.captureMessage("google-link: password-disabled email not sent", { level: "error", tags: { area: "google-link-email" }, extra: { userId: outcome.user.id } });
    }
  }
  return { ok: true, created: outcome.kind === "created" };
}
