import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless, single-use-by-construction email verification tokens (password
// reset, account-deletion confirmation) — deliberately NOT a database table.
// Zero extra rows, zero cleanup job for expired ones: the token is just an
// HMAC-signed string carrying its own expiry and a short fingerprint of a
// value that changes exactly when the token should stop working (the
// user's current passwordHash). Once used — a password reset changes
// passwordHash, an account deletion removes the row entirely — any
// previously-issued link for that purpose stops verifying on its own,
// with no explicit "mark this token used" write required.
export type VerificationPurpose = "password_reset" | "delete_account";

const TTL_MS: Record<VerificationPurpose, number> = {
  password_reset: 60 * 60 * 1000, // 1 hour
  delete_account: 30 * 60 * 1000, // 30 minutes — a more sensitive action
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is not set");
  return secret;
}

/** Short, non-reversible fingerprint of the current passwordHash — included
 * in the signed payload so the token stops verifying the instant the
 * password actually changes (a real reset, or someone else's session
 * beating this one to it), without storing or comparing the hash itself. */
export function passwordFingerprint(passwordHash: string): string {
  return createHmac("sha256", getSecret()).update(passwordHash).digest("hex").slice(0, 16);
}

export function signVerificationToken(
  purpose: VerificationPurpose,
  userId: string,
  currentPasswordHash: string
): string {
  const expiresAt = Date.now() + TTL_MS[purpose];
  const payload = `${purpose}.${userId}.${expiresAt}.${passwordFingerprint(currentPasswordHash)}`;
  const signature = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

/**
 * Step 1 of verification: checks the token's signature, expiry, and purpose
 * — everything that can be validated from the secret alone, before knowing
 * who the token even claims to be for. Returns the claimed userId and the
 * password fingerprint it was signed against; the caller must still look up
 * that user and pass their CURRENT passwordHash to `matchesCurrentPassword`
 * before trusting the token (step 2) — a tampered-but-well-formed userId
 * would still fail the signature check here, but this alone doesn't confirm
 * the password hasn't changed since the token was issued.
 */
export function decodeVerificationToken(
  token: string,
  purpose: VerificationPurpose
): { userId: string; fingerprint: string } | null {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const parts = decoded.split(".");
  if (parts.length !== 5) return null;
  const [tokenPurpose, userId, expiresAtStr, fingerprint, signature] = parts;

  if (tokenPurpose !== purpose || !userId) return null;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  const payload = `${tokenPurpose}.${userId}.${expiresAtStr}.${fingerprint}`;
  const expectedSignature = createHmac("sha256", getSecret()).update(payload).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return { userId, fingerprint };
}

/** Step 2: confirms the token was issued against the password the user
 * currently has — false if it's changed since (the reset/deletion already
 * happened via this or another token, or the account was otherwise
 * updated), which is what makes these tokens single-use in practice. */
export function matchesCurrentPassword(tokenFingerprint: string, currentPasswordHash: string): boolean {
  return tokenFingerprint === passwordFingerprint(currentPasswordHash);
}
