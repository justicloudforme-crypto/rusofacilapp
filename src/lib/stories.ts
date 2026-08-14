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

  return {
    valid: true,
    value: { title, author, level, text, description, translationEs, audioUrl, isPremium },
  };
}
