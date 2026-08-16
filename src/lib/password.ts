import "server-only";
import bcrypt from "bcryptjs";

// bcrypt (via the pure-JS bcryptjs, not a native-binary argon2 binding) —
// deliberate choice over argon2id despite argon2 being the current OWASP
// top pick: this app's deploy target isn't pinned yet, and a native addon
// would need a matching prebuilt binary on whatever platform it lands on.
// bcrypt at cost 12 is still well above any practical brute-force budget for
// this app's threat model.
const BCRYPT_COST = 12;

export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

export function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export const MIN_PASSWORD_LENGTH = 8;

export function isPasswordStrongEnough(plaintext: string): boolean {
  return plaintext.length >= MIN_PASSWORD_LENGTH;
}
