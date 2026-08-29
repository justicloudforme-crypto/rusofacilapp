/**
 * Reports, per Story, how much of it has real pre-generated narration
 * audio (AudioAsset rows) vs. how much would fall back to the browser's
 * own speechSynthesis at read time — read-only, writes nothing.
 *
 * WHY THIS EXISTS
 * StoryText.tsx already tolerates missing clips sentence-by-sentence (see
 * its `hasRealAudio` comment — a known "15 of 325 stories have a few
 * gapped sentences" situation), but that was tracked anecdotally. This
 * makes it queryable: which stories have zero real audio at all (fully
 * exposed to the browser-TTS quirks that real-audio playback doesn't
 * have, e.g. the first-utterance-gets-clipped bug worked around in
 * StoryText.tsx's `ttsWarmedRef`), and which have a genuine partial gap
 * that's worth backfilling with `npm run generate:story-audio -- --story=<id>`.
 *
 * This only checks STRUCTURE (does a clip exist for every sentence) — it
 * has no way to judge whether a clip's actual audio sounds right. That
 * still needs a human to listen.
 *
 * USAGE
 *   npm run check:story-audio                  # every story
 *   npm run check:story-audio -- --story=<id>   # one story
 *
 * Reads whatever DATABASE_URL in .env points at — the same local/prod
 * switch every other prisma/generate-*.ts and check-*.ts script already
 * uses. Point it at the production Turso database for the real answer on
 * what's live, not just what's in the local dev copy.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { splitStoryParagraphs, splitSentences, storyAudioItemKey } from "../src/lib/stories";

import { isEntryPoint } from "../src/lib/entry-point";
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

function parseArgs(argv: string[]) {
  const storyArg = argv.find((a) => a.startsWith("--story="));
  return { storyId: storyArg ? storyArg.split("=")[1] : null };
}

async function main() {
  const { storyId } = parseArgs(process.argv.slice(2));

  const stories = storyId ? await db.story.findMany({ where: { id: storyId } }) : await db.story.findMany();
  if (storyId && stories.length === 0) {
    console.log(`No story found with id="${storyId}".`);
    return;
  }

  const audioRows = await db.audioAsset.findMany({
    where: { contentType: "story", contentId: storyId ? storyId : { in: stories.map((s) => s.id) } },
    select: { contentId: true, itemKey: true },
  });
  const keysByStory = new Map<string, Set<string>>();
  for (const row of audioRows) {
    if (!keysByStory.has(row.contentId)) keysByStory.set(row.contentId, new Set());
    keysByStory.get(row.contentId)!.add(row.itemKey);
  }

  let fullyCovered = 0;
  let zeroAudio = 0;
  let partial = 0;
  const partialDetails: { id: string; title: string; missing: string[]; total: number }[] = [];
  const zeroDetails: { id: string; title: string; total: number }[] = [];

  for (const story of stories) {
    const paragraphs = splitStoryParagraphs(story.text);
    const expectedKeys: string[] = [];
    paragraphs.forEach((paragraph, paragraphIndex) => {
      splitSentences(paragraph).forEach((_sentence, sentenceIndex) => {
        expectedKeys.push(storyAudioItemKey(paragraphIndex, sentenceIndex));
      });
    });

    const have = keysByStory.get(story.id) ?? new Set<string>();
    const missing = expectedKeys.filter((key) => !have.has(key));

    if (missing.length === 0) {
      fullyCovered++;
    } else if (missing.length === expectedKeys.length) {
      zeroAudio++;
      zeroDetails.push({ id: story.id, title: story.title, total: expectedKeys.length });
    } else {
      partial++;
      partialDetails.push({ id: story.id, title: story.title, missing, total: expectedKeys.length });
    }
  }

  console.log(`Checked ${stories.length} stories.\n`);
  console.log(`${fullyCovered} fully covered, ${partial} partially covered, ${zeroAudio} with zero real audio.\n`);

  if (zeroDetails.length > 0) {
    console.log("ZERO REAL AUDIO — full browser-TTS fallback for the whole story:");
    for (const d of zeroDetails) console.log(`  ${d.id} "${d.title}" — ${d.total} sentences, none narrated`);
    console.log("");
  }

  if (partialDetails.length > 0) {
    console.log("PARTIAL GAPS — a few sentences fall back to TTS mid-story:");
    for (const d of partialDetails) {
      console.log(`  ${d.id} "${d.title}" — missing ${d.missing.length}/${d.total}: ${d.missing.join(", ")}`);
    }
    console.log("\nBackfill one: npm run generate:story-audio -- --story=<id>");
  }
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
