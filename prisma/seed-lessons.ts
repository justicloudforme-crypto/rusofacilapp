/**
 * Loads every lesson from src/lib/lessons/content.json into the `Lesson`
 * table, so the admin-editable database copy matches the bundled content
 * (rather than only the fallback file). Safe to re-run — it's an upsert,
 * and only touches rows for keys present in content.json.
 *
 *   npm run db:seed-lessons
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import content from "../src/lib/lessons/content.json";
import { validateLessonContent } from "../src/lib/lessons/validate";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

async function main() {
  let ok = 0;
  let failed = 0;

  for (const [key, lesson] of Object.entries(content)) {
    const [level, lessonSlug] = key.split("-");
    const result = validateLessonContent(lesson);
    if (!result.valid) {
      console.error(`✗ ${key}: ${result.error}`);
      failed++;
      continue;
    }

    await db.lesson.upsert({
      where: { level_lessonSlug: { level, lessonSlug } },
      update: { contentJson: JSON.stringify(result.content) },
      create: { level, lessonSlug, contentJson: JSON.stringify(result.content) },
    });
    ok++;
  }

  console.log(`✔ Seeded ${ok} lesson(s) into the database${failed ? `, ${failed} failed validation` : ""}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
