import type { Exercise, VocabularyItem } from "@/lib/lessons/types";
import type { SubtitleLine } from "@/lib/video-lesson/types";

export const mediaLevels = ["A1", "A2", "B1", "B2"] as const;
export type MediaLevel = (typeof mediaLevels)[number];

export const mediaCategories = ["song", "movie", "video"] as const;
export type MediaCategory = (typeof mediaCategories)[number];

export function isMediaLevel(value: string): value is MediaLevel {
  return (mediaLevels as readonly string[]).includes(value);
}

export function isMediaCategory(value: string): value is MediaCategory {
  return (mediaCategories as readonly string[]).includes(value);
}

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
}
