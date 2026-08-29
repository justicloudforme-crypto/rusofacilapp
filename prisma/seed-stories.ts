/**
 * Seeds the "Cuentos / Lecturas" library with 10 short classic Russian
 * texts (Chekhov, Tolstoy, Pushkin, Kuprin), spread across CEFR levels
 * A1-C1, each with a Spanish summary and a paragraph-aligned Spanish
 * translation (see translationEs in src/lib/stories.ts).
 *
 * Levels A1/A2 use short, simplified retellings — the real texts are too
 * grammatically advanced for beginners. B1 and up move closer to (short,
 * lightly trimmed) excerpts of the actual stories. All four authors died
 * more than 70 years ago, so the Russian originals are public domain.
 *
 * Safe to re-run: matches existing rows by (title, author) and updates
 * them instead of duplicating.
 *
 * SAFE BY DEFAULT: a row a staff member has hand-edited through /admin
 * (Story.reviewedAt set — see src/app/api/admin/stories/save) is skipped,
 * not overwritten, even if this script's own stories-data.ts disagrees.
 * This exists because a re-run once silently replaced a good, reviewed
 * Spanish translation with regenerated text (see CONTENT_INTEGRITY.md).
 * Pass --force to overwrite reviewed rows anyway (e.g. a deliberate bulk
 * correction you know supersedes prior manual edits).
 *
 *   npm run db:seed-stories
 *   npm run db:seed-stories -- --force
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { validateStoryInput } from "../src/lib/stories";
import { stories } from "./stories-data";

import { isEntryPoint } from "../src/lib/entry-point";
const FORCE = process.argv.includes("--force");

async function main() {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const story of stories) {
    const result = validateStoryInput({ ...story, audioUrl: null });
    if (!result.valid) {
      console.error(`✗ ${story.title}: ${result.error}`);
      failed++;
      continue;
    }

    const existing = await db.story.findFirst({
      where: { title: story.title, author: story.author },
    });

    if (existing) {
      if (existing.reviewedAt && !FORCE) {
        console.warn(`⚠ Skipping "${story.title}" — hand-reviewed on ${existing.reviewedAt.toISOString()}, re-run with --force to overwrite anyway.`);
        skipped++;
        continue;
      }
      await db.story.update({ where: { id: existing.id }, data: result.value });
      updated++;
    } else {
      await db.story.create({ data: result.value });
      created++;
    }
  }

  console.log(
    `✔ Seeded stories: ${created} created, ${updated} updated, ${skipped} skipped (reviewed)${failed ? `, ${failed} failed validation` : ""}.`
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
