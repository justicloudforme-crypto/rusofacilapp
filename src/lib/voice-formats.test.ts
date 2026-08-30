import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PREFERRED_RECORDING_TYPES,
  baseMimeType,
  resolveUploadMime,
  voiceExtensionFor,
  voiceMimeFromUrl,
  voiceMimeFromUrlIfKnown,
} from "./voice-formats";

/**
 * The defect these guard against: the voice pipeline named the format
 * `audio/webm` in four places — the Blob in VoiceRecorder, the filename in
 * the upload route, the contentType handed to Vercel Blob, and the
 * fallback in readVoiceSubmission. Three were guesses; on iOS Safari, where
 * MediaRecorder produces audio/mp4 and cannot produce WebM at all, all four
 * were false. What the student's own recording was called had nothing to do
 * with what it was.
 */
describe("voice recording formats", () => {
  it("has an extension for every format the recorder may hand back", () => {
    for (const type of PREFERRED_RECORDING_TYPES) {
      expect(voiceExtensionFor(type), type).not.toBeNull();
    }
  });

  it("strips codec parameters, which MediaRecorder always reports", () => {
    expect(baseMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(baseMimeType("audio/mp4; codecs=mp4a.40.2")).toBe("audio/mp4");
    expect(baseMimeType("AUDIO/MP4")).toBe("audio/mp4");
  });

  it("round-trips the iOS format through a stored filename", () => {
    // What iOS Safari's MediaRecorder reports, all the way to what the
    // playback route must answer with.
    const recorded = "audio/mp4;codecs=mp4a.40.2";
    const extension = voiceExtensionFor(recorded);
    expect(extension).toBe("m4a");
    const stored = `/audio/submissions/u1/a1-a1-1/abc-123.${extension}`;
    expect(voiceMimeFromUrl(stored)).toBe("audio/mp4");
  });

  it("round-trips the Chrome/Android format too", () => {
    const extension = voiceExtensionFor("audio/webm;codecs=opus");
    expect(extension).toBe("webm");
    expect(voiceMimeFromUrl(`/x/y.${extension}`)).toBe("audio/webm");
  });

  it("survives a Blob URL's query string", () => {
    expect(voiceMimeFromUrl("https://blob.example.com/x/abc.m4a?download=1")).toBe("audio/mp4");
  });

  it("rejects an unknown type instead of defaulting to webm", () => {
    // The whole point: an unknown format must not be quietly stored as
    // something it is not. That silent default is the original bug.
    expect(voiceExtensionFor("audio/flac")).toBeNull();
    expect(voiceExtensionFor("")).toBeNull();
    expect(voiceMimeFromUrlIfKnown("recording")).toBeNull();
    expect(resolveUploadMime("application/octet-stream", "recording.bin")).toBeNull();
  });

  it("falls back to the filename when the browser declares no type", () => {
    // Some browsers hand over a Blob with an empty `type`. Rejecting those
    // would break uploads that used to work, so the name is the second
    // source — but only the name, never a constant.
    expect(resolveUploadMime("", "recording.m4a")).toBe("audio/mp4");
    expect(resolveUploadMime("", "recording.webm")).toBe("audio/webm");
    expect(resolveUploadMime("audio/mp4;codecs=mp4a.40.2", "recording.webm")).toBe("audio/mp4");
  });

  /**
   * Positive control. Without it, everything above could pass on code that
   * still hard-codes the format: the assertions describe the RIGHT answer,
   * not the difference between right and wrong. This reproduces the old
   * rule — "call it audio/webm, whatever it is" — and shows the round-trip
   * really does disagree with the data under it, and agrees under the new
   * one. If this ever stops failing, the check above has stopped measuring.
   */
  it("control: the old constant mislabels an iOS recording, the new rule does not", () => {
    const asRecordedOnIos = "audio/mp4;codecs=mp4a.40.2";

    const oldRule = { blobType: "audio/webm", filename: "recording.webm", served: "audio/webm" };
    expect(baseMimeType(oldRule.blobType)).not.toBe(baseMimeType(asRecordedOnIos));
    expect(voiceMimeFromUrl(oldRule.filename)).not.toBe(baseMimeType(asRecordedOnIos));
    expect(oldRule.served).not.toBe(baseMimeType(asRecordedOnIos));

    const extension = voiceExtensionFor(asRecordedOnIos)!;
    const newRule = {
      blobType: baseMimeType(asRecordedOnIos),
      filename: `recording.${extension}`,
      served: voiceMimeFromUrl(`recording.${extension}`),
    };
    expect(newRule.blobType).toBe("audio/mp4");
    expect(newRule.served).toBe("audio/mp4");
    expect(voiceMimeFromUrl(newRule.filename)).toBe(newRule.blobType);
  });

  /**
   * The class, not the instance. Four files agreed on a wrong constant for
   * as long as the constant lived in four places; one of them is enough to
   * bring the defect back. Read as text — importing them would drag in
   * server-only modules and a Prisma client.
   */
  const VOICE_PATH_FILES = [
    "src/components/lesson/VoiceRecorder.tsx",
    "src/lib/voice-storage.ts",
    "src/app/api/voice-submissions/route.ts",
    "src/app/api/voice-submissions/[id]/route.ts",
  ];

  /** String and template literals only — the same words appear in the
   * comments that explain this defect, and a comment cannot mislabel a
   * file. */
  function audioMimeLiterals(source: string): string[] {
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    return [...withoutComments.matchAll(/["'`](audio\/[a-z0-9.+-]+)["'`]/g)].map((m) => m[1]);
  }

  it("no file on the voice path hard-codes an audio MIME type", () => {
    const offenders: string[] = [];
    for (const file of VOICE_PATH_FILES) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      for (const literal of audioMimeLiterals(source)) offenders.push(`${file}: "${literal}"`);
    }
    expect(offenders).toEqual([]);
  });

  it("control: the scanner finds the literal it is looking for", () => {
    // The exact line as it shipped, plus one in a comment that must NOT
    // count — the first version of this scanner flagged its own
    // explanation and would have been "fixed" by deleting the comment.
    const before = `
      // the blob used to be audio/webm no matter what
      /* and audio/webm again, in a block comment */
      const blob = new Blob(chunks, { type: "audio/webm" });
    `;
    expect(audioMimeLiterals(before)).toEqual(["audio/webm"]);
    expect(audioMimeLiterals(`const blob = new Blob(chunks, { type });`)).toEqual([]);
  });
});
