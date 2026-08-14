// Per-word "known" flag for the flashcards module. Local-first: every read/
// write goes to localStorage immediately for instant UI feedback (works
// fully offline and for guests), and is mirrored in the background to
// /api/flashcard-progress when the user is authenticated, so the flag
// survives a device switch or app reinstall — see rusofasil_project_state
// memory on why this mattered for the mobile port. A 401 from the sync
// calls just means "not logged in, stay local" — never surfaced as an error.

const STORAGE_KEY = "rusofacil:flashcard-progress";

interface Entry {
  known: boolean;
  updatedAt: number;
}

type EntryMap = Record<string, Entry>;
type KnownMap = Record<string, boolean>;

function toKnownMap(entries: EntryMap): KnownMap {
  const out: KnownMap = {};
  for (const [cardId, entry] of Object.entries(entries)) out[cardId] = entry.known;
  return out;
}

function readAll(): EntryMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: EntryMap = {};
    for (const [cardId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "boolean") {
        // Pre-sync localStorage shape (plain boolean, no timestamp) — treat
        // as the oldest possible entry so a real server entry always wins.
        out[cardId] = { known: value, updatedAt: 0 };
      } else if (value && typeof value === "object" && typeof (value as Entry).known === "boolean") {
        const entry = value as Entry;
        out[cardId] = { known: entry.known, updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : 0 };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(map: EntryMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage full or unavailable (e.g. private browsing) — progress
    // tracking is a nice-to-have, never let it block studying.
  }
}

function syncToServer(cardId: string, known: boolean) {
  fetch("/api/flashcard-progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId, known }),
  }).catch(() => {
    // Offline or logged out — the local write already happened, that's
    // enough for this session; the next syncKnownWords() call reconciles.
  });
}

export function getKnownWords(): KnownMap {
  return toKnownMap(readAll());
}

export function setWordKnown(cardId: string, known: boolean): KnownMap {
  const all = readAll();
  all[cardId] = { known, updatedAt: Date.now() };
  writeAll(all);
  syncToServer(cardId, known);
  return toKnownMap(all);
}

/** Call once on mount (after the local-only read already painted the UI):
 * pulls the server's map, merges by "most recently updated wins" per card,
 * writes the merged result back to localStorage, and returns it. Silently
 * falls back to the local map alone if the request fails or the user isn't
 * logged in. */
export async function syncKnownWords(): Promise<KnownMap> {
  const local = readAll();
  try {
    const res = await fetch("/api/flashcard-progress");
    if (!res.ok) return toKnownMap(local);
    const body: unknown = await res.json();
    const remote =
      body && typeof body === "object" && (body as { progress?: unknown }).progress
        ? ((body as { progress: EntryMap }).progress ?? {})
        : {};

    const merged: EntryMap = { ...local };
    for (const [cardId, remoteEntry] of Object.entries(remote)) {
      const localEntry = merged[cardId];
      if (!localEntry || remoteEntry.updatedAt >= localEntry.updatedAt) {
        merged[cardId] = remoteEntry;
      }
    }
    writeAll(merged);
    return toKnownMap(merged);
  } catch {
    return toKnownMap(local);
  }
}
