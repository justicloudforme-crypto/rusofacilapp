import "server-only";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { prismaAccountStore, resolveGoogleAccount } from "@/lib/google-auth/account";
import type { GoogleTokenError } from "@/lib/google-auth/id-token";

/** Код ошибки, который увидит страница входа (`?error=…`). */
export type GoogleLoginError = "google_cancelled" | "google_unverified" | "google_ambiguous" | "google_failed";

export function loginErrorForToken(error: GoogleTokenError): GoogleLoginError {
  return error === "email_unverified" ? "google_unverified" : "google_failed";
}

/**
 * Проверенный адрес → наша обычная сессия. Один путь для веба и для
 * приложения: какую учётку открыть, решает `resolveGoogleAccount`.
 */
export async function signInWithGoogleIdentity(identity: {
  email: string;
}): Promise<{ ok: true; created: boolean } | { ok: false; error: GoogleLoginError }> {
  // Сюда доходит только токен, прошедший `verifyGoogleIdToken`, а он
  // неподтверждённый адрес уже отверг.
  const outcome = await resolveGoogleAccount(prismaAccountStore(db), { email: identity.email, emailVerified: true });
  if (outcome.kind === "refused") {
    return { ok: false, error: outcome.reason === "ambiguous" ? "google_ambiguous" : outcome.reason === "email_unverified" ? "google_unverified" : "google_failed" };
  }
  await createSession(outcome.user.id, outcome.user.sessionVersion);
  return { ok: true, created: outcome.kind === "created" };
}
