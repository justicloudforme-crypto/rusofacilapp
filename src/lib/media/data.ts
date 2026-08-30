import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import type { EmbedStatus, MediaItem } from "./types";
import type { SubtitleLine } from "@/lib/video-lesson/types";

// The static catalog (title/vocab/exercises — genuinely static, ships with
// the code) still lives in this JSON file and is read fresh from disk
// (rather than a static `import`) so admin edits are visible without a
// server restart — mirrors src/lib/video-lesson/lessonStore.ts. Runtime-
// writable state (subtitles, embed status) does NOT live here anymore: this
// file sits inside the deployed app's own source tree, and Vercel's
// serverless functions have a read-only filesystem, so writes here in
// production silently failed. That state now lives in the `MediaOverride`
// DB table (see prisma/schema.prisma) and is layered on top of this static
// baseline in `applyOverride` below.
const MEDIA_DATA_FILE = path.join(process.cwd(), "src/lib/media/mediaData.json");

async function readStore(): Promise<Record<string, MediaItem>> {
  const raw = await readFile(MEDIA_DATA_FILE, "utf-8");
  return JSON.parse(raw) as Record<string, MediaItem>;
}

/** A MediaOverride's subtitles column, or null if it is unusable. */
function parseSubtitles(json: string | null): SubtitleLine[] | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as SubtitleLine[]) : null;
  } catch (error) {
    console.error("[media] subtitle override is not valid JSON — falling back to the static baseline", error);
    return null;
  }
}

function applyOverride(
  item: MediaItem,
  override: { subtitles: string | null; embedStatus: string | null; lastCheckedAt: string | null; sourceNoteAppend: string | null } | undefined,
): MediaItem {
  if (!override) return item;
  return {
    ...item,
    // Admin-written DB content reaching a parser during render — the class
    // behind incident №1. Subtitles are an enhancement on top of a media
    // item that is complete without them, so a malformed override falls
    // back to the static baseline instead of taking the page down.
    subtitles: parseSubtitles(override.subtitles) ?? item.subtitles,
    embedStatus: (override.embedStatus as EmbedStatus | null) ?? item.embedStatus,
    lastCheckedAt: override.lastCheckedAt ?? item.lastCheckedAt,
    sourceNote: override.sourceNoteAppend
      ? [item.sourceNote, override.sourceNoteAppend].filter(Boolean).join(" ")
      : item.sourceNote,
  };
}

async function readOverrides(): Promise<Map<string, Awaited<ReturnType<typeof db.mediaOverride.findMany>>[number]>> {
  const overrides = await db.mediaOverride.findMany();
  return new Map(overrides.map((o) => [o.mediaId, o]));
}

export async function getAllMedia(): Promise<MediaItem[]> {
  const [store, overrides] = await Promise.all([readStore(), readOverrides()]);
  return Object.values(store).map((item) => applyOverride(item, overrides.get(item.id)));
}

export async function getMediaById(id: string): Promise<MediaItem | null> {
  const store = await readStore();
  const item = store[id];
  if (!item) return null;
  const override = await db.mediaOverride.findUnique({ where: { mediaId: id } });
  return applyOverride(item, override ?? undefined);
}

export async function saveMediaSubtitles(id: string, subtitles: SubtitleLine[]): Promise<void> {
  const store = await readStore();
  if (!store[id]) throw new Error(`media item not found: ${id}`);
  await db.mediaOverride.upsert({
    where: { mediaId: id },
    create: { mediaId: id, subtitles: JSON.stringify(subtitles) },
    update: { subtitles: JSON.stringify(subtitles) },
  });
}

/**
 * Writes back the result of a `checkMediaEmbeds` run (see
 * src/lib/media/checkEmbeds.ts) — sets `embedStatus`/`lastCheckedAt` on
 * each item so the public catalog can hide broken ones and the admin page
 * can show which items need a source swap.
 *
 * Skips any id already flagged `manualOverride: true` — a human judgment
 * call (e.g. a direct "Video unavailable" report that contradicts what the
 * YouTube Data API itself says) must never be silently reverted by the next
 * automated check. See MediaOverride's schema comment and
 * rusofasil_media_content_policy memory (song-ty-uydyosh is the confirmed
 * real case this protects).
 */
export async function saveEmbedStatuses(
  updates: { id: string; embedStatus: EmbedStatus; note?: string }[],
): Promise<void> {
  const existing = await readOverrides();
  const checkedAt = new Date().toISOString().slice(0, 10);
  for (const { id, embedStatus, note } of updates) {
    const current = existing.get(id);
    if (current?.manualOverride) continue;

    const flagLine = note ? `[check ${checkedAt}] ${note}` : undefined;
    // Append rather than overwrite: sourceNoteAppend already carries
    // curatorial history (channel choice, lyrics-verification method) that
    // a broken-embed flag shouldn't erase.
    const sourceNoteAppend =
      flagLine && !current?.sourceNoteAppend?.includes(flagLine)
        ? [current?.sourceNoteAppend, flagLine].filter(Boolean).join(" ")
        : current?.sourceNoteAppend;

    await db.mediaOverride.upsert({
      where: { mediaId: id },
      create: { mediaId: id, embedStatus, lastCheckedAt: checkedAt, sourceNoteAppend },
      update: { embedStatus, lastCheckedAt: checkedAt, sourceNoteAppend },
    });
  }
}

/** Sets/unsets the manual-override protection on one item (admin action). */
export async function setManualOverride(id: string, manualOverride: boolean, note?: string): Promise<void> {
  await db.mediaOverride.upsert({
    where: { mediaId: id },
    create: { mediaId: id, manualOverride, sourceNoteAppend: note },
    update: { manualOverride, ...(note ? { sourceNoteAppend: note } : {}) },
  });
}

/** IDs currently protected from automated embed-status overwrites. */
export async function getManualOverrideIds(): Promise<Set<string>> {
  const rows = await db.mediaOverride.findMany({ where: { manualOverride: true }, select: { mediaId: true } });
  return new Set(rows.map((r) => r.mediaId));
}

/** Per-id { manualOverride, note } for the admin embed-status panel. */
export async function getOverrideMeta(): Promise<Map<string, { manualOverride: boolean; note: string | null }>> {
  const overrides = await readOverrides();
  return new Map(
    Array.from(overrides.entries()).map(([id, o]) => [
      id,
      { manualOverride: o.manualOverride, note: o.sourceNoteAppend },
    ]),
  );
}
