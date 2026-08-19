import "server-only";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Vercel's serverless functions have a read-only filesystem outside a
// single request's own /tmp — a write to public/ at request time never
// persists or gets served on the next request, which is exactly what made
// voice-submission uploads a hard 500 in production while working fine
// locally. Vercel Blob is real persistent object storage and fixes that.
//
// With no BLOB_READ_WRITE_TOKEN set, this falls back to the original
// public/ filesystem writes — the same "no credentials → local/dev
// fallback" convention as stripe.ts and email.ts elsewhere in this app.
// That fallback still works locally because `next dev` is a long-lived
// process, not a stateless serverless function — only production needs
// the real Blob store.
const LOCAL_DIR = path.join(process.cwd(), "public", "audio", "submissions");

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Saves one voice recording and returns the URL to store as
 * VoiceSubmission.audioUrl — an absolute Blob URL in production, or a
 * relative /audio/submissions/... path in the local fallback. */
export async function saveVoiceSubmission(
  userId: string,
  itemDir: string,
  filename: string,
  bytes: Buffer
): Promise<string> {
  if (hasBlobToken()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`submissions/${userId}/${itemDir}/${filename}`, bytes, {
      access: "public",
      contentType: "audio/webm",
    });
    return blob.url;
  }

  const dir = path.join(LOCAL_DIR, userId, itemDir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes);
  return `/audio/submissions/${userId}/${itemDir}/${filename}`;
}

/** Deletes one recording by the URL stored in VoiceSubmission.audioUrl —
 * dispatches on its shape (absolute Blob URL vs. relative local path)
 * rather than on hasBlobToken(), so a row saved before the Blob store
 * existed is still cleaned up correctly after the token is added. */
export async function deleteVoiceSubmission(audioUrl: string): Promise<void> {
  if (audioUrl.startsWith("http")) {
    const { del } = await import("@vercel/blob");
    await del(audioUrl);
    return;
  }
  await unlink(path.join(process.cwd(), "public", audioUrl));
}

/** Deletes every recording under a user's prefix in one shot — used on
 * account deletion, where Prisma's cascade removes the VoiceSubmission
 * rows but can't reach the files/blobs they point to. */
export async function deleteAllVoiceSubmissionsForUser(userId: string): Promise<void> {
  if (hasBlobToken()) {
    const { list, del } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: `submissions/${userId}/` });
    if (blobs.length > 0) {
      await del(blobs.map((blob) => blob.url));
    }
    return;
  }
  await rm(path.join(LOCAL_DIR, userId), { recursive: true, force: true });
}
