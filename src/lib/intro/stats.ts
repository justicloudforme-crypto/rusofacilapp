/**
 * Every quantity the introduction deck states, counted from the same
 * sources the site itself reads.
 *
 * Why this file exists. Until 05.09.2026 the deck wrote its numbers by
 * hand, and they had drifted from the product they described: the tour
 * slide said "120 lecciones" (right by luck), promised an interactive
 * dictionary for "cualquier palabra en español" (there is no such thing),
 * and the FAQ that answers "what do I get without subscribing?" listed
 * "1 lección … y los primeros crucigramas de nivel A1" for a free set that
 * is four lessons, both game types and every level but C1. A number
 * written by hand cannot go stale loudly; it goes stale silently, and the
 * page keeps saying it.
 *
 * NO `import "server-only"` HERE, deliberately. Two callers cannot resolve
 * it: `scripts/check-intro-numbers.mjs`, the guard that proves no slide
 * writes one of these numbers by hand, and the vitest suite. The database
 * half lives in ./bank.ts, which IS server-only; this module is pure and
 * takes those counts as an argument. That split is also what makes the
 * guard's positive control possible — swap the counts, and every affected
 * sentence must change.
 */
import rawLessonContent from "@/lib/lessons/content.json";
import rawExamContent from "@/lib/exams/content.json";
import rawMediaData from "@/lib/media/mediaData.json";
import { levelSlugs, lessonsPerLevel, isFreeTrialLesson } from "@/lib/courses";
import { flashcardCategories, flashcardLevels } from "@/lib/flashcards/types";
import { CYRILLIC_ALPHABET, ALPHABET_TRAPS } from "@/lib/alphabet/cyrillic-alphabet";
import { BADGE_CATALOG } from "@/lib/badges/catalog";
import { MAX_STREAK_FREEZES } from "@/lib/streak-freezes";
import { freeSequencesFor } from "@/lib/word-games/free-tier";
import { wordGameTypes } from "@/lib/word-games/types";
import { FREE_TRIAL_LIMITS } from "@/lib/free-trial-limits";

/** The counts that only the database can answer. Null as a whole when it
 * cannot be read — see ./bank.ts and {@link introStatsFrom}. */
export interface IntroBankCounts {
  /** Every FlashcardCard row, C1 included. */
  flashcards: number;
  /** Every Story row. */
  stories: number;
  /** Story rows a visitor with no subscription can open (isPremium false). */
  freeStories: number;
  /** Every Idiom row. */
  idioms: number;
  /** Every GlossaryTerm row. */
  glossaryTerms: number;
  /** WordGamePuzzle rows of type WORD_SEARCH. */
  wordSearchPuzzles: number;
  /** WordGamePuzzle rows of type CROSSWORD. */
  crosswordPuzzles: number;
}

/**
 * The free set, static half only. The two free quantities that need the
 * database — free stories and the glossary, which is free in full — are
 * read straight off {@link IntroBankCounts} by the slide that prints them,
 * deliberately: a copy of them here would be a second name for the same
 * count, and the guard could no longer tell "this number reached the text"
 * from "one of its two names did".
 */
export interface IntroFreeSet {
  /** Lessons open in full, without an account: the first of every level. */
  lessons: number;
  /** Lessons whose grammar explanation is readable without paying. */
  lessonsWithFreeGrammar: number;
  flashcards: number;
  idioms: number;
  /** Word-game puzzles openable by a signed-out visitor. */
  wordGamePuzzles: number;
  /** MediaItem rows flagged `free`. */
  media: number;
}

export interface IntroStats {
  levels: number;
  lessons: number;
  exercises: number;
  exams: number;
  alphabetLetters: number;
  /** The letters a Latin-alphabet eye misreads, in the page's own order. */
  alphabetTraps: string[];
  media: number;
  mediaSongs: number;
  mediaGrammarVideos: number;
  flashcardTopics: number;
  badges: number;
  streakFreezes: number;
  bank: IntroBankCounts | null;
  free: IntroFreeSet;
}

type MediaRow = { category?: string; free?: boolean };
const mediaRows = Object.values(rawMediaData as Record<string, MediaRow>);

/** Free-trial word-game puzzles, sifted through the rule rather than
 * multiplied out: `freeSequencesFor` applies `isFreeWordGamePuzzle` to
 * every candidate rung, so the three rungs that are free BY NAME
 * (EXTRA_FREE_WORD_GAME_RUNGS) are counted and a change to the rule
 * changes this number with them. */
function countFreeWordGamePuzzles(): number {
  let total = 0;
  for (const type of wordGameTypes) {
    for (const level of flashcardLevels) {
      total += freeSequencesFor(type, level).length;
    }
  }
  return total;
}

/** Exercises across every lesson of the shipped course, counted the way
 * the lesson page counts them — one entry of a lesson's `exercises` array
 * is one exercise. */
function countExercises(): number {
  const lessons = rawLessonContent as unknown as Record<string, { exercises?: unknown[] }>;
  return Object.values(lessons).reduce((n, lesson) => n + (lesson.exercises?.length ?? 0), 0);
}

/** Lessons open in full without an account — asked of `isFreeTrialLesson`
 * rather than assumed to be "one per level", so that if the rule ever
 * opens a second lesson this number follows it. */
function countFreeLessons(): number {
  let total = 0;
  for (const level of levelSlugs) {
    for (let n = 1; n <= lessonsPerLevel[level]; n += 1) {
      if (isFreeTrialLesson(level, String(n))) total += 1;
    }
  }
  return total;
}

const TOTAL_LESSONS = levelSlugs.reduce((n, level) => n + lessonsPerLevel[level], 0);

/** Everything answerable without a database — code, JSON and the rules
 * themselves. Available even when the bank is not. */
export const INTRO_STATIC_STATS = {
  levels: levelSlugs.length,
  lessons: TOTAL_LESSONS,
  exercises: countExercises(),
  exams: Object.keys(rawExamContent as Record<string, unknown>).length,
  alphabetLetters: CYRILLIC_ALPHABET.length,
  alphabetTraps: ALPHABET_TRAPS.map((trap) => trap.letter.split(" ")[0]),
  media: mediaRows.length,
  mediaSongs: mediaRows.filter((item) => item.category === "song").length,
  mediaGrammarVideos: mediaRows.filter((item) => item.category === "grammar").length,
  flashcardTopics: flashcardCategories.length,
  badges: BADGE_CATALOG.length,
  streakFreezes: MAX_STREAK_FREEZES,
  freeLessons: countFreeLessons(),
  freeMedia: mediaRows.filter((item) => item.free === true).length,
  freeWordGamePuzzles: countFreeWordGamePuzzles(),
} as const;

/**
 * Assembles the deck's numbers from the static half above and whatever the
 * database could answer. `bank: null` is not an error path with a fallback
 * number — it is the honest answer "we could not count", and
 * {@link buildIntroSlides} drops exactly the sentences that needed it,
 * the same choice getHomepageStats makes for the trust strip.
 */
export function introStatsFrom(bank: IntroBankCounts | null): IntroStats {
  const s = INTRO_STATIC_STATS;
  return {
    levels: s.levels,
    lessons: s.lessons,
    exercises: s.exercises,
    exams: s.exams,
    alphabetLetters: s.alphabetLetters,
    alphabetTraps: [...s.alphabetTraps],
    media: s.media,
    mediaSongs: s.mediaSongs,
    mediaGrammarVideos: s.mediaGrammarVideos,
    flashcardTopics: s.flashcardTopics,
    badges: s.badges,
    streakFreezes: s.streakFreezes,
    bank,
    free: {
      lessons: s.freeLessons,
      lessonsWithFreeGrammar: s.lessons,
      flashcards: FREE_TRIAL_LIMITS.flashcards,
      idioms: FREE_TRIAL_LIMITS.idioms,
      wordGamePuzzles: s.freeWordGamePuzzles,
      media: s.freeMedia,
    },
  };
}
