/**
 * The student's own voice, kept on the student's own device.
 *
 * Owner's decision, 30.08.2026: a practice recording never goes to a
 * server again. The point of the feature is "record yourself, listen to
 * yourself, compare with the model" — all three happen in one session, in
 * one browser, and paid cloud storage was being charged for something no
 * one ever reads back. The upload route and the object-storage write are
 * gone from the code entirely, not behind a flag.
 *
 * So the only two places a recording lives are:
 *
 *   - within the session: a Blob, played through URL.createObjectURL —
 *     zero network requests, which e2e/voice-recording-local.spec.ts
 *     asserts by failing the run on any request to our own API or storage
 *     while recording or playing;
 *   - between sessions: IndexedDB, one record per practice item.
 *
 * IndexedDB and not localStorage because localStorage stores strings: a
 * clip would have to be base64'd (+33% and a main-thread encode) and would
 * hit the 5MB origin cap after two or three recordings. IndexedDB stores
 * the Blob itself.
 *
 * Everything here is browser-side. Nothing in this module talks to the
 * network, and there is no server counterpart to talk to.
 */

/** Bumping this deletes nothing — a new version's onupgradeneeded has to
 * migrate or recreate the store explicitly. */
const DB_NAME = "rusofacil-voice";
const DB_VERSION = 1;
const STORE = "recordings";
/** Newest-first eviction order is by this index, not by insertion order:
 * a re-recorded item is an overwrite and its `createdAt` moves. */
const BY_CREATED_AT = "createdAt";

/**
 * Caps. Deliberately small: this is a practice aid, not an archive, and a
 * phone's storage is the student's, not ours to fill. Whichever cap is hit
 * first evicts the oldest recordings until both hold again.
 *
 * 30 clips at the ~25kB a ten-second WebM/Opus clip actually measured
 * (7.47) is under 1MB in the normal case; MAX_BYTES is what stops one
 * student recording thirty two-minute takes.
 */
export const MAX_RECORDINGS = 30;
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export interface StoredRecording {
  /** `${ownerScope}::${level}::${lessonSlug}::${itemKey}` — see
   * {@link recordingKey}. One record per practice item, by construction. */
  key: string;
  ownerScope: string;
  level: string;
  lessonSlug: string;
  itemKey: string;
  /**
   * The clip's raw bytes, NOT a Blob — and that is a measurement, not a
   * preference. Playwright's WebKit aborts any IndexedDB transaction that
   * tries to store a Blob (a plain object in the same transaction
   * commits fine; measured 30.08.2026, PROGRESS.md 7.49), so the first
   * version of this file stored every recording in Chromium and none at
   * all on an iPhone profile — silently, on the exact platform the
   * original bug report came from. An ArrayBuffer is plain
   * structured-clone data and stores everywhere. The Blob is rebuilt on
   * the way out by {@link blobOf}, from these bytes and the type below.
   */
  data: ArrayBuffer;
  /** What the recorder said it was producing — audio/webm on Chrome and
   * Android, audio/mp4 on Safari. Carried rather than assumed, which is
   * the fix from 7.47: without it the rebuilt Blob would be typeless and
   * the player would have nothing to decode by. */
  mimeType: string;
  /** `data.byteLength`, denormalised so the usage figure and the eviction
   * plan can be computed without touching the buffers. */
  bytes: number;
  /** Milliseconds, measured from start to stop — the recorder does not
   * report a duration and a Blob has none until it is decoded. 0 when the
   * caller did not measure. */
  durationMs: number;
  /** Epoch ms. Eviction order and the "recorded on" line both read it. */
  createdAt: number;
}

export interface StorageUsage {
  count: number;
  bytes: number;
}

/**
 * Why a save or a read failed, in the only two ways the caller treats
 * differently:
 *
 *   - "quota": the device refused the write (QuotaExceededError), even
 *     after eviction. The clip is fine; there is nowhere to put it.
 *   - "unavailable": IndexedDB is not there or would not open — private
 *     mode in some browsers, a blocked-storage setting, an origin whose
 *     database is corrupt.
 *
 * Neither is fatal to the feature. The recording stays playable for the
 * rest of the session either way; only the "still here after a reload"
 * half is lost, and the student is told so in their own language.
 */
export type VoiceStorageFailure = "quota" | "unavailable";

export class VoiceStorageError extends Error {
  constructor(readonly reason: VoiceStorageFailure, cause?: unknown) {
    super(`voice recording storage failed: ${reason}`);
    this.name = "VoiceStorageError";
    this.cause = cause;
  }
}

/**
 * One recording per practice item per account. The owner scope comes
 * first so that "delete everything of mine" is a prefix scan, and so that
 * two accounts sharing one phone never see each other's takes.
 *
 * `itemKey` is the Russian text itself (same convention as the old
 * VoiceSubmission.itemKey), so it survives content edits that renumber
 * items. It can contain anything, including the separator — hence the
 * separator is a pair of colons and the parts are never parsed back out:
 * the key is an opaque identity, and the fields are stored alongside it
 * for querying.
 */
export function recordingKey(
  ownerScope: string,
  target: { level: string; lessonSlug: string; itemKey: string }
): string {
  return `${ownerScope}::${target.level}::${target.lessonSlug}::${target.itemKey}`;
}

/** The playable clip, rebuilt from what was stored. The type comes from
 * the record, never from a constant — see src/lib/voice-formats.ts. */
export function blobOf(record: Pick<StoredRecording, "data" | "mimeType">): Blob {
  return new Blob([record.data], record.mimeType ? { type: record.mimeType } : undefined);
}

/**
 * Which records to drop so that both caps hold once `incoming` bytes are
 * added. Pure, so the rule is testable without a browser: hand it the
 * existing records (any order) and the size of the clip about to be
 * written, get back the keys to delete, oldest first.
 *
 * `replacingKey` is the record the incoming clip overwrites, if any — it
 * frees its own bytes and must not be counted as competition for space,
 * or re-recording the same phrase would slowly evict everything else.
 */
export function planEviction(
  existing: Pick<StoredRecording, "key" | "bytes" | "createdAt">[],
  incomingBytes: number,
  replacingKey?: string
): string[] {
  const others = existing
    .filter((r) => r.key !== replacingKey)
    .sort((a, b) => a.createdAt - b.createdAt);

  let count = others.length + 1;
  let bytes = others.reduce((sum, r) => sum + r.bytes, 0) + incomingBytes;

  const evict: string[] = [];
  for (const record of others) {
    if (count <= MAX_RECORDINGS && bytes <= MAX_TOTAL_BYTES) break;
    evict.push(record.key);
    count -= 1;
    bytes -= record.bytes;
  }
  return evict;
}

/** "1,2 MB" / "830 kB". Decimal units, because that is what a phone's own
 * storage screen shows and the number is there to be compared with it. */
export function formatBytes(bytes: number, locale: string): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(0)} kB`;
  return `${(bytes / (1000 * 1000)).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`;
}

function isQuotaError(error: unknown): boolean {
  // DOMException name, not instanceof: Safari throws QuotaExceededError
  // from a transaction's error event, where it arrives as a plain
  // DOMException and not as the constructor this realm knows.
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "QuotaExceededError"
  );
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new VoiceStorageError("unavailable"));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      // Firefox in permanent-private-browsing mode throws right here.
      reject(new VoiceStorageError("unavailable", error));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex(BY_CREATED_AT, "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new VoiceStorageError("unavailable", request.error));
    // A second tab holding an old version open. Nothing to do but fail
    // softly — the recording still plays in this session.
    request.onblocked = () => reject(new VoiceStorageError("unavailable"));
  }).catch((error) => {
    // Do not cache a failed open: storage can come back (the other tab
    // closes, the user leaves private mode) and the next attempt should
    // be a real attempt.
    dbPromise = null;
    throw error instanceof VoiceStorageError ? error : new VoiceStorageError("unavailable", error);
  });
  return dbPromise;
}

/**
 * Runs one transaction and resolves with whatever `work` reports.
 *
 * `work` is synchronous and callback-driven on purpose. An IndexedDB
 * transaction is only guaranteed to still be active inside the task that
 * created it and inside its own requests' callbacks; `await`ing between
 * a read and the write that depends on it is outside what the spec
 * promises, even where an engine happens to allow it. Follow-up work goes
 * in a request's own `onsuccess`, which `readAll` below is for.
 */
function runTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore, report: (value: T) => void) => void
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction(STORE, mode);
        } catch (error) {
          reject(new VoiceStorageError("unavailable", error));
          return;
        }
        let result: T;
        tx.oncomplete = () => resolve(result);
        tx.onabort = tx.onerror = () => {
          const error = tx.error;
          reject(new VoiceStorageError(isQuotaError(error) ? "quota" : "unavailable", error));
        };
        try {
          work(tx.objectStore(STORE), (value) => {
            result = value;
          });
        } catch (error) {
          try {
            tx.abort();
          } catch {
            // already aborting
          }
          reject(new VoiceStorageError(isQuotaError(error) ? "quota" : "unavailable", error));
        }
      })
  );
}

/** Reads every row and hands it to `then` inside the request's own success
 * callback, so the transaction is still active for whatever `then` does
 * with the store. See runTransaction's comment for why that matters. */
function readAll(
  store: IDBObjectStore,
  then: (rows: StoredRecording[]) => void
): void {
  const request = store.getAll() as IDBRequest<StoredRecording[]>;
  request.onsuccess = () => then(request.result ?? []);
}

/** Every record belonging to one account, newest first. */
export async function listRecordings(ownerScope: string): Promise<StoredRecording[]> {
  const all = await runTransaction<StoredRecording[]>("readonly", (store, report) =>
    readAll(store, (rows) => report(rows))
  );
  return all.filter((r) => r.ownerScope === ownerScope).sort((a, b) => b.createdAt - a.createdAt);
}

/** How much of the device this account's recordings are using — the number
 * shown in the profile next to the "delete my recordings" button. */
export async function usageFor(ownerScope: string): Promise<StorageUsage> {
  const rows = await listRecordings(ownerScope);
  return { count: rows.length, bytes: rows.reduce((sum, r) => sum + r.bytes, 0) };
}

export async function getRecording(
  ownerScope: string,
  target: { level: string; lessonSlug: string; itemKey: string }
): Promise<StoredRecording | null> {
  const key = recordingKey(ownerScope, target);
  const found = await runTransaction<StoredRecording | undefined>("readonly", (store, report) => {
    const request = store.get(key) as IDBRequest<StoredRecording | undefined>;
    request.onsuccess = () => report(request.result);
  });
  return found ?? null;
}

/**
 * Save one take, replacing whatever was stored for the same item — "one
 * last recording per phrase" is enforced by the key, so there is no
 * cleanup pass and no way to accumulate takes for a single item.
 *
 * Eviction happens inside the same transaction as the write, so a device
 * that dies mid-save either has the new clip and the freed space, or
 * neither, and never a half-trimmed store.
 */
export async function saveRecording(record: Omit<StoredRecording, "key">): Promise<void> {
  const key = recordingKey(record.ownerScope, record);
  await runTransaction<void>("readwrite", (store, report) => {
    readAll(store, (rows) => {
      const mine = rows.filter((r) => r.ownerScope === record.ownerScope);
      for (const victim of planEviction(mine, record.bytes, key)) store.delete(victim);
      store.put({ ...record, key });
      report(undefined);
    });
  });
}

export async function deleteRecording(
  ownerScope: string,
  target: { level: string; lessonSlug: string; itemKey: string }
): Promise<void> {
  const key = recordingKey(ownerScope, target);
  await runTransaction<void>("readwrite", (store, report) => {
    store.delete(key);
    report(undefined);
  });
}

/** The profile's "delete my recordings" button. Deletes this account's
 * records only: another account on the same device keeps theirs. */
export async function deleteAllRecordings(ownerScope: string): Promise<number> {
  return runTransaction<number>("readwrite", (store, report) => {
    readAll(store, (rows) => {
      const mine = rows.filter((r) => r.ownerScope === ownerScope);
      for (const record of mine) store.delete(record.key);
      report(mine.length);
    });
  });
}
