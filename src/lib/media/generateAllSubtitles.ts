import "server-only";
import { getAllMedia, saveMediaSubtitles } from "./data";
import { fetchRussianCaptions } from "@/lib/video-lesson/youtubeCaptions";
import { generateSubtitlesWithClaude } from "./generateSubtitlesWithClaude";

export interface SubtitleGenerationResult {
  id: string;
  title: string;
  status: "generated" | "failed";
  error?: string;
}

/**
 * Backfills timestamped subtitles for every catalog item that doesn't have
 * them yet (or all of them, with `force`). Used by the admin "Generar
 * subtítulos para todos los videos" button
 * (api/admin/media/generate-all-subtitles) — there's no CLI equivalent
 * (see check-media-embeds.ts's file header for why a plain `tsx` script
 * can't import this module).
 */
// Each video costs a real yt-dlp fetch + a Claude call (several seconds
// apiece), and the whole batch runs inside one serverless invocation with a
// hard wall-clock limit (see maxDuration on the calling route) — a large
// catalog cannot finish in a single request. Rather than let the platform
// kill the function mid-item, stop cleanly with time to spare and return
// whatever was done so far; already-saved items are skipped on the next
// call (same `!item.subtitles` filter below), so re-clicking "generate all"
// in the admin UI simply resumes where this call left off.
const TIME_BUDGET_MS = 45_000;

export async function generateMissingMediaSubtitles(
  options: { force?: boolean } = {},
): Promise<SubtitleGenerationResult[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("missing_api_key");
  }

  const allItems = await getAllMedia();
  const items = options.force
    ? allItems
    : allItems.filter((item) => !item.subtitles || item.subtitles.length === 0);

  const results: SubtitleGenerationResult[] = [];
  const deadline = Date.now() + TIME_BUDGET_MS;

  for (const item of items) {
    if (Date.now() > deadline) break;
    try {
      const captions = await fetchRussianCaptions(item.youtubeVideoId);
      if (!captions || captions.length === 0) {
        results.push({ id: item.id, title: item.title, status: "failed", error: "no_russian_captions" });
        continue;
      }
      const subtitles = await generateSubtitlesWithClaude({ title: item.title, captions });
      await saveMediaSubtitles(item.id, subtitles);
      results.push({ id: item.id, title: item.title, status: "generated" });
    } catch (error) {
      results.push({
        id: item.id,
        title: item.title,
        status: "failed",
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return results;
}
