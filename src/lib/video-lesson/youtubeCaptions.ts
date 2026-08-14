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

    const lines: CaptionLine[] = [];
    for (const event of data.events ?? []) {
      const text = (event.segs ?? [])
        .map((seg) => seg.utf8 ?? "")
        .join("")
        .replace(/\n/g, " ")
        .trim();
      if (!text || event.tStartMs === undefined) continue;

      lines.push({
        start: Math.round(event.tStartMs) / 1000,
        end: Math.round(event.tStartMs + (event.dDurationMs ?? 2000)) / 1000,
        text,
      });
    }
    return lines;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
