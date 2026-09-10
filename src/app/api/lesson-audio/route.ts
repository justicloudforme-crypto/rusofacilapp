import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isLevelSlug, isLessonSlug } from "@/lib/courses";
import { getLessonContent } from "@/lib/lessons/content";
import { clipsByText } from "@/lib/audio-reuse";
import { textAudioKey } from "@/lib/lessons/audioKeys";
import { sanitizeTextForTTS } from "@/lib/speech";
import type { LessonContent } from "@/lib/lessons/types";

// Public and unauthenticated on purpose: the mapping only exposes
// itemKey -> audioUrl for a lesson whose Russian text is already visible in
// the lesson page's own HTML once a subscriber has access, and the .mp3
// files under public/audio/lessons/ are themselves plain static assets —
// gating this endpoint wouldn't protect anything the lesson page doesn't
// already reveal. No rate limiter either: it's a cacheable read with no
// side effect, unlike the POST routes for progress/voice uploads.

/** Каждый русский текст, у которого на странице урока есть кнопка
 * «слушать». Порядок и состав повторяют то, что рисуют вкладки
 * (`SlidesTab`, `GrammarTab`, `VocabularyTab`, `AlphabetTable`,
 * `ExercisesTab`), а не то, что озвучивал генератор: примеры на слайдах
 * генератор не озвучивал НИКОГДА (заход 7.163), и именно ради них этот
 * список и собирается. */
function spokenTexts(content: LessonContent): string[] {
  const texts: string[] = [];
  for (const item of content.vocabulary ?? []) if (item?.word) texts.push(item.word);
  for (const example of content.grammar?.examples ?? []) if (example?.russian) texts.push(example.russian);
  for (const item of content.readingPractice?.items ?? []) if (item?.text) texts.push(item.text);
  for (const item of content.alphabet ?? []) if (item?.name) texts.push(item.name);
  for (const exercise of content.exercises ?? []) {
    if (exercise.type === "listening" || exercise.type === "listening-transcription") {
      if (exercise.audioText) texts.push(exercise.audioText);
    } else if (exercise.type === "reading-comprehension") {
      if (exercise.text) texts.push(exercise.text);
    }
  }
  for (const slide of content.slides ?? []) {
    for (const example of slide.audioExamples ?? []) if (example?.text) texts.push(example.text);
  }
  return texts;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level") ?? "";
  const lesson = searchParams.get("lesson") ?? "";

  if (!isLevelSlug(level) || !isLessonSlug(level, lesson)) {
    return NextResponse.json({ error: "Invalid level or lesson" }, { status: 400 });
  }

  const contentId = `${level}-${lesson}`;
  const rows = await db.audioAsset.findMany({
    where: { contentType: "lesson", contentId },
    select: { itemKey: true, text: true, audioUrl: true },
  });

  // Keyed by the item's fixed position (see src/lib/lessons/audioKeys.ts),
  // not its text — a real, confirmed incident: keying by literal text
  // meant an admin's later typo/grammar fix in the Lesson-override editor
  // silently broke the link to already-paid-for narration for 14 items
  // across the course, since the generation script only ever saw the
  // original static content.json text.
  const audio: Record<string, string> = {};
  for (const row of rows) audio[row.itemKey] = row.audioUrl;

  // ЗАПАСНОЙ ключ — по тексту, и он не отменяет предыдущий абзац: клиент
  // (`pickClip`) сначала спрашивает позицию и только при промахе — текст.
  // Нужен там, где позиционного ключа НЕ СУЩЕСТВУЕТ: 679 примеров на
  // слайдах уроков генератор не озвучивал ни разу, и до 7.163 все 679
  // кнопок уходили в браузерный синтез. Клипы того же урока попадают сюда
  // даром — строки уже прочитаны выше.
  for (const row of rows) audio[textAudioKey(row.text)] = row.audioUrl;

  const content = await getLessonContent(level, lesson);
  if (content) {
    // Спрашиваем и СЫРОЙ текст страницы, и очищенный: `AudioAsset.text`
    // хранится уже пропущенным через `sanitizeTextForTTS`, поэтому текст
    // с кавычками «» совпадёт только во второй форме (долг 125). Ключ в
    // карте кладётся в той же форме, в какой нашёлся, а третья ступень
    // `pickClip` спросит очищенный ключ после промаха по сырому.
    const unresolved = spokenTexts(content).filter(
      (text) =>
        audio[textAudioKey(text)] === undefined &&
        audio[textAudioKey(sanitizeTextForTTS(text))] === undefined,
    );
    const wanted = [...new Set(unresolved.flatMap((text) => [text, sanitizeTextForTTS(text)]))];
    const reused = await clipsByText(wanted, contentId);
    for (const [text, url] of Object.entries(reused)) audio[textAudioKey(text)] = url;
  }

  return NextResponse.json({ audio });
}
