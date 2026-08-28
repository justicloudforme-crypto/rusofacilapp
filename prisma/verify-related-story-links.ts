/**
 * Verifies that MediaItem.relatedStories ({title, level} pairs, see
 * migrate-related-story-ids-to-titles.ts) actually resolve against
 * whichever database this script is run against — dev.db by default, or
 * Turso if TURSO_DATABASE_URL/TURSO_AUTH_TOKEN are set inline for the
 * command. Meant to be re-run against prod (with the owner's Turso key)
 * before/after deploying any change to mediaData.json's curated links, so
 * an unresolved pair is caught here, not reported by a user clicking a
 * dead-end link.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import type { MediaItem } from "../src/lib/media/types";

// Reads mediaData.json directly rather than src/lib/media/data.ts's
// getAllMedia() — that module is marked "server-only" (Next-only guard)
// and can't be imported from a plain tsx script.
const MEDIA_DATA_FILE = path.join(process.cwd(), "src/lib/media/mediaData.json");

async function main() {
  const store: Record<string, MediaItem> = JSON.parse(readFileSync(MEDIA_DATA_FILE, "utf-8"));
  const allMedia = Object.values(store);
  const withLinks = allMedia.filter((item) => item.relatedStories && item.relatedStories.length > 0);

  let totalPairs = 0;
  let resolved = 0;
  const unresolvedPairs: { mediaId: string; title: string; level: string }[] = [];

  for (const item of withLinks) {
    for (const ref of item.relatedStories!) {
      totalPairs++;
      const story = await db.story.findFirst({ where: { title: ref.title, level: ref.level }, select: { id: true } });
      if (story) {
        resolved++;
      } else {
        unresolvedPairs.push({ mediaId: item.id, title: ref.title, level: ref.level });
      }
    }
  }

  console.log(`[verify-related-story-links] ${withLinks.length} media items carry relatedStories.`);
  console.log(`[verify-related-story-links] ${resolved}/${totalPairs} (title, level) pairs resolved.`);
  if (unresolvedPairs.length > 0) {
    console.log(`[verify-related-story-links] Unresolved pairs:`);
    for (const p of unresolvedPairs) {
      console.log(`  - ${p.mediaId}: "${p.title}" (${p.level})`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
