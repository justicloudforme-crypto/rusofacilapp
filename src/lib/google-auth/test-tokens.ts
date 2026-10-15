/**
 * Подписанные ID-токены «как от Google» для тестов и сторожа (7.267).
 * Ключ — свой RSA, набор ключей подаётся проверке вместо googleapis.com.
 * В продуктовом коде не импортируется.
 */
import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import type { Jwk } from "./id-token";

export interface TestSigner {
  kid: string;
  jwks: Jwk[];
  sign(claims: Record<string, unknown>, header?: Record<string, unknown>): string;
}

export function makeTestSigner(kid = "test-kid-1"): TestSigner {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...(publicKey as KeyObject).export({ format: "jwk" }), kid, alg: "RS256", use: "sig" } as Jwk;
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return {
    kid,
    jwks: [jwk],
    sign(claims, header = {}) {
      const head = b64({ alg: "RS256", typ: "JWT", kid, ...header });
      const body = b64(claims);
      const signature = createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey).toString("base64url");
      return `${head}.${body}.${signature}`;
    },
  };
}

export function googleClaims(overrides: Record<string, unknown> = {}, nowMs = Date.now()): Record<string, unknown> {
  const now = Math.floor(nowMs / 1000);
  return {
    iss: "https://accounts.google.com",
    aud: "web-client.apps.googleusercontent.com",
    sub: "110000000000000000001",
    email: "justi@gmail.com",
    email_verified: true,
    iat: now - 5,
    exp: now + 3600,
    nonce: "nonce-1",
    ...overrides,
  };
}
