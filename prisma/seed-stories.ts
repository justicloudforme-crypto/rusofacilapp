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
 *   npm run db:seed-stories
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { validateStoryInput } from "../src/lib/stories";
import { stories } from "./stories-data";


async function main() {
  let created = 0;
  let updated = 0;
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
      await db.story.update({ where: { id: existing.id }, data: result.value });
      updated++;
    } else {
      await db.story.create({ data: result.value });
      created++;
    }
  }

  console.log(
    `✔ Seeded stories: ${created} created, ${updated} updated${failed ? `, ${failed} failed validation` : ""}.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
