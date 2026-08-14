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
 * them yet (or all of them, with `force`). Shared by the admin "Generar
 * subtítulos para todos los videos" button (api/admin/media/generate-all-subtitles)
 * and the `npm run generate:media-subtitles` CLI script, so both stay in sync.
 */
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

  for (const item of items) {
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
