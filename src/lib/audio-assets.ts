/**
 * Shared cache logic for every pre-generated (paid, OpenAI) narration clip
 * in the app — see the `AudioAsset` model in prisma/schema.prisma for the
 * full rationale. Every generate-*-audio.ts CLI script calls
 * `ensureAudioAsset()` instead of rolling its own "check cache, else call
 * the provider, else write the file+row" logic.
 *
 * STANDING COST POLICY (explicit project owner directive): once a clip
 * exists for a given (contentType, contentId, itemKey), it is PERMANENT.
 * Editing the underlying text — fixing a typo, rewording a sentence —
 * never triggers an automatic re-synthesis, no matter how much the text
 * has drifted from what was actually narrated. Re-narrating a specific
 * item only ever happens when a human explicitly passes `force: true` for
 * that exact item (see each generate-*-audio.ts script's --story=/
 * --lesson=/--category= scoping flags) — never as a side effect of a
 * content edit or a routine re-run. This was a deliberate reversal of an
 * earlier "auto re-sync on text change" design: that behavior meant a
 * plain typo fix silently re-billed paid TTS generation, which is
 * unacceptable at this app's content-editing cadence. `textHash` is still
 * stored and still compared, but purely as a read-only staleness signal a
 * caller can surface to a human ("this text changed since narration") —
 * it must never by itself cause a write or a provider call.
 *
 * Deliberately dependency-light: no `@/` import alias (this file is loaded
 * both by Next.js and directly by `tsx` from prisma/*.ts scripts, and tsx
 * doesn't apply tsconfig's path aliases — every existing prisma/*.ts script
 * already sticks to relative imports for exactly this reason) and the
 * Prisma client is passed in rather than imported from src/lib/db.ts, so
 * this same function works with a script's own standalone PrismaClient
 * instance and with Next's request-scoped singleton alike.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "../generated/prisma/client";

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export interface EnsureAudioAssetParams {
  contentType: string;
  contentId: string;
  itemKey: string;
  text: string;
  voice: string;
  model: string;
  /** Regenerate even if a cached clip with a matching textHash exists. */
  force?: boolean;
  /** Absolute filesystem directory to write the clip into (created if missing). */
  audioDir: string;
  /** Public URL path the written file will be served at, e.g. "/audio/stories/abc123". */
  publicPath: string;
  /** Just the file's own name, e.g. "3-1.mp3". */
  fileName: string;
  synthesize: (text: string, voice: string) => Promise<Buffer>;
}

export type EnsureAudioAssetResult =
  | { status: "cached"; audioUrl: string; textStale: boolean }
  | { status: "generated"; audioUrl: string }
  | { status: "failed"; error: string };

/**
 * Looks up an existing clip for (contentType, contentId, itemKey) — if one
 * exists (and `force` isn't explicitly set), returns it with zero provider
 * calls, REGARDLESS of whether `text` still matches what was narrated.
 * `textStale: true` on the result means the text has drifted since
 * narration — surface that to a human for a possible manual `force`
 * re-run, but never act on it automatically here. Only synthesizes (a
 * paid call) when no clip exists yet for this exact key, or when the
 * caller explicitly passes `force: true` for this exact item. See the
 * STANDING COST POLICY note at the top of this file.
 */
export async function ensureAudioAsset(
  db: Pick<PrismaClient, "audioAsset">,
  params: EnsureAudioAssetParams
): Promise<EnsureAudioAssetResult> {
  const { contentType, contentId, itemKey, text, voice, model, force, audioDir, publicPath, fileName, synthesize } =
    params;
  const textHash = hashText(text);

  if (!force) {
    const existing = await db.audioAsset.findUnique({
      where: { contentType_contentId_itemKey: { contentType, contentId, itemKey } },
    });
    if (existing) {
      return { status: "cached", audioUrl: existing.audioUrl, textStale: existing.textHash !== textHash };
    }
  }

  try {
    await mkdir(audioDir, { recursive: true });
    const buffer = await synthesize(text, voice);
    await writeFile(path.join(audioDir, fileName), buffer);
    const audioUrl = `${publicPath}/${fileName}`;
    await db.audioAsset.upsert({
      where: { contentType_contentId_itemKey: { contentType, contentId, itemKey } },
      update: { textHash, text, voice, model, audioUrl },
      create: { contentType, contentId, itemKey, textHash, text, voice, model, audioUrl },
    });
    return { status: "generated", audioUrl };
  } catch (error) {
    return { status: "failed", error: (error as Error).message };
  }
}
