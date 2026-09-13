import "server-only";
import { unlink } from "node:fs/promises";
import path from "node:path";

/**
 * What is LEFT of server-side voice storage: deletion, and nothing else.
 *
 * Owner's decision, 30.08.2026 — a practice recording never goes to a
 * server again. The recorder keeps it in the browser (IndexedDB, see
 * src/lib/voice-recordings-store.ts), there is no upload route any more,
 * and `saveVoiceSubmission` / `readVoiceSubmission` are gone from this
 * file rather than switched off behind a flag: a write path that still
 * exists is a write path that comes back.
 *
 * These two functions stay because recordings uploaded BEFORE that
 * decision are still in the Blob store, and an account deletion has to be
 * able to reach them. Deleting is the opposite of the thing that was
 * removed, and account deletion is the one place we promise it happens
 * (src/lib/legal/content.ts).
 *
 * The bulk clean-up of the pre-decision objects is deliberately NOT here.
 * It is scripts/delete-cloud-voice-recordings.mjs — dry-run by default,
 * one prefix at a time, with no --force — because how much of that data
 * to remove is the owner's call, not a side effect of a code change.
 */

/** Deletes one legacy recording by the URL stored in
 * VoiceSubmission.audioUrl — dispatches on its shape (absolute Blob URL
 * vs. relative local path) rather than on whether a token is configured,
 * so a row saved before the Blob store existed is still cleaned up
 * correctly. */
export async function deleteVoiceSubmission(audioUrl: string): Promise<void> {
  if (audioUrl.startsWith("http")) {
    const { del } = await import("@vercel/blob");
    await del(audioUrl);
    return;
  }
  await unlink(path.join(process.cwd(), "public", audioUrl));
}

/** Deletes every legacy recording under a user's prefix in one shot — used
 * on account deletion, where Prisma's cascade removes the VoiceSubmission
 * rows but can't reach the files/blobs they point to.
 *
 * Сам код уборки живёт в `voice-blob-cleanup.ts` и отсюда только
 * перевыставляется — долг 167: второй путь удаления
 * (`prisma/delete-test-accounts.ts`) обычный скрипт, а этот файл
 * открывается строкой `import "server-only"` и из скрипта не
 * импортируется в принципе. Один код на оба пути — единственный способ
 * не дать им разойтись снова. */
export { deleteAllVoiceSubmissionsForUser } from "./voice-blob-cleanup";
