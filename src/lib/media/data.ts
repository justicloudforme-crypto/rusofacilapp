import "server-only";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MediaItem } from "./types";
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
