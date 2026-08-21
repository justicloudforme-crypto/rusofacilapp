// No `import "server-only"` and relative (not `@/`) imports — dual-use
// module, also loaded directly by `tsx` from prisma/generate-media-
// subtitles.ts. See youtubeCaptions.ts's file header for the reasoning.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CaptionLine } from "../video-lesson/youtubeCaptions";

const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";

interface WhisperVerboseSegment {
  start: number;
  end: number;
  text: string;
}

interface WhisperVerboseResponse {
  segments?: WhisperVerboseSegment[];
}

/**
 * Fallback transcription for videos with no YouTube caption track at all
 * (see downloadAudioForWhisper's caller in prisma/generate-media-subtitles.ts)
 * — OpenAI's Whisper API, forced to Russian since auto-detection has
 * misfired on short/accented clips in this app's testing. `verbose_json`
 * gives per-segment timestamps, the same shape fetchRussianCaptions
 * already produces from YouTube's own caption tracks, so downstream code
 * (generateSubtitlesWithClaude) doesn't need to know which source it came
 * from.
 */
export async function transcribeAudioWithWhisper(audioPath: string): Promise<CaptionLine[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("missing_openai_key");
  }

  const buffer = await readFile(audioPath);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), path.basename(audioPath));
  form.append("model", "whisper-1");
  form.append("language", "ru");
  form.append("response_format", "verbose_json");

  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
    // A ~20-minute audio file can take a couple of minutes to transcribe —
    // this only ever runs from the local CLI script, never a serverless
    // route, so there's no platform wall-clock ceiling to stay under.
    signal: AbortSignal.timeout(600_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`whisper_error_${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as WhisperVerboseResponse;
  const segments = data.segments ?? [];

  return segments
    .map((seg) => ({ start: seg.start, end: seg.end, text: seg.text.trim() }))
    .filter((line) => line.text.length > 0);
}
