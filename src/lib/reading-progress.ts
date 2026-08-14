// Per-story reading/listening progress. Local-first, same pattern as
// flashcard-progress.ts: localStorage for instant reads/writes and offline/
// guest use, mirrored in the background to /api/reading-progress so
// progress survives a device switch or app reinstall.

const STORAGE_KEY = "rusofacil:story-progress";

export interface StoryProgress {
  /** 1-based page number the reader last reached (matches the "Página N de M" label). */
  currentPage: number;
  /** Sentence-queue index within that page where playback last was, or null if not mid-playback. */
  queueIndex: number | null;
  totalPages: number;
  /** Math.round((currentPage / totalPages) * 100) — forced to 100 once the last page is reached. */
  percent: number;
  isCompleted: boolean;
  updatedAt: number;
}

type ProgressMap = Record<string, StoryProgress>;

function readAll(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: ProgressMap = {};
    for (const [storyId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value && typeof value === "object" && typeof (value as StoryProgress).currentPage === "number") {
        const entry = value as StoryProgress;
        out[storyId] = { ...entry, updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : 0 };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(map: ProgressMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage full or unavailable (e.g. private browsing) — progress
    // tracking is a nice-to-have, never let it block reading.
  }
}

function syncToServer(storyId: string, entry: StoryProgress) {
  fetch("/api/reading-progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storyId,
      currentPage: entry.currentPage,
      totalPages: entry.totalPages,
      queueIndex: entry.queueIndex,
    }),
  }).catch(() => {
    // Offline or logged out — the local write already happened; the next
    // syncStoryProgress() call reconciles.
  });
}

export function getStoryProgress(storyId: string): StoryProgress | null {
  return readAll()[storyId] ?? null;
}

export function getAllStoryProgress(): ProgressMap {
  return readAll();
}

export function saveStoryProgress(
  storyId: string,
  data: { currentPage: number; totalPages: number; queueIndex?: number | null }
): StoryProgress {
  const totalPages = Math.max(1, data.totalPages);
  const currentPage = Math.min(Math.max(1, data.currentPage), totalPages);
  const isCompleted = currentPage >= totalPages;
  const percent = isCompleted ? 100 : Math.round((currentPage / totalPages) * 100);
  const entry: StoryProgress = {
    currentPage,
    queueIndex: data.queueIndex ?? null,
    totalPages,
    percent,
    isCompleted,
    updatedAt: Date.now(),
  };
  const all = readAll();
  all[storyId] = entry;
  writeAll(all);
  syncToServer(storyId, entry);
  return entry;
}

/** Call once on mount: merges the server's map into the local one by
 * "most recently updated wins" per story, writes the merged result back to
 * localStorage, and returns it. Falls back to the local map alone if the
 * request fails or the user isn't logged in. */
export async function syncStoryProgress(): Promise<ProgressMap> {
  const local = readAll();
  try {
    const res = await fetch("/api/reading-progress");
    if (!res.ok) return local;
    const body: unknown = await res.json();
    const remote =
      body && typeof body === "object" && (body as { progress?: unknown }).progress
        ? ((body as { progress: ProgressMap }).progress ?? {})
        : {};

    const merged: ProgressMap = { ...local };
    for (const [storyId, remoteEntry] of Object.entries(remote)) {
      const localEntry = merged[storyId];
      if (!localEntry || remoteEntry.updatedAt >= localEntry.updatedAt) {
        merged[storyId] = remoteEntry;
      }
    }
    writeAll(merged);
    return merged;
  } catch {
    return local;
  }
}
