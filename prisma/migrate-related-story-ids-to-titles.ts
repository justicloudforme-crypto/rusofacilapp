/**
 * One-time data migration: MediaItem.relatedStoryIds (raw `Story.id`,
 * curated by hand for 19 items — movies/videos related to a reading-
 * library story) is rewritten as MediaItem.relatedStories ({title, level}
 * pairs). Story.id drifts between dev.db and Turso for most rows (see
 * PROGRESS.md's Story-transfer rule) — the raw ids in mediaData.json were
 * captured against dev.db and would silently resolve to the wrong story
 * (or nothing) on Turso. This script resolves each id against the DB it's
 * run against (dev.db by default) once, then commits the resolved
 * (title, level) pairs into the repo — a stable identifier that survives
 * crossing the dev.db<->Turso boundary, same as every other place in this
 * codebase that already avoids matching Story by id.
 *
 * Run once (`npm run db:migrate-related-story-ids`); safe to re-run — it's
 * idempotent (skips items that already have `relatedStories` and no more
 * `relatedStoryIds`).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";

import { isEntryPoint } from "../src/lib/entry-point";
const MEDIA_DATA_FILE = path.join(process.cwd(), "src/lib/media/mediaData.json");

async function main() {
  const raw = readFileSync(MEDIA_DATA_FILE, "utf-8");
  const store: Record<string, Record<string, unknown> & { relatedStoryIds?: string[] }> = JSON.parse(raw);

  let converted = 0;
  let unresolved = 0;

  for (const [mediaId, item] of Object.entries(store)) {
    const ids: string[] | undefined = item.relatedStoryIds;
    if (!ids || ids.length === 0) continue;

    const relatedStories: { title: string; level: string }[] = [];
    for (const id of ids) {
      const story = await db.story.findUnique({ where: { id }, select: { title: true, level: true } });
      if (!story) {
        console.log(`[migrate-related-story-ids] ${mediaId}: id ${id} did not resolve to a story — dropped.`);
        unresolved++;
        continue;
      }
      relatedStories.push({ title: story.title, level: story.level });
    }

    item.relatedStories = relatedStories;
    delete item.relatedStoryIds;
    converted++;
  }

  writeFileSync(MEDIA_DATA_FILE, JSON.stringify(store, null, 2) + "\n", "utf-8");
  console.log(`[migrate-related-story-ids] Converted ${converted} media items, ${unresolved} id(s) unresolved.`);
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
