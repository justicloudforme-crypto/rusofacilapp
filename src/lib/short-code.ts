import { randomInt } from "node:crypto";

// Shared by every short human-shareable code in the app (referral codes,
// public profile handles, group invite codes) — each caller picks its own
// alphabet/length, this just centralizes the generate/validate pair so
// there's exactly one place that gets randomInt-vs-Math.random right.
export function generateShortCode(alphabet: string, length: number): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += alphabet[randomInt(alphabet.length)];
  }
  return code;
}

export function isPlausibleShortCode(value: string, alphabet: string, length: number): boolean {
  return new RegExp(`^[${alphabet}]{${length}}$`).test(value);
}
