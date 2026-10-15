import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Короткоживущая подписанная кука на время входа через Google (7.267).
 *
 * Веб-вход: `state` (защита от подложенного ответа), `nonce` (защита от
 * повтора токена), PKCE-`verifier`, язык и куда вернуться. Нативный вход:
 * только `nonce`. Строк в базе нет — как и у остальных токенов входа
 * (`verification-token.ts`): подпись тем же `SESSION_SECRET`, срок внутри.
 */
export const GOOGLE_WEB_FLOW_COOKIE = "rf_google_flow";
export const GOOGLE_NATIVE_FLOW_COOKIE = "rf_google_native";
export const GOOGLE_FLOW_TTL_MS = 10 * 60 * 1000;

export interface GoogleWebFlow {
  state: string;
  nonce: string;
  verifier: string;
  lang: string;
  redirectTo: string;
}

export interface GoogleNativeFlow {
  nonce: string;
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET environment variable is not set");
  return value;
}

function mac(purpose: string, body: string): string {
  return createHmac("sha256", secret()).update(`google-flow:${purpose}:${body}`).digest("base64url");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function sealFlow<T extends object>(purpose: "web" | "native", flow: T, nowMs = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...flow, exp: nowMs + GOOGLE_FLOW_TTL_MS })).toString("base64url");
  return `${body}.${mac(purpose, body)}`;
}

export function openFlow<T extends object>(purpose: "web" | "native", sealed: string | undefined, nowMs = Date.now()): T | null {
  if (!sealed) return null;
  const dot = sealed.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = sealed.slice(0, dot);
  const a = Buffer.from(sealed.slice(dot + 1));
  const b = Buffer.from(mac(purpose, body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp?: unknown };
    if (typeof parsed.exp !== "number" || parsed.exp < nowMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Секреты сравниваются за постоянное время. */
export function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
