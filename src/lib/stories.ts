// "Cuentos / Lecturas" reading library. Levels use the full CEFR scale
// (A1-C1) since some readings target advanced students beyond the course
// track, which stops at B2.
export const storyLevels = ["A1", "A2", "B1", "B2", "C1"] as const;

export type StoryLevel = (typeof storyLevels)[number];

export function isStoryLevel(value: string): value is StoryLevel {
  return (storyLevels as readonly string[]).includes(value);
}

export interface StoryInput {
  title: string;
  author: string;
  level: StoryLevel;
  text: string;
  description: string | null;
  translationEs: string | null;
  audioUrl: string | null;
  isPremium: boolean;
  premiumOnly: boolean;
}

export type StoryValidationResult =
  | { valid: true; value: StoryInput }
  | { valid: false; error: string };

/** Splits a story's raw text into paragraphs on line breaks — each line the
 * admin enters in the textarea becomes one paragraph. Used both to render
 * the full text and to build the free "first paragraph" preview for
 * premium stories. */
export function splitStoryParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

// A slower-than-average pace on purpose — this is a learner reading a
// second language aloud/with narration, not a native speed-reader.
const READING_WORDS_PER_MINUTE = 130;

/** Estimated minutes to read a story's `text` — word count / reading
 * speed, rounded up, minimum 1. Computed once at write time (see
 * api/admin/stories/save) rather than per catalog request; see
 * Story.readingMinutes in schema.prisma for why. */
export function estimateReadingMinutes(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount === 0) return 1;
  return Math.max(1, Math.ceil(wordCount / READING_WORDS_PER_MINUTE));
}

// Splits a paragraph into sentences (kept together with their trailing
// punctuation/quotes). Shared between the reader UI (StoryText, for its
// sentence-level playback queue) and generate-story-audio.ts (which now
// synthesizes one audio clip per sentence) — both sides must agree on
// exactly the same boundaries, or a clip won't line up with the sentence
// it's supposed to narrate.
const SENTENCE_SPLIT_REGEX = /[^.!?…]+[.!?…]+[»"'\]) ]*|[^.!?…]+$/gu;

export interface StorySentence {
  text: string;
  /** Offset of this sentence's first character within its paragraph. */
  start: number;
}

export function splitSentences(paragraph: string): StorySentence[] {
  const sentences: StorySentence[] = [];
  SENTENCE_SPLIT_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_SPLIT_REGEX.exec(paragraph))) {
    if (match[0].trim().length > 0) {
      sentences.push({ text: match[0], start: match.index });
    }
  }
  return sentences.length > 0 ? sentences : [{ text: paragraph, start: 0 }];
}

/** One playable unit in a story's full (paginated-free) reading/listening
 * queue — a sentence located within a specific paragraph. */
export interface StorySegment {
  paragraphIndex: number;
  sentenceIndex: number;
  /** Offset of this sentence's first character within its paragraph. */
  start: number;
  text: string;
}

/** Flattens every paragraph's sentences into one ordered queue, indices
 * matching the {@link StoryAudioSegment} array generate-story-audio.ts
 * produces for the same paragraphs. */
export function buildStoryQueue(paragraphs: string[]): StorySegment[] {
  const queue: StorySegment[] = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    splitSentences(paragraph).forEach((sentence, sentenceIndex) => {
      queue.push({ paragraphIndex, sentenceIndex, start: sentence.start, text: sentence.text });
    });
  });
  return queue;
}

/** One pre-generated narration clip, produced by generate-story-audio.ts —
 * one per sentence, matching {@link buildStoryQueue}'s indices exactly. */
export interface StoryAudioSegment {
  paragraphIndex: number;
  sentenceIndex: number;
  url: string;
  /** Null for clips generated before this column existed and not yet
   * covered by the backfill script (see prisma/backfill-audio-durations.ts)
   * — callers building a whole-story timeline (scrubber, Media Session)
   * must treat that as "unknown," not zero. */
  durationSeconds: number | null;
}

/** A story's narration clips live in the shared `AudioAsset` table
 * (contentType "story", contentId = Story.id), keyed by
 * `itemKey = "<paragraphIndex>-<sentenceIndex>"` — see
 * src/lib/audio-assets.ts. */
export function storyAudioItemKey(paragraphIndex: number, sentenceIndex: number): string {
  return `${paragraphIndex}-${sentenceIndex}`;
}

/** Turns a story's raw `AudioAsset` rows into {@link StoryAudioSegment}s,
 * dropping any row whose itemKey doesn't parse (defensive only — every row
 * this app itself writes is well-formed). */
export function toStoryAudioSegments(
  rows: { itemKey: string; audioUrl: string; durationSeconds: number | null }[]
): StoryAudioSegment[] {
  const segments: StoryAudioSegment[] = [];
  for (const row of rows) {
    const match = /^(\d+)-(\d+)$/.exec(row.itemKey);
    if (!match) continue;
    segments.push({
      paragraphIndex: Number(match[1]),
      sentenceIndex: Number(match[2]),
      url: row.audioUrl,
      durationSeconds: row.durationSeconds,
    });
  }
  return segments;
}

/** Shared by the create/update API route so the form and the server agree
 * on what a valid story looks like. */
export function validateStoryInput(body: unknown): StoryValidationResult {
  if (typeof body !== "object" || body === null) {
    return { valid: false, error: "invalid_body" };
  }
  const v = body as Record<string, unknown>;

  const title = typeof v.title === "string" ? v.title.trim() : "";
  if (!title) return { valid: false, error: "title_required" };

  const author = typeof v.author === "string" ? v.author.trim() : "";
  if (!author) return { valid: false, error: "author_required" };

  const level = typeof v.level === "string" ? v.level : "";
  if (!isStoryLevel(level)) return { valid: false, error: "invalid_level" };

  const text = typeof v.text === "string" ? v.text.trim() : "";
  if (!text) return { valid: false, error: "text_required" };

  const descriptionRaw = typeof v.description === "string" ? v.description.trim() : "";
  const description = descriptionRaw || null;

  const translationEsRaw = typeof v.translationEs === "string" ? v.translationEs.trim() : "";
  const translationEs = translationEsRaw || null;

  const audioUrlRaw = typeof v.audioUrl === "string" ? v.audioUrl.trim() : "";
  const audioUrl = audioUrlRaw || null;

  const isPremium = Boolean(v.isPremium);
  const premiumOnly = Boolean(v.premiumOnly);

  return {
    valid: true,
    value: { title, author, level, text, description, translationEs, audioUrl, isPremium, premiumOnly },
  };
}
