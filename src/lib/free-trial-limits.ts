/**
 * How much of each section a visitor without an active subscription gets.
 *
 * Extracted from src/lib/entitlement.ts on 05.09.2026 for exactly the
 * reason word-games/free-tier.ts and exams/slug.ts were extracted before
 * it: the rule is needed where `import "server-only"` cannot be resolved.
 * The new caller is src/lib/intro/stats.ts — the single source the
 * introduction deck takes every number from — and the guard that reads it,
 * `npm run check:intro-numbers`, which runs under tsx outside Next's
 * module resolution and therefore cannot import anything server-only.
 *
 * entitlement.ts re-exports both constants, so every existing
 * `from "@/lib/entitlement"` import keeps working and there is still
 * exactly one definition of each. See FREEMIUM.md for the policy these
 * numbers implement.
 */
import { WORD_GAME_FREE_RUNGS_PER_LEVEL } from "./word-games/free-tier";
// Type-only, therefore erased at build and at tsx runtime — importing it
// does not drag subscription.ts (`server-only`) into this module.
import type { EntitlementTierValue } from "./subscription";

/**
 * Free-trial sample sizes. Deliberately small, fixed numbers rather than a
 * percentage: the point is a taste of the product, not a meaningfully
 * usable free tier.
 */
export const FREE_TRIAL_LIMITS = {
  flashcards: 10,
  idioms: 5,
  // Raised from 5 (A1-only) to 10 across every level except C1 — 2026-08-28,
  // per an explicit owner call: word games barely compete with the
  // subscription (people pay for lessons, not crosswords), so a bigger free
  // sample here is close to free marginal cost while giving a curious,
  // not-yet-decided visitor much more to try. See isFreeWordGamePuzzle,
  // which applies this per (type, level) with no per-URL exception list —
  // plus EXTRA_FREE_WORD_GAME_RUNGS, three rungs free by name rather than
  // by number, which is why the live total is not 2 x 4 x this number.
  wordGamePuzzlesPerLevel: WORD_GAME_FREE_RUNGS_PER_LEVEL,
} as const;

/**
 * The "literary" idiom category (proverbs' more advanced sibling) is
 * Premium-exclusive beyond a small taste — unlike the rest of the idiom
 * bank, where "standard" already means full access (minus C1). free gets
 * one to know the category exists; standard gets a real but capped sample;
 * only premium sees the whole thing.
 */
export const LITERARY_IDIOM_LIMITS: Record<Exclude<EntitlementTierValue, "premium">, number> = {
  free: 1,
  standard: 5,
};
