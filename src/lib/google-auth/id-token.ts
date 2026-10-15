import { createPublicKey, verify as verifySignature, type JsonWebKey } from "node:crypto";

/**
 * ПРОВЕРКА ID-ТОКЕНА GOOGLE НА СЕРВЕРЕ (заход 7.267).
 *
 * Токен приходит двумя путями: веб-вход (обмен кода на сервере) и нативный
 * вход Android (Credential Manager отдаёт токен приложению, приложение —
 * нам). Второму нельзя верить на слово ни в чём: телефон может прислать
 * что угодно. Поэтому проверка одна на оба пути и полная:
 *
 *   * подпись RS256 ключом Google (`kid` из заголовка ищется в наборе
 *     ключей https://www.googleapis.com/oauth2/v3/certs);
 *   * `iss` — accounts.google.com;
 *   * `aud` — НАШ client ID (токен, выданный чужому приложению, не наш);
 *   * `exp` — не истёк, `iat` — не из будущего (запас часов 60 с);
 *   * `nonce` — тот, что выдали мы (повтор украденного токена);
 *   * `email` есть, `email_verified` — истина.
 *
 * Своими силами на `node:crypto`, без библиотеки: это ровно четыре
 * проверки и одна подпись, а новая зависимость в серверном пакете — лишний
 * код на каждом запросе.
 */

export const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"] as const;
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const CLOCK_SKEW_SEC = 60;

export type GoogleTokenError =
  | "malformed"
  | "bad_algorithm"
  | "unknown_key"
  | "bad_signature"
  | "bad_issuer"
  | "wrong_audience"
  | "expired"
  | "issued_in_future"
  | "nonce_mismatch"
  | "no_email"
  | "email_unverified";

export interface GoogleIdentity {
  sub: string;
  email: string;
}

export type GoogleTokenResult = { ok: true; identity: GoogleIdentity } | { ok: false; error: GoogleTokenError };

export interface Jwk extends JsonWebKey {
  kid?: string;
}

export type JwksFetcher = () => Promise<Jwk[]>;

function decodeSegment(segment: string): unknown {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

export async function verifyGoogleIdToken(
  idToken: string,
  options: {
    audience: string;
    /** Обязателен: оба пути входа выдают свой nonce. */
    nonce: string;
    fetchKeys?: JwksFetcher;
    nowMs?: number;
  }
): Promise<GoogleTokenResult> {
  const parts = idToken.split(".");
  if (parts.length !== 3 || parts.some((p) => !p)) return { ok: false, error: "malformed" };

  let header: { alg?: unknown; kid?: unknown };
  let claims: Record<string, unknown>;
  try {
    header = decodeSegment(parts[0]) as typeof header;
    claims = decodeSegment(parts[1]) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "malformed" };
  }
  if (!header || typeof header !== "object" || !claims || typeof claims !== "object") {
    return { ok: false, error: "malformed" };
  }
  if (header.alg !== "RS256") return { ok: false, error: "bad_algorithm" };

  const keys = await (options.fetchKeys ?? fetchGoogleKeys)();
  const jwk = keys.find((k) => k.kid === header.kid && k.kty === "RSA");
  if (!jwk) return { ok: false, error: "unknown_key" };

  let validSignature = false;
  try {
    const key = createPublicKey({ key: jwk, format: "jwk" });
    validSignature = verifySignature(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      key,
      Buffer.from(parts[2], "base64url")
    );
  } catch {
    validSignature = false;
  }
  if (!validSignature) return { ok: false, error: "bad_signature" };

  if (!GOOGLE_ISSUERS.includes(claims.iss as (typeof GOOGLE_ISSUERS)[number])) {
    return { ok: false, error: "bad_issuer" };
  }
  // `aud` у Google — строка; массив по стандарту допустим, принимаем
  // только если в нём ровно наш клиент и больше никого.
  const aud = claims.aud;
  const audOk = typeof aud === "string" ? aud === options.audience : Array.isArray(aud) && aud.length === 1 && aud[0] === options.audience;
  if (!audOk) return { ok: false, error: "wrong_audience" };

  const nowSec = Math.floor((options.nowMs ?? Date.now()) / 1000);
  if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_SEC < nowSec) return { ok: false, error: "expired" };
  if (typeof claims.iat === "number" && claims.iat - CLOCK_SKEW_SEC > nowSec) {
    return { ok: false, error: "issued_in_future" };
  }
  if (!options.nonce || claims.nonce !== options.nonce) return { ok: false, error: "nonce_mismatch" };

  const email = typeof claims.email === "string" ? claims.email.trim() : "";
  if (!email || !email.includes("@")) return { ok: false, error: "no_email" };
  // Google отдаёт булево; строка "true" встречалась в старых ответах.
  if (claims.email_verified !== true && claims.email_verified !== "true") return { ok: false, error: "email_unverified" };

  const sub = typeof claims.sub === "string" ? claims.sub : "";
  if (!sub) return { ok: false, error: "malformed" };
  return { ok: true, identity: { sub, email } };
}

// Ключи Google меняются раз в несколько дней; ответ несёт Cache-Control
// max-age. Держим их в памяти экземпляра функции столько, сколько сказано.
let cachedKeys: { keys: Jwk[]; until: number } | null = null;

export async function fetchGoogleKeys(): Promise<Jwk[]> {
  const now = Date.now();
  if (cachedKeys && cachedKeys.until > now) return cachedKeys.keys;
  const response = await fetch(GOOGLE_JWKS_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`google jwks ${response.status}`);
  const body = (await response.json()) as { keys?: Jwk[] };
  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "")?.[1] ?? 0);
  const keys = Array.isArray(body.keys) ? body.keys : [];
  cachedKeys = { keys, until: now + Math.min(Math.max(maxAge, 0), 6 * 3600) * 1000 };
  return keys;
}
