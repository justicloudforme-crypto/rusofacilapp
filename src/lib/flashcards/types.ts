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
  | "synonymsAntonyms";
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
];
