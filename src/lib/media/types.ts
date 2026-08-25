import type { Exercise, VocabularyItem } from "@/lib/lessons/types";
import type { SubtitleLine } from "@/lib/video-lesson/types";

export const mediaLevels = ["A1", "A2", "B1", "B2", "C1"] as const;
export type MediaLevel = (typeof mediaLevels)[number];

export const mediaCategories = ["grammar", "song", "movie", "video"] as const;
export type MediaCategory = (typeof mediaCategories)[number];

export function isMediaLevel(value: string): value is MediaLevel {
  return (mediaLevels as readonly string[]).includes(value);
}

export function isMediaCategory(value: string): value is MediaCategory {
  return (mediaCategories as readonly string[]).includes(value);
}

export const embedStatuses = ["ok", "blocked", "unchecked"] as const;
export type EmbedStatus = (typeof embedStatuses)[number];

export interface MediaLine {
  russian: string;
  translation: string;
}

export interface MediaItem {
  id: string;
  title: string;
  description: string;
  level: MediaLevel;
  category: MediaCategory;
  /** Free-trial-sample item, visible (full player/subtitles/exercises) to
   * anyone with no subscription — a curated ~7-item taste of the section
   * (1 alphabet video, 4 "documentary"-style videos across history/
   * nature/travel/culture, 1 song, 1 movie, all with generated subtitles
   * where relevant). Absent/false for everything else, which needs any
   * active subscription — see [lang]/media/page.tsx and [id]/page.tsx. */
  free?: boolean;
  youtubeVideoId: string;
  /** Song lyrics or movie/scene transcript, line by line with translation. */
  lyricsOrTranscript: MediaLine[];
  /**
   * Timestamped bilingual subtitles for the overlay/transcript player.
   * Optional — older entries only have `lyricsOrTranscript` (no timecodes)
   * until backfilled via the admin "Generar subtítulos con Claude" action.
   */
  subtitles?: SubtitleLine[];
  vocabulary: VocabularyItem[];
  exercises: Exercise[];
  /** Related story IDs from the reading library (`Story.id`), for cross-linking similar themes/plots. */
  relatedStoryIds?: string[];
  /** Result of the last `yt-dlp` embed/copyright check (see rusofasil_media_content_policy memory). Defaults to "unchecked" when absent. */
  embedStatus?: EmbedStatus;
  /** ISO date of the last embed-status check. */
  lastCheckedAt?: string;
  /** Free-text note on the source/performer, e.g. flagging why a candidate was rejected or swapped. */
  sourceNote?: string;
  /**
   * For `category: "grammar"` items only: the matching lesson id in
   * `src/lib/lessons/content.json` (e.g. "a1-7") whose `grammar.title`
   * this video explains in Spanish, so it can slot into the curriculum
   * sequence instead of floating as a generic video.
   */
  curriculumLessonId?: string;
}
