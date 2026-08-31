import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Narration is generated ONCE, offline, and then it is a file.
 *
 * The rule, in full, is written down in PROGRESS.md ("ОЗВУЧКА ГЕНЕРИТСЯ ОДИН
 * РАЗ"): every clip of course narration is produced by a script under
 * `prisma/`, written to `public/audio/` and to Vercel Blob, and recorded in
 * the `AudioAsset` table. Playback reads that file. A second call to a
 * paid text-to-speech API for text that already has a clip is a regression
 * — in cost, which scales with listeners instead of with content, and in
 * honesty, because the Privacy Policy tells the reader that listening sends
 * nothing to OpenAI.
 *
 * Measured before this test was written (30.08.2026): 4310 per-fragment mp3
 * files on disk and in Blob, and zero TTS calls at runtime. This test's job
 * is to keep the second number at zero. It is not a style rule: the failure
 * it guards against would be invisible — the audio would sound the same.
 *
 * `src/` is the runtime. `prisma/` and `scripts/` are the workshop, and are
 * deliberately NOT scanned: that is where generation belongs.
 */

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "generated") continue;
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Every way this codebase has ever reached a text-to-speech API, and the
 * shapes the OpenAI SDK offers for it. Comments are stripped before this
 * runs, so a file may still *describe* the offline pipeline in prose — as
 * src/lib/speech.ts and src/lib/audio-assets.ts both do. */
const TTS_CALL = [
  /api\.openai\.com\/v1\/audio\/speech/,
  /audio\s*\.\s*speech\s*\.\s*create/,
  /["'`]tts-1(-hd)?["'`]/,
  /["'`]gpt-4o-mini-tts["'`]/,
];

function withoutComments(source: string): string {
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      // The `[^:]` is not decoration. Without it the `//` in
      // "https://api.openai.com/v1/audio/speech" starts a line comment and
      // blanks the rest of the line — which is exactly how the first draft
      // of this scanner passed with a planted TTS call sitting in src/.
      // Caught by the positive control, which is the only reason it is not
      // still passing.
      .replace(/(^|[^:])\/\/[^\n]*/g, (m, before: string) => before + " ".repeat(m.length - before.length))
  );
}

describe("no text-to-speech call in runtime code", () => {
  const files = sourceFiles(SRC);

  it("finds files to scan at all", () => {
    // An empty scan would make the assertion below pass while measuring
    // nothing — PROGRESS.md 4.1.
    expect(files.length).toBeGreaterThan(200);
  });

  it("nothing under src/ calls a speech API", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = withoutComments(readFileSync(file, "utf8"));
      for (const pattern of TTS_CALL) {
        const hit = source.match(pattern);
        if (hit) offenders.push(`${relative(SRC, file)}: ${hit[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("positive control: a planted call is reported", () => {
    // The scanner must be able to see the thing it says is absent.
    const planted = [
      'const res = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST" });',
      'const mp3 = await openai.audio.speech.create({ model: "tts-1", input: text });',
      'const mp3 = await client.audio.speech.create({ model: "gpt-4o-mini-tts", voice: "nova" });',
    ];
    for (const line of planted) {
      expect(TTS_CALL.some((p) => p.test(line)), line).toBe(true);
    }
  });

  it("positive control: prose about the offline pipeline is NOT reported", () => {
    // Otherwise the scan would fire on src/lib/speech.ts's own doc comment
    // and the rule would be quietly disabled to make the suite green.
    const prose = "  // the server-side OpenAI TTS script (prisma/generate-story-audio.ts)";
    const stripped = withoutComments(prose);
    expect(TTS_CALL.some((p) => p.test(stripped))).toBe(false);
  });

  it("generation still lives where it belongs, so this is a boundary and not a ban", () => {
    // If prisma/ ever stopped containing the generator, the assertion above
    // would be trivially true and would have stopped meaning anything.
    const generator = readFileSync(join(process.cwd(), "prisma", "generate-story-audio.ts"), "utf8");
    expect(generator).toContain("https://api.openai.com/v1/audio/speech");
  });
});
