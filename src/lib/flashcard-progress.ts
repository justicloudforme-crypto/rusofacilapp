// Per-word "known" flag for the flashcards module. Local-first: every read/
// write goes to localStorage immediately for instant UI feedback (works
// fully offline and for guests), and is mirrored in the background to
// /api/flashcard-progress when the user is authenticated, so the flag
// survives a device switch or app reinstall — see rusofasil_project_state
// memory on why this mattered for the mobile port. A 401 from the sync
// calls just means "not logged in, stay local" — never surfaced as an error.

const STORAGE_KEY = "rusofacil:flashcard-progress";
// Separate key from the "known" map above: box progress is written far more
// often (every answer in the recall trainer / match game, not just a
// deliberate "Lo sé" tap), so keeping it in its own record avoids re-parsing
// and re-serializing the known map on every recall-mode answer.
const SRS_STORAGE_KEY = "rusofacil:flashcard-srs";

export interface Entry {
  known: boolean;
  updatedAt: number;
}

export type EntryMap = Record<string, Entry>;
type KnownMap = Record<string, boolean>;

/** Leitner-box progress for one card. box 0 = new/learning, 1 = review,
 * 2 = mastered. See prisma/schema.prisma's FlashcardProgress comment for
 * the full promotion rule. */

import { postReliably } from "./reliable-post";

export interface SrsEntry {
  box: number;
  correctStreak: number;
  lastSeenAt: number;
}

type SrsMap = Record<string, SrsEntry>;

const MAX_BOX = 2;

function readSrsAll(): SrsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SRS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: SrsMap = {};
    for (const [cardId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        value &&
        typeof value === "object" &&
        typeof (value as SrsEntry).box === "number" &&
        typeof (value as SrsEntry).correctStreak === "number"
      ) {
        const entry = value as SrsEntry;
        out[cardId] = {
          box: entry.box,
          correctStreak: entry.correctStreak,
          lastSeenAt: typeof entry.lastSeenAt === "number" ? entry.lastSeenAt : 0,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeSrsAll(map: SrsMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Same "nice-to-have, never block studying" reasoning as writeAll above.
  }
}

function syncSrsToServer(cardId: string, known: boolean, entry: SrsEntry) {
  // keepalive + повтор + маячок: ответ, данный последним перед уходом со
  // страницы, терялся чаще всего, а именно он и интереснее прочих.
  // Локальная копия в localStorage остаётся первым источником правды,
  // поэтому неудача здесь — не потеря для ученика, но и молчаливой она
  // быть не должна (src/lib/reliable-post.ts).
  void postReliably("/api/flashcard-progress", {
    cardId,
    known,
    box: entry.box,
    correctStreak: entry.correctStreak,
  });
}

export function getSrsProgress(): SrsMap {
  return readSrsAll();
}

/** Records one recall/typing-trainer or match-game answer for a card and
 * returns its updated box entry. Two correct answers in a row promote the
 * card to the next box (shown less often); any miss drops it straight back
 * to box 0 and resets the streak, since a mistake means the word needs
 * full re-learning, not just one fewer review. */
export function recordSrsAnswer(cardId: string, correct: boolean): SrsEntry {
  const all = readSrsAll();
  const prev = all[cardId] ?? { box: 0, correctStreak: 0, lastSeenAt: 0 };

  const next: SrsEntry = correct
    ? prev.correctStreak + 1 >= 2
      ? { box: Math.min(prev.box + 1, MAX_BOX), correctStreak: 0, lastSeenAt: Date.now() }
      : { box: prev.box, correctStreak: prev.correctStreak + 1, lastSeenAt: Date.now() }
    : { box: 0, correctStreak: 0, lastSeenAt: Date.now() };

  all[cardId] = next;
  writeSrsAll(all);
  // A correct answer that just promoted a card, or any miss, is worth
  // marking "known"/"not known" too — keeps the coarse flag used by the
  // flip-card progress bar roughly in sync with the finer-grained box.
  syncSrsToServer(cardId, next.box >= MAX_BOX, next);
  return next;
}

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
  // То же, что и в syncSrsToServer: keepalive, повтор, маячок. Локальная
  // запись уже произошла, и syncKnownWords() сверит их позже — но терять
  // отправку из-за одного обрыва сети незачем (src/lib/reliable-post.ts).
  void postReliably("/api/flashcard-progress", { cardId, known });
}

export function getKnownWords(): KnownMap {
  return toKnownMap(readAll());
}

/** The full local {cardId: {known, updatedAt}} map, not just the coarse
 * known/unknown flags getKnownWords() returns — sent to POST
 * /api/flashcards/summary so a guest's (or a not-yet-synced device's)
 * progress can be reflected in the category grid and "Continue" strip,
 * which the server otherwise has no way to see. Read-only export of the
 * same map setWordKnown()/syncKnownWords() already maintain — no new
 * storage, no new metric. */
export function getProgressEntries(): EntryMap {
  return readAll();
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

/** Same device-switch reconciliation as syncKnownWords, for the box/streak
 * data instead of the coarse known flag. Issues its own GET request rather
 * than sharing syncKnownWords' — the two are called from different places
 * (browse mode only needs known words; the recall trainer only needs box
 * data), so there's no single caller to share a request between. */
export async function syncSrsProgress(): Promise<SrsMap> {
  const local = readSrsAll();
  try {
    const res = await fetch("/api/flashcard-progress");
    if (!res.ok) return local;
    const body: unknown = await res.json();
    const remote =
      body && typeof body === "object" && (body as { progress?: unknown }).progress
        ? ((body as { progress: Record<string, SrsEntry & { lastSeenAt: number | null }> }).progress ?? {})
        : {};

    const merged: SrsMap = { ...local };
    for (const [cardId, remoteEntry] of Object.entries(remote)) {
      if (remoteEntry.lastSeenAt === null) continue;
      const localEntry = merged[cardId];
      if (!localEntry || remoteEntry.lastSeenAt >= localEntry.lastSeenAt) {
        merged[cardId] = { box: remoteEntry.box, correctStreak: remoteEntry.correctStreak, lastSeenAt: remoteEntry.lastSeenAt };
      }
    }
    writeSrsAll(merged);
    return merged;
  } catch {
    return local;
  }
}
