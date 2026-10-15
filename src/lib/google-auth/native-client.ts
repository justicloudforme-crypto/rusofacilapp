/**
 * Вход через Google в приложении — сторона страницы (заход 7.267).
 *
 *   1. `POST /api/auth/google/nonce` — сервер выдаёт одноразовое число и
 *      client ID веб-клиента (он же `aud` токена);
 *   2. плагин оболочки `RfGoogleSignIn` (Credential Manager, с 1.0.16 /
 *      versionCode 17) показывает системное окно выбора аккаунта и отдаёт
 *      ID-токен;
 *   3. `POST /api/auth/google/native` — сервер проверяет токен и ставит
 *      нашу обычную сессию этим же ответом.
 * Токен на странице не хранится и никуда, кроме нашего сервера, не уходит.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

interface RfGoogleSignInPlugin {
  signIn(options: { serverClientId: string; nonce: string }): Promise<{ idToken: string }>;
}

const RfGoogleSignIn = registerPlugin<RfGoogleSignInPlugin>("RfGoogleSignIn");

export function nativeGoogleSignInAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("RfGoogleSignIn");
  } catch {
    return false;
  }
}

export type NativeGoogleResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: "google_cancelled" | "google_unverified" | "google_ambiguous" | "google_failed" };

/** Отказ плагина «человек закрыл окно» — не сбой, текста не нужно.
 * «no_credentials» (на телефоне нет аккаунта Google) — сбой с текстом:
 * молча ничего не сделать было бы хуже. */
const CANCEL_CODES = new Set(["cancelled"]);

export async function signInWithGoogleNatively(input: { lang: string; redirectTo: string }): Promise<NativeGoogleResult> {
  let nonce = "";
  let serverClientId = "";
  try {
    const res = await fetch("/api/auth/google/nonce", { method: "POST", credentials: "same-origin" });
    const body = (await res.json()) as { nonce?: string; serverClientId?: string };
    nonce = res.ok ? body.nonce ?? "" : "";
    serverClientId = res.ok ? body.serverClientId ?? "" : "";
  } catch {
    // ниже — общий отказ
  }
  if (!nonce || !serverClientId) return { ok: false, error: "google_failed" };

  let idToken = "";
  try {
    idToken = (await RfGoogleSignIn.signIn({ serverClientId, nonce })).idToken;
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (typeof code === "string" && CANCEL_CODES.has(code)) return { ok: false, error: "google_cancelled" };
    return { ok: false, error: "google_failed" };
  }
  if (!idToken) return { ok: false, error: "google_failed" };

  try {
    const res = await fetch("/api/auth/google/native", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, lang: input.lang, redirectTo: input.redirectTo }),
    });
    const body = (await res.json()) as { ok?: boolean; redirectTo?: string; error?: string };
    if (res.ok && body.ok && body.redirectTo) return { ok: true, redirectTo: body.redirectTo };
    if (body.error === "google_unverified" || body.error === "google_ambiguous") return { ok: false, error: body.error };
    return { ok: false, error: "google_failed" };
  } catch {
    return { ok: false, error: "google_failed" };
  }
}
