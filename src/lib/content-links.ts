import "server-only";
import { db } from "@/lib/db";
import { lessonSlugsFor, type LevelSlug } from "@/lib/courses";
import { normalizeLevel } from "@/lib/level";
import { type StoryTopic } from "@/lib/stories";
import type { MediaItem } from "@/lib/media/types";
import { getFlashcardIndex } from "@/lib/flashcards/cache";
import {
  buildVocabularyIndex,
  detectGrammarFeatures,
  matchVocabulary,
  type VocabularyMatch,
} from "@/lib/story-insights";

/**
 * Deterministic string hash (FNV-1a-ish) used everywhere below to pick a
 * stable "random" story/media/lesson for a given lesson/story/media id —
 * same input always maps to the same output across requests and
 * rebuilds, without persisting anything or making the choice look random
 * to a reader who reloads the page.
 */
function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * The 14 (level, lesson) pairs whose title is a real-world scenario
 * ("En el restaurante", "Búsqueda de trabajo") rather than a grammar point
 * ("Caso instrumental", "Participios pasivos") — hand-picked by reading
 * all 120 lesson titles in src/dictionaries/es.json, then filtered to only
 * the (level, topic) pairs with >=3 stories in that bucket (see
 * `Story.topic` counts), so a topic-matched lesson never repeats the same
 * 1-2 stories across multiple lessons. The other 106 lessons have no
 * honest topic match — grammar curriculum and story subject matter are
 * different axes — and fall back to a level-only pick in
 * `getRelatedStoriesForLesson` below. Do not extend this list by loosening
 * the topic match without re-checking story-count supply per (level,
 * topic) first; that's exactly the mistake avoided here.
 */
const TOPIC_TAGGED_LESSONS: { level: LevelSlug; lesson: string; topic: StoryTopic }[] = [
  { level: "a1", lesson: "5", topic: "daily_life" }, // En el restaurante y en la tienda
  { level: "a1", lesson: "6", topic: "family" }, // La familia y las descripciones simples
  { level: "a1", lesson: "8", topic: "daily_life" }, // Orientarse en la ciudad
  { level: "a1", lesson: "28", topic: "daily_life" }, // Diálogo práctico: en el restaurante y en el hotel
  { level: "a1", lesson: "29", topic: "daily_life" }, // Diálogo práctico: en la calle, cómo pedir direcciones
  { level: "a2", lesson: "6", topic: "daily_life" }, // La casa, el barrio y las direcciones
  { level: "a2", lesson: "8", topic: "daily_life" }, // Salud y el cuerpo humano
  { level: "a2", lesson: "27", topic: "daily_life" }, // Salud y la visita al médico
  { level: "a2", lesson: "28", topic: "daily_life" }, // De compras: ropa y devoluciones
  { level: "b1", lesson: "4", topic: "work_study" }, // El mundo laboral y los estudios
  { level: "b1", lesson: "27", topic: "work_study" }, // Búsqueda de trabajo y la entrevista
  { level: "b1", lesson: "28", topic: "work_study" }, // Educación y carrera profesional
  { level: "b2", lesson: "7", topic: "work_study" }, // Ruso profesional y de negocios
  { level: "b2", lesson: "27", topic: "nature_travel" }, // Ecología y tecnología
];

export interface RelatedStoryRef {
  id: string;
  title: string;
  level: string;
}

export interface RelatedStoriesForLesson {
  kind: "topic" | "level";
  stories: RelatedStoryRef[];
}

/** Related stories for a lesson: a real topic match for the 14 lessons
 * above (kind "topic"), or a deterministic same-level pick for every other
 * lesson (kind "level") — the caller uses `kind` to pick the honest
 * heading ("Sigue practicando" vs "Más contenido de nivel X"), never
 * implying a thematic link that isn't there. */
export async function getRelatedStoriesForLesson(
  level: LevelSlug,
  lessonSlug: string,
): Promise<RelatedStoriesForLesson> {
  const storyLevel = level.toUpperCase();
  const topicMatch = TOPIC_TAGGED_LESSONS.find((entry) => entry.level === level && entry.lesson === lessonSlug);

  if (topicMatch) {
    const stories = await db.story.findMany({
      where: { level: storyLevel, topic: topicMatch.topic },
      orderBy: { title: "asc" },
      take: 3,
      select: { id: true, title: true, level: true },
    });
    return { kind: "topic", stories };
  }

  const candidates = await db.story.findMany({
    where: { level: storyLevel },
    orderBy: { id: "asc" },
    select: { id: true, title: true, level: true },
  });
  if (candidates.length === 0) return { kind: "level", stories: [] };

  const offset = stableHash(`${level}-${lessonSlug}`) % candidates.length;
  const picked: RelatedStoryRef[] = [];
  for (let i = 0; i < Math.min(3, candidates.length); i++) {
    picked.push(candidates[(offset + i) % candidates.length]);
  }
  return { kind: "level", stories: picked };
}

export interface RelatedLessonRef {
  kind: "topic" | "level";
  level: LevelSlug;
  lesson: string;
}

/** The reverse direction: which lesson a story links to. Returns null for
 * C1 stories — there is no C1 course, so there is honestly nothing to link
 * to (see normalizeLevel). */
export function getRelatedLessonForStory(story: { id: string; level: string; topic: string }): RelatedLessonRef | null {
  const level = normalizeLevel(story.level);
  if (!level) return null;

  const topicMatch = TOPIC_TAGGED_LESSONS.find((entry) => entry.level === level && entry.topic === story.topic);
  if (topicMatch) return { kind: "topic", level, lesson: topicMatch.lesson };

  const slugs = lessonSlugsFor(level);
  const lesson = slugs[stableHash(story.id) % slugs.length];
  return { kind: "level", level, lesson };
}

/** Parses the "a1-7" shape of MediaItem.curriculumLessonId into its parts,
 * validating both that the level has a course and that the lesson number
 * actually exists in it — curriculumLessonId is hand-typed editorial data
 * (prisma/tag data, not a DB foreign key), so a typo shouldn't produce a
 * link to a lesson that 404s. */
function parseCurriculumLessonId(value: string): { level: LevelSlug; lesson: string } | null {
  const [levelPart, lessonPart] = value.split("-");
  if (!levelPart || !lessonPart) return null;
  const level = normalizeLevel(levelPart);
  if (!level) return null;
  if (!lessonSlugsFor(level).includes(lessonPart)) return null;
  return { level, lesson: lessonPart };
}

export interface RelatedMediaForLesson {
  kind: "curriculum" | "level";
  items: MediaItem[];
}

/** Related media for a lesson: the grammar-explainer video already
 * curated for this exact lesson via `curriculumLessonId` (kind
 * "curriculum" — a real, pre-existing editorial link that was sitting
 * unused in mediaData.json before this change), or a deterministic
 * same-level pick from the rest of the catalog otherwise (kind "level"). */
export function getRelatedMediaForLesson(level: LevelSlug, lessonSlug: string, allMedia: MediaItem[]): RelatedMediaForLesson {
  const curriculumMatch = allMedia.find((item) => item.curriculumLessonId === `${level}-${lessonSlug}`);
  if (curriculumMatch) return { kind: "curriculum", items: [curriculumMatch] };

  const mediaLevel = level.toUpperCase();
  const candidates = allMedia.filter((item) => item.level === mediaLevel && item.category !== "grammar");
  if (candidates.length === 0) return { kind: "level", items: [] };

  const offset = stableHash(`${level}-${lessonSlug}-media`) % candidates.length;
  const items: MediaItem[] = [];
  for (let i = 0; i < Math.min(2, candidates.length); i++) {
    items.push(candidates[(offset + i) % candidates.length]);
  }
  return { kind: "level", items };
}

export interface RelatedLessonForMedia {
  kind: "curriculum" | "level";
  level: LevelSlug;
  lesson: string;
}

/** The reverse direction for media: a grammar video's own
 * `curriculumLessonId` if it has one (kind "curriculum"), otherwise a
 * deterministic same-level pick (kind "level"), or null if the item's
 * level has no course (C1). */
export function getRelatedLessonForMedia(item: MediaItem): RelatedLessonForMedia | null {
  if (item.curriculumLessonId) {
    const parsed = parseCurriculumLessonId(item.curriculumLessonId);
    if (parsed) return { kind: "curriculum", ...parsed };
  }

  const level = normalizeLevel(item.level);
  if (!level) return null;
  const slugs = lessonSlugsFor(level);
  const lesson = slugs[stableHash(item.id) % slugs.length];
  return { kind: "level", level, lesson };
}

/** Resolves MediaItem.relatedStories ({title, level} pairs — see
 * prisma/migrate-related-story-ids-to-titles.ts for why this isn't a raw
 * Story.id) against the current database. Matches by (title, level), same
 * safe-lookup rule as every other dev.db<->Turso story transfer in this
 * project, never by id. */
export async function getRelatedStoriesForMedia(item: MediaItem): Promise<RelatedStoryRef[]> {
  if (!item.relatedStories || item.relatedStories.length === 0) return [];
  const results = await Promise.all(
    item.relatedStories.map((ref) =>
      db.story.findFirst({ where: { title: ref.title, level: ref.level }, select: { id: true, title: true, level: true } }),
    ),
  );
  return results.filter((row): row is RelatedStoryRef => row !== null);
}

/** The reverse direction: which media items curate this story as related. */
export function getRelatedMediaForStory(story: { title: string; level: string }, allMedia: MediaItem[]): MediaItem[] {
  return allMedia.filter((item) =>
    (item.relatedStories ?? []).some((ref) => ref.title === story.title && ref.level === story.level),
  );
}

export interface RelatedGlossaryTermRef {
  slug: string;
  term: string;
}

/**
 * The glossary terms a given lesson introduces, as REAL links rendered
 * server-side — the crawlable counterpart to LessonGlossaryTerms.tsx,
 * which shows the same terms as chips that open a popover, is a client
 * component fetching `/api/glossary?lesson=...` after mount, and lives
 * inside the Vocabulary tab. None of that reaches a crawler: measured
 * across the whole sitemap on 2026-08-28, all 240 lesson pages served
 * exactly zero crawlable links to /glossary, and outside the glossary
 * section itself only 6 pages linked to it at all (the 4 game landing
 * pages via GameLandingLinks). The 182 glossary URLs were effectively an
 * island. This function exists to fix that, not to duplicate the chips'
 * interaction — the popover stays where it is for students, this is the
 * href a crawler (and a keyboard user opening a link in a new tab) can
 * actually follow.
 *
 * Matches on GlossaryTerm.relatedLessons, the same `contains "a1-1"`
 * predicate /api/glossary already uses, so the two never disagree about
 * which terms belong to a lesson.
 */
export async function getGlossaryTermsForLesson(
  level: LevelSlug,
  lessonSlug: string,
): Promise<RelatedGlossaryTermRef[]> {
  const rows = await db.glossaryTerm.findMany({
    where: { relatedLessons: { contains: `"${level}-${lessonSlug}"` } },
    orderBy: { term: "asc" },
    select: { slug: true, term: true },
  });
  return rows;
}

export interface GrammarGuideRef {
  href: string;
  title: string;
  note: string;
}

/**
 * Lessons that lean on a grammar concept the course never teaches as a
 * topic of its own, mapped to the /es/gramatica guide that does. Measured
 * across all 120 lessons: no lesson title contains "género", "plural" or
 * "verbos reflexivos" — they surface only in passing, inside lessons
 * about something else (a1-15 is about the past tense and happens to
 * need gender; a2-21 is about superlatives and happens to need it too).
 * A student who hits gender agreement in a1-15 without knowing what
 * gender is in Russian has, until now, had nowhere on the site to go.
 *
 * Spanish-only by construction: the guides are ES-only (see their own
 * page comments), so callers must not render this for the /ru locale.
 * Hand-maintained and deliberately short — a lesson gets an entry only
 * if the guide's topic is genuinely load-bearing there, not merely
 * mentioned, which is why this is a literal map and not a keyword match.
 */
const GRAMMAR_GUIDE_FOR_LESSON: Record<string, GrammarGuideRef> = {
  "a1-15": {
    href: "/es/gramatica/genero-sustantivos-ruso",
    title: "El género de los sustantivos en ruso",
    note: "El pasado ruso concuerda en género — esta guía explica cómo se reconoce el género de una palabra.",
  },
  "a1-22": {
    href: "/es/gramatica/plural-sustantivos-ruso",
    title: "El plural de los sustantivos en ruso",
    note: "Esta lección cuenta cosas, y ahí el sustantivo deja de usar el plural normal — la guía explica por qué.",
  },
  "b1-21": {
    href: "/es/gramatica/verbos-reflexivos-ruso",
    title: "Los verbos en -ся en ruso",
    note: "Los verbos en -ся forman el gerundio de otra manera — la guía explica qué son y qué significan.",
  },
  "b2-22": {
    href: "/es/gramatica/verbos-reflexivos-ruso",
    title: "Los verbos en -ся en ruso",
    note: "El pasivo con -ся es una de las cuatro funciones del postfijo — la guía repasa las cuatro.",
  },
};

/** The grammar guide a lesson should point at, if any. Returns null for
 * the /ru locale: the guides don't exist there. */
export function getGrammarGuideForLesson(
  lang: string,
  level: LevelSlug,
  lessonSlug: string,
): GrammarGuideRef | null {
  if (lang !== "es") return null;
  return GRAMMAR_GUIDE_FOR_LESSON[`${level}-${lessonSlug}`] ?? null;
}

export interface StoryGrammarRef {
  slug: string;
  /** The glossary entry's Spanish name, read from the DB so the block and
   * the linked page can never disagree about what the term is called. */
  term: string;
  /** Words from this text that show the feature. */
  examples: string[];
}

export interface ContentInsights {
  vocabulary: VocabularyMatch[];
  grammar: StoryGrammarRef[];
}

/**
 * Builds the "what's in this text" block for a story or a media item — the
 * body given to pages that were otherwise ~1000 characters of title,
 * description and a paywall card (see src/lib/story-insights.ts for the
 * measurement and the two rules this obeys).
 *
 * Takes the story's full text on purpose: a vocabulary list is only
 * useful if it covers the story, and every word it can produce is a
 * flashcard that already has its own public page. What it must never do
 * is emit a SENTENCE — that is enforced in story-insights.ts, which only
 * ever returns single words, so the paywalled text itself stays
 * truncated exactly as before (see the story page's visibleParagraphs).
 *
 * Returns empty lists rather than throwing when there's nothing to say;
 * callers render nothing in that case.
 */
export async function getContentInsights(text: string): Promise<ContentInsights> {
  if (!text.trim()) return { vocabulary: [], grammar: [] };

  const features = detectGrammarFeatures(text);
  const [cards, terms] = await Promise.all([
    getFlashcardIndex(),
    features.length > 0
      ? db.glossaryTerm.findMany({
          where: { slug: { in: features.map((f) => f.slug) } },
          select: { slug: true, term: true },
        })
      : Promise.resolve([]),
  ]);

  const termBySlug = new Map(terms.map((t) => [t.slug, t.term]));
  const grammar: StoryGrammarRef[] = [];
  for (const feature of features) {
    const term = termBySlug.get(feature.slug);
    // A feature whose glossary entry doesn't exist (or was renamed) is
    // skipped rather than rendered as a dead link.
    if (term) grammar.push({ slug: feature.slug, term, examples: feature.examples });
  }

  const vocabulary = matchVocabulary(text, buildVocabularyIndex(cards));
  return { vocabulary, grammar };
}

/**
 * The grammar-topic links for a media item. Media differs from a story in
 * one important way: the transcript is fully gated, so there is no
 * "already visible" text to quote from. Features are therefore detected
 * over the transcript but rendered WITHOUT example words — which topics a
 * song touches is metadata about it, like its level or category, while a
 * quoted line would be a piece of the paid content.
 */
export async function getMediaGrammarLinks(lines: { russian: string }[]): Promise<StoryGrammarRef[]> {
  const text = lines.map((line) => line.russian).join("\n");
  if (!text.trim()) return [];

  const features = detectGrammarFeatures(text);
  if (features.length === 0) return [];

  const terms = await db.glossaryTerm.findMany({
    where: { slug: { in: features.map((f) => f.slug) } },
    select: { slug: true, term: true },
  });
  const termBySlug = new Map(terms.map((t) => [t.slug, t.term]));

  return features
    .filter((f) => termBySlug.has(f.slug))
    .map((f) => ({ slug: f.slug, term: termBySlug.get(f.slug) as string, examples: [] }));
}
