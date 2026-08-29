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

/**
 * No regex. This used to build `^[<alphabet>]{<length>}$` by interpolating
 * the caller's alphabet straight into a character class, where `-`, `]`,
 * `^` and `\` all mean something. The three alphabets in use today are
 * alphanumeric, so nothing was wrong on 30.08.2026 when this was checked —
 * but the failure it invites is silent, not loud: adding a `-` for
 * readability (a natural thing to want in a code people read aloud) would
 * turn part of the alphabet into a range and start accepting or rejecting
 * codes without any error. Comparing characters directly cannot go wrong
 * that way and says what it means.
 *
 * Same class of bug as the case-sensitive attribute regex that made a
 * sitewide hreflang check report "0 problems" when it meant "0 matches" —
 * see PROGRESS.md's note on that.
 */
export function isPlausibleShortCode(value: string, alphabet: string, length: number): boolean {
  if (value.length !== length) return false;
  for (const char of value) {
    if (!alphabet.includes(char)) return false;
  }
  return true;
}
