/**
 * Sets WordGamePuzzle.premiumOnly — the "standard" (monthly/annual)
 * subscriber loses access to, per the access-tier policy: ~30-35% of each
 * (type, level) ladder is Premium (lifetime)-exclusive.
 *
 * Unlike stories (see set-premium-only-stories.ts), word games DO have a
 * real, deterministic difficulty signal to split on: `sequence` — a
 * puzzle's rung number within its (type, level) ladder. Confirmed by
 * inspecting the data: every `curved` (★) puzzle already sits at the very
 * end of its ladder's sequence range (e.g. WORD_SEARCH/A1: sequences
 * 1-142 are non-curved, 143-196 are curved) — curved was already, by
 * construction, "the hardest tail". This sets premiumOnly for the top
 * PREMIUM_SHARE of each ladder by sequence, which necessarily includes
 * every curved puzzle (already the top ~16% on average) plus enough of
 * the hardest non-curved rungs just below them to reach the target band
 * overall (~32% at this share).
 *
 * Safe to re-run — idempotent, only touches rows whose premiumOnly value
 * would actually change.
 *
 *   npm run db:set-premium-only-word-games
 */
import "dotenv/config";
import { db } from "../src/lib/db";

const PREMIUM_SHARE = 0.32;

async function main() {
  const groups = await db.wordGamePuzzle.groupBy({ by: ["type", "level"] });

  let changed = 0;
  let premiumTotal = 0;
  let total = 0;

  for (const { type, level } of groups) {
    const rows = await db.wordGamePuzzle.findMany({
      where: { type, level },
      select: { id: true, sequence: true, premiumOnly: true },
      orderBy: { sequence: "desc" },
    });
    const premiumCount = Math.round(rows.length * PREMIUM_SHARE);
    const premiumIds = new Set(rows.slice(0, premiumCount).map((r) => r.id));

    for (const row of rows) {
      const shouldBePremium = premiumIds.has(row.id);
      if (row.premiumOnly !== shouldBePremium) {
        await db.wordGamePuzzle.update({ where: { id: row.id }, data: { premiumOnly: shouldBePremium } });
        changed++;
      }
    }

    total += rows.length;
    premiumTotal += premiumIds.size;
  }

  console.log(
    `✔ premiumOnly set: ${changed} row(s) changed. ${premiumTotal}/${total} puzzles (${((premiumTotal / total) * 100).toFixed(1)}%) are now Premium-exclusive.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
