/**
 * One-time backfill: fills in Story.readingMinutes for rows that predate
 * that column (any row still NULL). New/edited rows get it automatically
 * at save time now (see estimateReadingMinutes in src/lib/stories.ts and
 * api/admin/stories/save) — this script only needs to run once against a
 * database that has old rows, and is safe to re-run any time after (it
 * only ever touches rows where readingMinutes IS NULL).
 *
 * Pure text math — no TTS, no network calls, no content changes.
 *
 * USAGE (against local dev.db, the default):
 *   npm run db:backfill-reading-minutes
 *
 * USAGE (against production — export the same Turso credentials src/lib/db.ts
 * uses, then run the same command):
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run db:backfill-reading-minutes
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { estimateReadingMinutes } from "../src/lib/stories";

// Mirrors src/lib/db.ts's own adapter selection — Turso when its env vars
// are set, otherwise the local file, so the same script works against
// either without a separate "prod mode" flag.
import { isEntryPoint } from "../src/lib/entry-point";
const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

async function main() {
  const stories = await db.story.findMany({
    where: { readingMinutes: null },
    select: { id: true, text: true },
  });
  console.log(`${stories.length} stories missing readingMinutes.`);

  let updated = 0;
  for (const story of stories) {
    const minutes = estimateReadingMinutes(story.text);
    await db.story.update({ where: { id: story.id }, data: { readingMinutes: minutes } });
    updated += 1;
  }

  console.log(`Done — backfilled readingMinutes for ${updated} stories.`);
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
