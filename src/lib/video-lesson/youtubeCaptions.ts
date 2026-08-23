// Deliberately no `import "server-only"` — this module is dual-use, loaded
// both by Next API routes and directly by `tsx` from prisma/generate-
// media-subtitles.ts (a plain Node process, not a webpack/Next build, so
// the `server-only` shim wouldn't resolve there — see audio-assets.ts's
// file header for the same reasoning applied to another dual-use module).
// Safe: this file only exports Node-only APIs (execFile, fs, fetch to
// external hosts) that no client component imports or could usefully
// import.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, chmod, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
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

// Vercel's Node.js Functions have no `yt-dlp`/Python on PATH and no way to
// `pip install` at request time — that's the actual root cause of every
// "missing_ytdlp" error seen in production, not a one-off misconfiguration.
// Locally, `yt-dlp` is expected to already be on PATH (installed once via
// `pip install yt-dlp`, per .env.example) and we keep using that, so local
// dev behavior (including the ENOENT error if it's genuinely missing) is
// unchanged. In production we instead fetch yt-dlp's own standalone Linux
// binary (no Python required at all) into /tmp on first use per container
// and exec it from there — /tmp is writable and persists for the life of a
// warm container, so this only costs a download on cold starts.
//
// Version pinned deliberately (not "latest") so a binary that started an
// in-flight request never gets silently swapped mid-request, and so a
// yt-dlp release that breaks something is a controlled version bump here,
// not a surprise. Bump alongside the locally pip-installed version
// (`yt-dlp --version`) when YouTube-side breakage shows up.
const YTDLP_VERSION = "2025.10.14";
const YTDLP_LINUX_URL = `https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_linux`;
const YTDLP_LINUX_SHA256 = "83d2c55a8893b49d0ccd23f5c528acf06840fc59bd1100519832b60724af34b7";

let ytdlpBinaryPromise: Promise<string> | null = null;

// A `pip install --user yt-dlp` (no venv, no `pip3 install -e` — the setup
// this project's own .env.example tells you to run) puts the executable in
// a per-user bin directory that most shells do NOT add to PATH by default,
// especially when `next dev` is launched from something other than an
// interactive login shell (an IDE task runner, this agent's own Bash tool,
// etc.) — its child process only inherits whatever PATH that launcher
// already had. `execFile("yt-dlp", ...)` then fails ENOENT even though the
// binary is right there on disk. Rather than require every contributor to
// hand-edit their shell profile, check PATH first (respects a real
// install/venv/homebrew yt-dlp if one exists) and fall back to the common
// per-user pip bin locations for macOS and Linux.
const LOCAL_YTDLP_FALLBACK_CANDIDATES = [
  path.join(homedir(), "Library/Python/3.9/bin/yt-dlp"), // macOS `pip install --user`, matches .env.example
  path.join(homedir(), "Library/Python/3.11/bin/yt-dlp"),
  path.join(homedir(), "Library/Python/3.12/bin/yt-dlp"),
  path.join(homedir(), ".local/bin/yt-dlp"), // Linux `pip install --user`
];

let localYtDlpBinaryPromise: Promise<string> | null = null;

async function resolveLocalYtDlpBinary(): Promise<string> {
  if (!localYtDlpBinaryPromise) {
    localYtDlpBinaryPromise = (async () => {
      try {
        // `--version` is a cheap way to confirm PATH actually resolves it,
        // rather than just checking PATH string contents.
        await execFileAsync("yt-dlp", ["--version"]);
        return "yt-dlp";
      } catch (error) {
        if (!isCommandNotFound(error)) throw error;
      }
      for (const candidate of LOCAL_YTDLP_FALLBACK_CANDIDATES) {
        try {
          await access(candidate);
          return candidate;
        } catch {
          // not at this candidate path, keep looking
        }
      }
      // Nothing found anywhere — surface the original, familiar ENOENT
      // path so the existing "missing_ytdlp" error handling still applies.
      return "yt-dlp";
    })();
  }
  return localYtDlpBinaryPromise;
}

async function downloadYtDlpBinary(destination: string): Promise<void> {
  const response = await fetch(YTDLP_LINUX_URL, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`ytdlp_download_failed_${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());

  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== YTDLP_LINUX_SHA256) {
    throw new Error("ytdlp_checksum_mismatch");
  }

  await writeFile(destination, bytes);
  await chmod(destination, 0o755);
}

/**
 * Resolves the yt-dlp executable to invoke: the PATH-installed binary in
 * local dev, or a lazily-downloaded, checksum-verified standalone Linux
 * binary cached in /tmp on Vercel. Memoized per warm container so
 * concurrent requests don't race to download it twice.
 */
async function resolveYtDlpBinary(): Promise<string> {
  if (process.env.VERCEL !== "1") return resolveLocalYtDlpBinary();

  if (!ytdlpBinaryPromise) {
    const destination = path.join(tmpdir(), `yt-dlp-${YTDLP_VERSION}`);
    ytdlpBinaryPromise = access(destination)
      .catch(() => downloadYtDlpBinary(destination))
      .then(() => destination)
      .catch((error) => {
        // Don't cache a failed download — the next call should retry
        // rather than being stuck on a rejected promise for the
        // container's whole lifetime.
        ytdlpBinaryPromise = null;
        throw error;
      });
  }
  return ytdlpBinaryPromise;
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
    const ytdlpBinary = await resolveYtDlpBinary();
    try {
      await execFileAsync(
        ytdlpBinary,
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

// OpenAI's /v1/audio/transcriptions rejects uploads over 25MB.
const WHISPER_MAX_BYTES = 24 * 1024 * 1024;

let ffmpegBinaryPromise: Promise<string | null> | null = null;

/**
 * Resolves an ffmpeg binary for yt-dlp's `--ffmpeg-location`, or null if
 * none is available. No system ffmpeg was found on this machine (no
 * Homebrew either), but `pip install --user imageio-ffmpeg` bundles a
 * static binary and needs no system package manager — installed
 * specifically for this. Checks a real system `ffmpeg` on PATH first in
 * case one exists (respects it instead of shadowing it), and only falls
 * back to asking Python for imageio_ffmpeg's bundled copy.
 */
export async function resolveFfmpegBinary(): Promise<string | null> {
  if (!ffmpegBinaryPromise) {
    ffmpegBinaryPromise = (async () => {
      try {
        await execFileAsync("ffmpeg", ["-version"]);
        return "ffmpeg";
      } catch {
        // fall through to the Python-bundled copy
      }
      try {
        const { stdout } = await execFileAsync("python3", [
          "-c",
          "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())",
        ]);
        const binaryPath = stdout.trim();
        await access(binaryPath);
        return binaryPath;
      } catch {
        return null;
      }
    })();
  }
  return ffmpegBinaryPromise;
}

export interface DownloadedAudio {
  /** Absolute path to the downloaded file — actual container format varies
   * (webm/m4a/mp4) depending on what YouTube serves this video without a
   * PO token; Whisper reads the audio track directly regardless. */
  path: string;
  cleanup: () => Promise<void>;
}

/**
 * Downloads the smallest reasonable audio for a video — used only as a
 * fallback when `fetchRussianCaptions` finds no existing YouTube caption
 * track to extract for free (see prisma/generate-media-subtitles.ts).
 *
 * `18` (a legacy 360p progressive mp4, video+audio combined) is what
 * actually gets picked for most videos in practice: YouTube increasingly
 * gates its audio-only/higher-quality formats behind a PO token this app
 * doesn't have, but format 18 stays reliably available without one.
 * That's a real, un-negotiable 20-30MB+ download for a 10-minute video —
 * comfortably over Whisper's 25MB cap on its own. When ffmpeg is
 * available (resolveFfmpegBinary — a bundled static binary via
 * `pip install --user imageio-ffmpeg`, no system package manager needed),
 * yt-dlp re-encodes the downloaded video down to a mono 16kHz 32kbps
 * mp3 (`-x`), which shrinks a 10-minute video to ~2-3MB — Whisper reads
 * the audio track regardless of source quality, so this loses nothing
 * that matters for transcription. Without ffmpeg, falls back to shipping
 * the raw downloaded file as-is, which only works for shorter videos.
 */
export async function downloadAudioForWhisper(videoId: string): Promise<DownloadedAudio> {
  const dir = await mkdtemp(path.join(tmpdir(), "yt-audio-"));
  const outputTemplate = path.join(dir, `${videoId}.%(ext)s`);

  const cleanup = () => rm(dir, { recursive: true, force: true }).catch(() => {});

  try {
    const ytdlpBinary = await resolveYtDlpBinary();
    const ffmpegBinary = await resolveFfmpegBinary();

    const args = [
      "-f",
      "bestaudio/18/best",
      "--extractor-args",
      "youtube:player_client=android",
      "-o",
      outputTemplate,
    ];
    if (ffmpegBinary) {
      args.push(
        "-x",
        "--audio-format",
        "mp3",
        "--postprocessor-args",
        "-ac 1 -ar 16000 -b:a 32k",
        "--ffmpeg-location",
        ffmpegBinary,
      );
    }
    args.push(`https://www.youtube.com/watch?v=${videoId}`);

    try {
      await execFileAsync(ytdlpBinary, args, { timeout: 180_000, maxBuffer: 1024 * 1024 * 10 });
    } catch (error) {
      if (isCommandNotFound(error)) throw new Error("missing_ytdlp");
      throw new Error("audio_download_failed");
    }

    const files = await readdir(dir).catch(() => []);
    const audioFile = files[0];
    if (!audioFile) throw new Error("audio_download_failed");

    const filePath = path.join(dir, audioFile);
    const stats = await stat(filePath);
    if (stats.size > WHISPER_MAX_BYTES) {
      throw new Error("audio_too_large");
    }

    return { path: filePath, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
