/**
 * ONE-OFF sync for "Сказка о рыбаке и рыбке" — see PROGRESS.md and
 * prisma/fix-rybak-i-rybka-text.ts (the text/audio fix this follows).
 *
 * Story.id differs between local dev.db and prod Turso for this row
 * (as for ~315/325 stories) — matched here by (title, level), never by
 * id, per the standing project rule.
 *
 * Turso's Story.text was already the canonical wording, but its
 * per-sentence AudioAsset rows (8-1, 10-1) still held the OLD wording's
 * audio — the same "stale cached fragment" defect class as Teremok.
 * This script updates, on TURSO ONLY (local dev.db already fixed by
 * fix-rybak-i-rybka-text.ts):
 *  1. The two AudioAsset rows (text/voice/audioUrl/durationSeconds) to
 *     match local dev.db's freshly re-synthesized fragments.
 *  2. Story.fullAudioUrl / sentenceOffsetsJson, reaching 325/325.
 *
 * Usage: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx prisma/sync-rybak-i-rybka-to-turso.ts
 */
import "dotenv/config";
import { PrismaClient as LocalClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient as TursoClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const TITLE = "Сказка о рыбаке и рыбке";
const LEVEL = "B1";
const FRAGMENT_KEYS = ["8-1", "10-1"];

async function main() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  if (!tursoUrl || !tursoToken) {
    console.error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN missing.");
    process.exit(1);
  }

  const localAdapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const local = new LocalClient({ adapter: localAdapter });
  const tursoAdapter = new PrismaLibSql({ url: tursoUrl, authToken: tursoToken });
  const turso = new TursoClient({ adapter: tursoAdapter });

  const localStory = await local.story.findFirst({ where: { title: TITLE, level: LEVEL } });
  const tursoStory = await turso.story.findFirst({ where: { title: TITLE, level: LEVEL } });
  if (!localStory || !tursoStory) {
    console.error("Story not found in one of the two databases.");
    process.exit(1);
  }
  console.log(`local id=${localStory.id}  turso id=${tursoStory.id}`);

  if (localStory.text !== tursoStory.text) {
    console.error("Story.text still differs between dev.db and Turso after the fix — aborting, needs manual look.");
    process.exit(1);
  }
  console.log("Story.text matches on both sides — good.");

  for (const itemKey of FRAGMENT_KEYS) {
    const localRow = await local.audioAsset.findUnique({
      where: { contentType_contentId_itemKey: { contentType: "story", contentId: localStory.id, itemKey } },
    });
    const tursoRow = await turso.audioAsset.findUnique({
      where: { contentType_contentId_itemKey: { contentType: "story", contentId: tursoStory.id, itemKey } },
    });
    if (!localRow || !tursoRow) {
      console.error(`  ${itemKey}: missing on one side (local=${Boolean(localRow)}, turso=${Boolean(tursoRow)}) — skipping.`);
      continue;
    }
    await turso.audioAsset.update({
      where: { id: tursoRow.id },
      data: {
        text: localRow.text,
        voice: localRow.voice,
        durationSeconds: localRow.durationSeconds,
        audioUrl: localRow.audioUrl,
      },
    });
    console.log(`  ${itemKey}: synced -> ${localRow.audioUrl}`);
  }

  await turso.story.update({
    where: { id: tursoStory.id },
    data: { fullAudioUrl: localStory.fullAudioUrl, sentenceOffsetsJson: localStory.sentenceOffsetsJson },
  });
  console.log(`Story.fullAudioUrl / sentenceOffsetsJson synced -> ${localStory.fullAudioUrl}`);

  await local.$disconnect();
  await turso.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
