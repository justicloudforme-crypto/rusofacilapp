import "server-only";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VideoLessonData } from "./types";

// There's no database table for video lessons yet (unlike courses/stories,
// which live in Prisma) — mirrors the existing static-JSON pattern used by
// src/lib/media/mediaData.json. Read fresh from disk on every call (rather
// than a static `import`) so writes from the admin generator are visible
// immediately without a server restart.
const LESSONS_FILE = path.join(process.cwd(), "src/lib/video-lesson/lessons.json");

async function readStore(): Promise<Record<string, VideoLessonData>> {
  try {
    const raw = await readFile(LESSONS_FILE, "utf-8");
    return JSON.parse(raw) as Record<string, VideoLessonData>;
  } catch {
    return {};
  }
}

export async function getAllSavedVideoLessons(): Promise<VideoLessonData[]> {
  return Object.values(await readStore());
}

export async function getSavedVideoLessonById(id: string): Promise<VideoLessonData | null> {
  const store = await readStore();
  return store[id] ?? null;
}

export async function saveVideoLesson(lesson: VideoLessonData): Promise<void> {
  const store = await readStore();
  store[lesson.id] = lesson;
  await writeFile(LESSONS_FILE, JSON.stringify(store, null, 2) + "\n", "utf-8");
}
