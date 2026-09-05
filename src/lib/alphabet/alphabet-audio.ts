import "server-only";
import { db } from "../db";
import { alphabetAudioKey } from "../lessons/audioKeys";
import { CYRILLIC_ALPHABET } from "./cyrillic-alphabet";

/**
 * Звук для `/es/alfabeto-cirilico` — 66 клипов, НИ ОДНОГО нового.
 *
 * Золотое правило проекта (CLAUDE.md): синтезировать ровно один раз,
 * сохранить, переиспользовать. Здесь не синтезируется вообще ничего: все
 * 66 клипов уже оплачены и лежат в Blob как строки `AudioAsset` уроков —
 * 33 названия букв у урока a1-1 (`alphabet-0…32`) и 33 слова-примера,
 * разбросанные по 20 урокам. Страница только читает их по ключу.
 *
 * Ключ — `(contentType="lesson", contentId=<слаг урока>, itemKey)`, и это
 * важно: `contentId` урока — слаг («a1-1»), одинаковый на локальной копии
 * и на проде. У карточек на его месте cuid, а он между базами расходится
 * (правило №7 PROGRESS.md), поэтому слова-примеры выбраны так, чтобы у
 * каждого нашёлся клип ИМЕННО у урока, а не у карточки.
 *
 * Читается ОДНИМ запросом на все 20 уроков, а не по запросу на букву.
 *
 * Отказ чтения деградирует, а не роняет страницу — тот же обмен, что в
 * glossary-audio.ts: без URL `SpeakButton` уходит в браузерный синтез
 * (штатный запасной путь), а текст, транскрипции и ссылки на странице уже
 * собраны к этому моменту. Ошибка логируется: страница, которая тихо
 * перестала звучать, — это тоже отказ.
 */
export interface AlphabetAudio {
  /** itemKey клипа → URL, отдельно по каждому уроку. */
  byLesson: Map<string, Map<string, string>>;
  /**
   * Самая поздняя `updatedAt` среди ПРОЧИТАННЫХ строк — источник
   * `<lastmod>` этой страницы в карте сайта.
   *
   * Почему именно они. Испанский текст страницы лежит в коде, у него
   * источника даты нет вовсе — ровно как у четырёх гидов `/es/gramatica`,
   * которые поэтому в карте сайта молчат (PROGRESS.md 7.112, часть 2).
   * А 66 клипов — настоящие строки базы с настоящим `updatedAt`, и они —
   * единственное, что эта страница ЧИТАЕТ. Дата двигается ровно тогда,
   * когда переозвучен клип, который страница печатает.
   *
   * `undefined`, если не прочиталось ни одной строки: выдуманная дата
   * хуже молчания (sitemap-lastmod.ts).
   */
  lastModified?: Date;
}

const EMPTY: AlphabetAudio = { byLesson: new Map() };

/** Ровно те 66 троек, которые печатает страница. */
export function alphabetAudioKeys(): { lessonId: string; itemKey: string }[] {
  return [
    ...CYRILLIC_ALPHABET.map((letter) => ({
      lessonId: "a1-1",
      itemKey: alphabetAudioKey(letter.lessonAlphabetIndex),
    })),
    ...CYRILLIC_ALPHABET.map((letter) => ({ ...letter.example.audio })),
  ];
}

export async function getAlphabetAudio(): Promise<AlphabetAudio> {
  const wanted = alphabetAudioKeys();
  const lessonIds = [...new Set(wanted.map((key) => key.lessonId))];

  let rows: { contentId: string; itemKey: string; audioUrl: string; updatedAt: Date }[] = [];
  try {
    rows = await db.audioAsset.findMany({
      where: { contentType: "lesson", contentId: { in: lessonIds } },
      select: { contentId: true, itemKey: true, audioUrl: true, updatedAt: true },
    });
  } catch (error) {
    console.error("[alphabet-audio] не прочитан AudioAsset; страница отдаётся без звука", error);
    return EMPTY;
  }

  const wantedSet = new Set(wanted.map((key) => `${key.lessonId} ${key.itemKey}`));
  const byLesson = new Map<string, Map<string, string>>();
  let lastModified: Date | undefined;
  for (const row of rows) {
    if (!wantedSet.has(`${row.contentId} ${row.itemKey}`)) continue;
    if (!byLesson.has(row.contentId)) byLesson.set(row.contentId, new Map());
    byLesson.get(row.contentId)!.set(row.itemKey, row.audioUrl);
    if (!lastModified || row.updatedAt.getTime() > lastModified.getTime()) lastModified = row.updatedAt;
  }
  return { byLesson, lastModified };
}

/** URL клипа или `undefined` — второе означает «уйти в браузерный синтез». */
export function clipUrl(
  audio: AlphabetAudio,
  lessonId: string,
  itemKey: string,
): string | undefined {
  return audio.byLesson.get(lessonId)?.get(itemKey);
}
