/**
 * Sets Story.premiumOnly — the "standard" (monthly/annual) subscriber
 * loses access to on top of the free/paid split (see
 * set-free-trial-stories.ts), per the access-tier policy: ~30-35% of the
 * catalog is Premium (lifetime)-exclusive.
 *
 * The catalog is exactly 65 stories per CEFR level (325 total). C1 alone
 * (65 = 20%) undershoots the target band; C1+B2 together (130 = 40%)
 * overshoots it. There's no real per-story difficulty signal within a
 * level to split on objectively, so this sets a DETERMINISTIC DEFAULT —
 * all of C1 plus the first half of B2 by creation order (33 of 65,
 * landing at 98/325 = 30.2%) — that staff can hand-correct per story via
 * /admin/stories, same "script sets a default, staff corrects" pattern as
 * CURATED_FREE_STORIES.
 *
 * Safe to re-run — idempotent, only touches rows whose premiumOnly value
 * would actually change.
 *
 *   npm run db:set-premium-only-stories
 */
import "dotenv/config";
import { db } from "../src/lib/db";

const B2_PREMIUM_SHARE = 0.5;

async function main() {
  const c1Stories = await db.story.findMany({
    where: { level: "C1" },
    select: { id: true, premiumOnly: true },
  });

  const b2Stories = await db.story.findMany({
    where: { level: "B2" },
    select: { id: true, premiumOnly: true },
    orderBy: { createdAt: "asc" },
  });
  const b2PremiumCount = Math.round(b2Stories.length * B2_PREMIUM_SHARE);
  const b2PremiumIds = new Set(b2Stories.slice(0, b2PremiumCount).map((s) => s.id));

  const otherLevelStories = await db.story.findMany({
    where: { level: { notIn: ["C1", "B2"] } },
    select: { id: true, premiumOnly: true },
  });

  let changed = 0;
  for (const story of c1Stories) {
    if (!story.premiumOnly) {
      await db.story.update({ where: { id: story.id }, data: { premiumOnly: true } });
      changed++;
    }
  }
  for (const story of b2Stories) {
    const shouldBePremium = b2PremiumIds.has(story.id);
    if (story.premiumOnly !== shouldBePremium) {
      await db.story.update({ where: { id: story.id }, data: { premiumOnly: shouldBePremium } });
      changed++;
    }
  }
  for (const story of otherLevelStories) {
    if (story.premiumOnly) {
      await db.story.update({ where: { id: story.id }, data: { premiumOnly: false } });
      changed++;
    }
  }

  const total = c1Stories.length + b2Stories.length + otherLevelStories.length;
  const premiumTotal = c1Stories.length + b2PremiumIds.size;
  console.log(
    `✔ premiumOnly set: ${changed} row(s) changed. ${premiumTotal}/${total} stories (${((premiumTotal / total) * 100).toFixed(1)}%) are now Premium-exclusive.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
