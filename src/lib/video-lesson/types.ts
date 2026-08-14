export const partOfSpeechValues = [
  "sustantivo",
  "verbo",
  "adjetivo",
  "adverbio",
  "preposición",
  "conjunción",
  "pronombre",
  "interjección",
  "numeral",
  "partícula",
] as const;
export type PartOfSpeech = (typeof partOfSpeechValues)[number];

export function isPartOfSpeech(value: string): value is PartOfSpeech {
  return (partOfSpeechValues as readonly string[]).includes(value);
}

/** Grammar gloss for a single Russian word, looked up by its normalized surface form. */
export interface WordGloss {
  /** Dictionary (lemma) form, shown in the tooltip header even if the subtitle shows an inflected form. */
  lemma: string;
  translation: string;
  partOfSpeech: PartOfSpeech;
  /** Short grammar note in Spanish, e.g. "caso genitivo, plural" or "aspecto perfectivo". */
  grammarNote?: string;
}

export interface SubtitleLine {
  id: string;
  /** Seconds from the start of the video. */
  start: number;
  end: number;
  ru: string;
  es: string;
}

export interface HistoricalSection {
  id: string;
  title: string;
  /** Paragraphs in Spanish, split on "\n\n". */
  bodyEs: string;
}

export interface VocabularyCard {
  id: string;
  word: string;
  translation: string;
  partOfSpeech: PartOfSpeech;
  exampleRu: string;
  exampleEs: string;
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  section: "contexto" | "vocabulario";
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
  explanationEs?: string;
}

export interface VideoLessonData {
  id: string;
  title: string;
  youtubeVideoId: string;
  level: "A1" | "A2" | "B1" | "B2";
  subtitles: SubtitleLine[];
  /** Keyed by normalized token (lowercased, punctuation stripped) — see normalizeToken(). */
  glossary: Record<string, WordGloss>;
  historicalContext: HistoricalSection[];
  /** 8–12 cards. */
  vocabulary: VocabularyCard[];
  quiz: QuizQuestion[];
}
