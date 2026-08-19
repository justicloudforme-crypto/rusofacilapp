import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CaptionLine {
  start: number;
  end: number;
  text: string;
}

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8?: string }[];
}

function isCommandNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "ENOENT";
}

/**
 * Fetches the Russian caption track for a public YouTube video (manual
 * captions preferred, falling back to auto-generated) via the `yt-dlp` CLI.
 *
 * We used to scrape YouTube's undocumented `timedtext` endpoint directly
 * with `fetch`, but YouTube now soft-blocks that endpoint for non-browser
 * traffic (responds 200 with an empty body). `yt-dlp` ships its own
 * workarounds for YouTube's bot detection (client emulation, cipher
 * extraction, etc.) and is kept up to date upstream as YouTube changes
 * things — install it with `pip install yt-dlp` (see .env.example).
 */
export async function fetchRussianCaptions(videoId: string): Promise<CaptionLine[] | null> {
  const dir = await mkdtemp(path.join(tmpdir(), "yt-captions-"));
  const outputPrefix = path.join(dir, videoId);

  try {
    try {
      await execFileAsync(
        "yt-dlp",
        [
          "--skip-download",
          "--write-subs",
          "--write-auto-sub",
          "--sub-lang",
          "ru",
          "--sub-format",
          "json3",
          // Avoids the "The page needs to be reloaded" cipher-extraction
          // failure that hits the default web client for some videos.
          "--extractor-args",
          "youtube:player_client=android",
          "-o",
          outputPrefix,
          `https://www.youtube.com/watch?v=${videoId}`,
        ],
        { timeout: 60_000 },
      );
    } catch (error) {
      if (isCommandNotFound(error)) throw new Error("missing_ytdlp");
      // yt-dlp also exits non-zero when the video simply has no captions —
      // treat that the same as "not found" rather than a hard failure.
      return null;
    }

    const files = await readdir(dir).catch(() => []);
    const subtitleFile = files.find((file) => file.endsWith(".json3"));
    if (!subtitleFile) return null;

    const raw = await readFile(path.join(dir, subtitleFile), "utf-8");
    let data: { events?: Json3Event[] };
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }

    const rawEvents = data.events ?? [];
    const lines: CaptionLine[] = [];
    for (let i = 0; i < rawEvents.length; i++) {
      const event = rawEvents[i];
      const text = (event.segs ?? [])
        .map((seg) => seg.utf8 ?? "")
        .join("")
        .replace(/\n/g, " ")
        .trim();
      if (!text || event.tStartMs === undefined) continue;

      const start = event.tStartMs;
      let end: number;
      if (event.dDurationMs !== undefined) {
        end = start + event.dDurationMs;
      } else {
        // YouTube's json3 auto-caption events frequently omit
        // dDurationMs entirely — this used to fall back to a flat 2s for
        // every such event regardless of how long the line is actually
        // spoken, which is a real, systematic desync (not just ASR
        // imprecision): a line spoken for 4-5s still got a 2s highlight
        // window. json3 events are sequential and back-to-back, so the
        // NEXT event's own start is a far more accurate end for this one
        // than a fixed guess — capped so a real silence gap between
        // lines doesn't stretch one caption's highlight across it.
        const nextStart = rawEvents[i + 1]?.tStartMs;
        end = nextStart !== undefined ? Math.min(nextStart, start + 8000) : start + 2000;
      }

      lines.push({
        start: Math.round(start) / 1000,
        end: Math.round(end) / 1000,
        text,
      });
    }
    return lines;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
