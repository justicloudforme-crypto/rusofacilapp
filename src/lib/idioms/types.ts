import type { StoryLevel } from "@/lib/stories";

export type IdiomCategory = "daily" | "proverbs" | "literary";

export const idiomCategories: IdiomCategory[] = ["daily", "proverbs", "literary"];

export interface Idiom {
  id: string;
  phrase: string;
  literalTranslation: string;
  spanishEquivalent: string;
  explanation: string;
  contextExampleRu: string;
  contextExampleEs: string;
  category: IdiomCategory;
  // CEFR level (same StoryLevel scale as the reading library) — see the
  // Idiom.level comment in prisma/schema.prisma for why every pre-existing
  // row defaults to "A2".
  level: StoryLevel;
  /** Pre-generated narration for `phrase` and `contextExampleRu` (see
   * prisma/generate-idiom-audio.ts), attached server-side by /api/idioms.
   * Undefined until that generation pass runs. */
  audioUrl?: string;
  contextExampleAudioUrl?: string;
}
