import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  PREFERRED_RECORDING_TYPES,
  baseMimeType,
  voiceExtensionFor,
  voiceMimeFromNameIfKnown,
} from "./voice-formats";
import { MAX_RECORDINGS, MAX_TOTAL_BYTES, planEviction, recordingKey } from "./voice-recordings-store";

/**
 * The defect these guard against: the voice pipeline named the format
 * `audio/webm` in four places — the Blob in VoiceRecorder, the filename in
 * the upload route, the contentType handed to Vercel Blob, and the
 * fallback when reading one back. Three were guesses; on iOS Safari, where
 * MediaRecorder produces audio/mp4 and cannot produce WebM at all, all four
 * were false. What the student's own recording was called had nothing to do
 * with what it was.
 *
 * Two of those four places are gone with the upload (30.08.2026), and the
 * rule matters more rather than less: the reported type is now what goes
 * into IndexedDB and what the player is handed after a reload.
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

  it("round-trips the iOS format through a name", () => {
    const recorded = "audio/mp4;codecs=mp4a.40.2";
    const extension = voiceExtensionFor(recorded);
    expect(extension).toBe("m4a");
    expect(voiceMimeFromNameIfKnown(`grabacion.${extension}`)).toBe("audio/mp4");
  });

  it("round-trips the Chrome/Android format too", () => {
    const extension = voiceExtensionFor("audio/webm;codecs=opus");
    expect(extension).toBe("webm");
    expect(voiceMimeFromNameIfKnown(`x.${extension}`)).toBe("audio/webm");
  });

  it("survives a legacy Blob URL's query string", () => {
    expect(voiceMimeFromNameIfKnown("https://blob.example.com/x/abc.m4a?download=1")).toBe("audio/mp4");
  });

  it("rejects an unknown type instead of defaulting to webm", () => {
    // The whole point: an unknown format must not be quietly called
    // something it is not. That silent default is the original bug.
    expect(voiceExtensionFor("audio/flac")).toBeNull();
    expect(voiceExtensionFor("")).toBeNull();
    expect(voiceMimeFromNameIfKnown("recording")).toBeNull();
    expect(voiceMimeFromNameIfKnown("recording.bin")).toBeNull();
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

    const oldRule = { blobType: "audio/webm", filename: "recording.webm" };
    expect(baseMimeType(oldRule.blobType)).not.toBe(baseMimeType(asRecordedOnIos));
    expect(voiceMimeFromNameIfKnown(oldRule.filename)).not.toBe(baseMimeType(asRecordedOnIos));

    const extension = voiceExtensionFor(asRecordedOnIos)!;
    const played = baseMimeType(asRecordedOnIos);
    expect(played).toBe("audio/mp4");
    expect(voiceMimeFromNameIfKnown(`recording.${extension}`)).toBe(played);
  });

  /**
   * The class, not the instance. Four files agreed on a wrong constant for
   * as long as the constant lived in four places; one of them is enough to
   * bring the defect back. Two of the four no longer exist — the upload
   * route and its playback proxy were deleted with the upload — so the
   * list is the voice path as it is now, and the store that replaced them.
   * Read as text: importing them would drag in server-only modules.
   */
  const VOICE_PATH_FILES = [
    "src/components/lesson/VoiceRecorder.tsx",
    "src/lib/voice-recordings-store.ts",
    "src/lib/voice-storage.ts",
    "src/components/profile/VoiceRecordingsPanel.tsx",
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

  /**
   * The upload is gone from the code, not disabled. This is the check that
   * keeps it gone: no route to POST a recording to, and no call to one.
   * A flag would have been cheaper and would have rotted back on.
   */
  it("nothing in the app uploads a recording any more", () => {
    const routeDir = path.join(process.cwd(), "src/app/api/voice-submissions");
    expect(existsSync(routeDir), "the upload route must not come back").toBe(false);

    const recorder = readFileSync(
      path.join(process.cwd(), "src/components/lesson/VoiceRecorder.tsx"),
      "utf8"
    );
    expect(recorder).not.toMatch(/fetch\(/);
    expect(recorder).not.toMatch(/FormData/);
    expect(recorder).not.toMatch(/voice-submissions/);
  });
});

/**
 * The two caps and the eviction order. Pure functions, so the rule is
 * testable without a browser; the IndexedDB round-trip itself is proved
 * end-to-end in e2e/voice-recording-local.spec.ts, which is also where the
 * "no network request" claim is measured rather than asserted.
 */
describe("local recording store limits", () => {
  const rec = (key: string, bytes: number, createdAt: number) => ({ key, bytes, createdAt });

  it("keys one recording per phrase, per account", () => {
    const target = { level: "a1", lessonSlug: "1", itemKey: "Привет" };
    expect(recordingKey("scope1", target)).toBe(recordingKey("scope1", target));
    expect(recordingKey("scope1", target)).not.toBe(recordingKey("scope2", target));
    expect(recordingKey("scope1", target)).not.toBe(
      recordingKey("scope1", { ...target, itemKey: "Пока" })
    );
  });

  it("evicts nothing while both caps hold", () => {
    const existing = [rec("a", 1000, 1), rec("b", 1000, 2)];
    expect(planEviction(existing, 1000)).toEqual([]);
  });

  it("evicts the oldest first when the count cap is passed", () => {
    const existing = Array.from({ length: MAX_RECORDINGS }, (_, i) => rec(`k${i}`, 10, i + 1));
    expect(planEviction(existing, 10)).toEqual(["k0"]);
  });

  it("evicts by bytes as well as by count, oldest first", () => {
    const existing = [
      rec("old", MAX_TOTAL_BYTES / 2, 1),
      rec("mid", MAX_TOTAL_BYTES / 4, 2),
      rec("new", 100, 3),
    ];
    // 0.5 + 0.25 + tiny, plus another 0.5 incoming, is over the cap by a
    // quarter — dropping the oldest alone brings it back under.
    expect(planEviction(existing, MAX_TOTAL_BYTES / 2)).toEqual(["old"]);
  });

  it("keeps evicting until it fits, not just once", () => {
    const existing = [
      rec("old", MAX_TOTAL_BYTES / 4, 1),
      rec("mid", MAX_TOTAL_BYTES / 4, 2),
      rec("new", MAX_TOTAL_BYTES / 2, 3),
    ];
    // The store is already exactly full and the incoming clip is half the
    // cap: dropping only the oldest quarter still leaves it over. A
    // single-pass eviction would stop there and write anyway.
    expect(planEviction(existing, MAX_TOTAL_BYTES / 2)).toEqual(["old", "mid"]);
  });

  it("re-recording the same phrase frees its own bytes and evicts nobody", () => {
    // The failure this prevents: if the record being replaced counted as
    // competition for space, a student re-recording one phrase would
    // slowly evict every other phrase they had.
    const existing = [rec("same", MAX_TOTAL_BYTES - 1000, 1), rec("other", 500, 2)];
    expect(planEviction(existing, MAX_TOTAL_BYTES - 1000, "same")).toEqual([]);
  });

  it("control: the same store without the replacement hint DOES evict", () => {
    const existing = [rec("same", MAX_TOTAL_BYTES - 1000, 1), rec("other", 500, 2)];
    expect(planEviction(existing, MAX_TOTAL_BYTES - 1000)).toEqual(["same"]);
  });
});
