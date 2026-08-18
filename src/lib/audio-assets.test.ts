import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PrismaClient } from "../generated/prisma/client";
import { ensureAudioAsset, hashText } from "./audio-assets";

type FakeDb = Pick<PrismaClient, "audioAsset">;

// A minimal fake of the one Prisma model surface ensureAudioAsset touches
// — no real DB needed to test the cost-policy branching itself.
function createFakeAudioAssetDb(initialRow?: {
  contentType: string;
  contentId: string;
  itemKey: string;
  textHash: string;
  audioUrl: string;
}) {
  const rows = new Map<string, typeof initialRow>();
  if (initialRow) {
    rows.set(`${initialRow.contentType}:${initialRow.contentId}:${initialRow.itemKey}`, initialRow);
  }
  return {
    audioAsset: {
      findUnique: vi.fn(async ({ where }: { where: { contentType_contentId_itemKey: Record<string, string> } }) => {
        const { contentType, contentId, itemKey } = where.contentType_contentId_itemKey;
        return rows.get(`${contentType}:${contentId}:${itemKey}`) ?? null;
      }),
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { contentType_contentId_itemKey: Record<string, string> };
          create: { contentType: string; contentId: string; itemKey: string; textHash: string; audioUrl: string };
        }) => {
          const { contentType, contentId, itemKey } = where.contentType_contentId_itemKey;
          rows.set(`${contentType}:${contentId}:${itemKey}`, create);
        }
      ),
    },
  } as unknown as FakeDb;
}

describe("ensureAudioAsset — cost policy: audio is permanent unless force is explicit", () => {
  let audioDir: string;

  beforeEach(async () => {
    audioDir = await mkdtemp(path.join(os.tmpdir(), "audio-assets-test-"));
  });

  afterEach(async () => {
    await rm(audioDir, { recursive: true, force: true });
  });

  it("synthesizes (paid) when no clip exists yet for this key", async () => {
    const db = createFakeAudioAssetDb();
    const synthesize = vi.fn().mockResolvedValue(Buffer.from("fake-mp3"));

    const result = await ensureAudioAsset(db, {
      contentType: "story",
      contentId: "story-1",
      itemKey: "0-0",
      text: "Привет",
      voice: "alloy",
      model: "gpt-4o-mini-tts",
      audioDir,
      publicPath: "/audio/stories/story-1",
      fileName: "0-0.mp3",
      synthesize,
    });

    expect(result.status).toBe("generated");
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it("never re-synthesizes an existing clip just because the text changed (no force)", async () => {
    const oldText = "Привет, как дела?";
    const db = createFakeAudioAssetDb({
      contentType: "story",
      contentId: "story-1",
      itemKey: "0-0",
      textHash: hashText(oldText),
      audioUrl: "/audio/stories/story-1/0-0.mp3",
    });
    const synthesize = vi.fn().mockResolvedValue(Buffer.from("should-not-be-called"));

    // Same key, but the text has been edited (a typo fix) since narration.
    const result = await ensureAudioAsset(db, {
      contentType: "story",
      contentId: "story-1",
      itemKey: "0-0",
      text: "Привет, как дела сегодня?",
      voice: "alloy",
      model: "gpt-4o-mini-tts",
      audioDir,
      publicPath: "/audio/stories/story-1",
      fileName: "0-0.mp3",
      synthesize,
    });

    expect(synthesize).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "cached",
      audioUrl: "/audio/stories/story-1/0-0.mp3",
      textStale: true,
    });
  });

  it("reports textStale: false when the cached clip's text still matches", async () => {
    const text = "Привет, как дела?";
    const db = createFakeAudioAssetDb({
      contentType: "story",
      contentId: "story-1",
      itemKey: "0-0",
      textHash: hashText(text),
      audioUrl: "/audio/stories/story-1/0-0.mp3",
    });
    const synthesize = vi.fn();

    const result = await ensureAudioAsset(db, {
      contentType: "story",
      contentId: "story-1",
      itemKey: "0-0",
      text,
      voice: "alloy",
      model: "gpt-4o-mini-tts",
      audioDir,
      publicPath: "/audio/stories/story-1",
      fileName: "0-0.mp3",
      synthesize,
    });

    expect(synthesize).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "cached", audioUrl: "/audio/stories/story-1/0-0.mp3", textStale: false });
  });

  it("only re-synthesizes an edited item when force is explicitly passed", async () => {
    const oldText = "Привет, как дела?";
    const db = createFakeAudioAssetDb({
      contentType: "story",
      contentId: "story-1",
      itemKey: "0-0",
      textHash: hashText(oldText),
      audioUrl: "/audio/stories/story-1/0-0.mp3",
    });
    const synthesize = vi.fn().mockResolvedValue(Buffer.from("new-mp3"));

    const result = await ensureAudioAsset(db, {
      contentType: "story",
      contentId: "story-1",
      itemKey: "0-0",
      text: "Привет, как дела сегодня?",
      voice: "alloy",
      model: "gpt-4o-mini-tts",
      force: true,
      audioDir,
      publicPath: "/audio/stories/story-1",
      fileName: "0-0.mp3",
      synthesize,
    });

    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("generated");
  });
});
