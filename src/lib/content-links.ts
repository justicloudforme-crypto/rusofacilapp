import "server-only";
import { db } from "@/lib/db";
import { lessonSlugsFor, type LevelSlug } from "@/lib/courses";
import { normalizeLevel } from "@/lib/level";
import { type StoryTopic } from "@/lib/stories";
import type { MediaItem } from "@/lib/media/types";

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
