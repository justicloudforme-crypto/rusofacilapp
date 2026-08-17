/**
 * Shared cache logic for every pre-generated (paid, OpenAI) narration clip
 * in the app — see the `AudioAsset` model in prisma/schema.prisma for the
 * full rationale. Every generate-*-audio.ts CLI script calls
 * `ensureAudioAsset()` instead of rolling its own "check cache, else call
 * the provider, else write the file+row" logic.
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
  | { status: "cached"; audioUrl: string }
  | { status: "generated"; audioUrl: string }
  | { status: "failed"; error: string };

/**
 * Looks up an existing clip for (contentType, contentId, itemKey) whose
 * stored textHash still matches `text` — if found (and `force` isn't set),
 * returns it with zero provider calls. Otherwise synthesizes a fresh clip,
 * writes it to disk, and upserts the cache row (so a text edit regenerates
 * only that one item, not the whole content type's corpus).
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
    if (existing && existing.textHash === textHash) {
      return { status: "cached", audioUrl: existing.audioUrl };
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
