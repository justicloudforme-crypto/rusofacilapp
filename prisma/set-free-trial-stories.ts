/**
 * Sets which stories are free (Story.isPremium = false) vs. behind the
 * subscription paywall, for the freemium trial (see FREEMIUM.md).
 *
 * Before 2026-08-23, ~276 of the 325 stories were isPremium=false (an
 * older, much more generous free/premium split). That state is still sitting
 * in the DB even though src/proxy.ts stopped honoring it when the whole
 * /stories section got hard-gated behind a subscription. Now that the
 * section gate is gone in favor of Story.isPremium's own page-level check
 * (see src/app/[lang]/stories/[id]/page.tsx), leaving that old data as-is
 * would make ~276 stories free again — the opposite of "1-2 stories to
 * taste the product." This script narrows it down to a small, deliberate
 * free sample: everything the CURATED_FREE_STORIES set doesn't name gets
 * isPremium=true; the two curated titles get isPremium=false.
 *
 * Safe to re-run — idempotent, matches by (title, author) like
 * seed-stories.ts.
 *
 *   npm run db:set-free-trial-stories
 */
import "dotenv/config";
import { db } from "../src/lib/db";

// Two short, appealing, beginner-level (A1) folk tales — easy enough that
// a brand-new visitor can actually read the whole thing and feel the
// product working, not just see a locked wall of text.
import { isEntryPoint } from "../src/lib/entry-point";
const CURATED_FREE_STORIES: { title: string; author: string }[] = [
  { title: "Репка", author: "Русская народная сказка" },
  { title: "Теремок", author: "Русская народная сказка" },
];

async function main() {
  const freeSet = new Set(CURATED_FREE_STORIES.map((s) => `${s.title}::${s.author}`));

  const all = await db.story.findMany({ select: { id: true, title: true, author: true, isPremium: true } });

  let madeFree = 0;
  let madePremium = 0;
  let missing = 0;

  for (const key of freeSet) {
    const [title, author] = key.split("::");
    if (!all.some((s) => s.title === title && s.author === author)) {
      console.warn(`⚠ Curated free story not found in DB: "${title}" by ${author}`);
      missing++;
    }
  }

  for (const story of all) {
    const shouldBeFree = freeSet.has(`${story.title}::${story.author}`);
    if (shouldBeFree && story.isPremium) {
      await db.story.update({ where: { id: story.id }, data: { isPremium: false } });
      madeFree++;
    } else if (!shouldBeFree && !story.isPremium) {
      await db.story.update({ where: { id: story.id }, data: { isPremium: true } });
      madePremium++;
    }
  }

  console.log(
    `✔ Free-trial stories set: ${madeFree} made free, ${madePremium} made premium${missing ? `, ${missing} curated title(s) not found` : ""}.`
  );
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
