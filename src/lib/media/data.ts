import "server-only";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EmbedStatus, MediaItem } from "./types";
import type { SubtitleLine } from "@/lib/video-lesson/types";

// Read fresh from disk (rather than a static `import`) so subtitles
// backfilled by the admin generator are visible immediately without a
// server restart — mirrors src/lib/video-lesson/lessonStore.ts.
const MEDIA_DATA_FILE = path.join(process.cwd(), "src/lib/media/mediaData.json");

async function readStore(): Promise<Record<string, MediaItem>> {
  const raw = await readFile(MEDIA_DATA_FILE, "utf-8");
  return JSON.parse(raw) as Record<string, MediaItem>;
}

export async function getAllMedia(): Promise<MediaItem[]> {
  return Object.values(await readStore());
}

export async function getMediaById(id: string): Promise<MediaItem | null> {
  const store = await readStore();
  return store[id] ?? null;
}

export async function saveMediaSubtitles(id: string, subtitles: SubtitleLine[]): Promise<void> {
  const store = await readStore();
  if (!store[id]) throw new Error(`media item not found: ${id}`);
  store[id] = { ...store[id], subtitles };
  await writeFile(MEDIA_DATA_FILE, JSON.stringify(store, null, 2) + "\n", "utf-8");
}

/**
 * Writes back the result of a `checkMediaEmbeds` run (see
 * src/lib/media/checkEmbeds.ts) — sets `embedStatus`/`lastCheckedAt` on
 * each item so the public catalog can hide broken ones and the admin page
 * can show which items need a source swap. A single write at the end
 * (not one write per item) keeps this safe to run over the whole ~150-item
 * catalog without hammering the disk.
 */
export async function saveEmbedStatuses(
  updates: { id: string; embedStatus: EmbedStatus; note?: string }[],
): Promise<void> {
  const store = await readStore();
  const checkedAt = new Date().toISOString().slice(0, 10);
  for (const { id, embedStatus, note } of updates) {
    if (!store[id]) continue; // stale id from a since-deleted item — ignore, not fatal
    const existing = store[id];
    // Append rather than overwrite: sourceNote already carries curatorial
    // history (channel choice, lyrics-verification method) that a broken-
    // embed flag shouldn't erase.
    const flagLine = note ? `[check ${checkedAt}] ${note}` : undefined;
    const sourceNote =
      flagLine && !existing.sourceNote?.includes(flagLine)
        ? [existing.sourceNote, flagLine].filter(Boolean).join(" ")
        : existing.sourceNote;
    store[id] = { ...existing, embedStatus, lastCheckedAt: checkedAt, sourceNote };
  }
  await writeFile(MEDIA_DATA_FILE, JSON.stringify(store, null, 2) + "\n", "utf-8");
}
