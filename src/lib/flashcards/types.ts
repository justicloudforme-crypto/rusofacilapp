export type FlashcardCategory =
  | "food"
  | "shopping"
  | "city"
  | "work"
  | "family"
  | "health"
  | "feelings"
  | "motionVerbs"
  | "greetings"
  | "technology"
  | "travel"
  | "weather"
  | "clothing"
  | "art"
  | "society"
  | "abstract"
  | "connectors"
  | "science"
  | "politics"
  | "psychology"
  | "synonymsAntonyms"
  | "sport"
  | "law";
export type FlashcardLevel = "A1" | "A2" | "B1" | "B2" | "C1";

export const flashcardLevels: FlashcardLevel[] = ["A1", "A2", "B1", "B2", "C1"];

export interface WordRelation {
  word: string;
  translation: string;
}

export interface Flashcard {
  id: string;
  category: FlashcardCategory;
  level: FlashcardLevel;
  emoji: string;
  russian: string;
  transcription: string;
  translationEs: string;
  exampleRu: string;
  exampleEs: string;
  synonyms?: WordRelation[];
  antonyms?: WordRelation[];
  /** Pre-generated pronunciation clip for `russian`, from the shared
   * AudioAsset cache (see prisma/generate-flashcard-audio.ts). Undefined
   * until generated — SpeakButton falls back to browser TTS. */
  audioUrl?: string | null;
  /** Pre-generated pronunciation clip for `exampleRu` (see prisma/generate-
   * flashcard-example-audio.ts). Undefined until generated. */
  exampleAudioUrl?: string | null;
}

export const flashcardCategories: FlashcardCategory[] = [
  "food",
  "shopping",
  "city",
  "work",
  "family",
  "health",
  "feelings",
  "motionVerbs",
  "greetings",
  "technology",
  "travel",
  "weather",
  "clothing",
  "art",
  "society",
  "abstract",
  "connectors",
  "science",
  "politics",
  "psychology",
  "synonymsAntonyms",
  "sport",
  "law",
];
