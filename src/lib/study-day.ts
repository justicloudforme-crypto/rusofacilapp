import "server-only";
import { db } from "./db";
import { DEFAULT_TIME_ZONE, dateKeyIn } from "./timezone";
import { studyDayKeyIn } from "./study-day-key";
import { invalidateActivityDateKeys } from "./activity-cache";

// Отметка дня: «этот ученик сегодня занимался».
//
// ── ПРАВИЛО ДНЯ, редакция 17.09.2026 (решение владельца, заход 7.204) ──
//
// ДЕНЬ СТАВИТ ДЕЙСТВИЕ, А НЕ ОТКРЫТИЕ СТРАНИЦЫ.
//
// Ставят день (шесть событий, и все шесть — запросы, которые продукт
// посылает сам, ради собственных дел):
//
//   ответ в карточке словаря или отметка «выучено» у идиомы
//                                   POST /api/flashcard-progress
//   сданные упражнения урока        POST /api/progress
//   сданный экзамен                 POST /api/exams/[level]/[examSlug]/attempt
//   ответ в игре (первая буква)     POST /api/word-games/check
//   рассказ, прочитанный хотя бы
//     до половины                   POST /api/reading-progress, percent >= 50
//   сданное упражнение под роликом  POST /api/study-day  (source "media")
//
// НЕ ставят день: открытие ЛЮБОЙ страницы — словаря, темы словаря,
// рассказа, песни или видеоурока, урока, экзамена, кабинета, списков,
// поиска, — а также переключатели профиля и смена языка, темы, аватара.
//
// ── ЧТО БЫЛО ДО ЭТОГО И ПОЧЕМУ ИЗМЕНИЛОСЬ ─────────────────────────────
//
// С 31.08.2026 день ставило ОТКРЫТИЕ шести поверхностей. Правило лечило
// настоящий дефект (до него открытие лекции, рассказа и карточек не
// оставляло следа вовсе), но перелечило: 17.09.2026 владелец снял на
// видео, как бесплатному аккаунту записался полный день занятий за одно
// открытие словаря — ни одной карточки при этом отвечено не было
// (строка StudyDay, источник `flashcards`, markedAt
// 2026-09-16T14:45:12.740Z, зона ученика Asia/Vladivostok). Отсюда
// нынешняя редакция: открытие — это намерение, а не занятие.
//
// УЖЕ ЗАПИСАННЫЕ ДНИ НЕ ПЕРЕСЧИТЫВАЮТСЯ И НЕ УДАЛЯЮТСЯ. Правило меняет
// только то, КАКОЕ событие ставит день впредь; серии, заморозки,
// календарь и значки читают строки ровно как читали.
//
// ── Откуда берётся граница суток ──────────────────────────────────────
//
// src/lib/timezone.ts, и больше ниоткуда. Второй реализации вопроса «какой
// сегодня день» здесь нет намеренно: две штуки — это ровно тот дефект,
// который исправлен 31.08.2026 (PROGRESS.md 7.68).

/** Доля рассказа, начиная с которой чтение считается занятием.
 *
 * «Хотя бы до половины» — формулировка владельца (17.09.2026). Порог
 * взят у единственного серверного сигнала прогресса, который у рассказа
 * есть: `percent` в StoryReadingProgress, то есть страница из общего
 * числа страниц. Тот же процент рисует полосу в списке рассказов, так
 * что второго определения «половины» на сайте не появляется. */
export const STUDY_DAY_READ_PERCENT = 50;

/** Поверхности, которые считаются занятием. Закрытое объединение —
 * чтобы добавление новой было осознанной правкой ЗДЕСЬ, а не строкой,
 * написанной на месте вызова.
 *
 * Состав не менялся 17.09.2026: изменилось не то, ЧТО считается занятием,
 * а то, КАКОЕ событие каждой поверхности ставит день (см. шапку). Колонка
 * `source` — обычная строка, поэтому состав объединения не стоит ни одной
 * миграции. */
export type StudyDaySource = "lesson" | "story" | "flashcards" | "word-game" | "exam" | "media";

/** Records that `userId` studied on the calendar day `at` falls on, as seen
 * in `timeZone`.
 *
 * Idempotent by construction, not by convention: the row is keyed on
 * (userId, dateKey) with a unique index, and a day already marked is left
 * exactly as it is. Marking the same day a second time — a re-render, a refresh, a
 * back-navigation, two tabs — writes nothing new and keeps the FIRST
 * source. Proved directly in study-day.test.ts and against a real database
 * in scripts/scenarios.
 *
 * Fail-soft on purpose. This runs inside after(), behind a page that has
 * already been sent; a database hiccup must cost the learner a day mark, at
 * worst, never the page. The same reasoning as persistFreezeState. It is
 * also what keeps the deploy safe in the window between the code going live
 * and prisma/ensure-schema-sync.ts creating the table: "no such table" is
 * caught here rather than thrown into a render.
 */
export async function markStudyDay(
  userId: string,
  timeZone: string,
  source: StudyDaySource,
  at: Date = new Date(),
): Promise<boolean> {
  const dateKey = dateKeyIn(at, timeZone);
  try {
    // Read first, and on the overwhelmingly common path (the day is already
    // marked — every page view after the first one) stop there: one indexed
    // lookup, no write at all. An upsert would issue a write on every
    // single lesson, story, card and puzzle view for nothing.
    const existing = await db.studyDay.findUnique({
      where: { userId_dateKey: { userId, dateKey } },
      select: { id: true, markedAt: true },
    });
    if (existing) {
      const belongsTo = studyDayKeyIn({ dateKey, markedAt: existing.markedAt }, timeZone);
      if (belongsTo === dateKey) return false; // the ordinary case: today is marked

      // The row sitting on today's key was written for another day: it was
      // stamped in a zone the server did not know at the time — UTC on a
      // first page load — and for an evening learner west of Greenwich that
      // is TOMORROW's key. Left alone it does two things at once: it hides
      // the day it really belongs to, and it blocks the mark for today,
      // because the unique index has no room for a second row.
      //
      // So it is moved to its own day, and today is then marked normally.
      // Nothing is invented here: the day it moves to is the one its own
      // instant names, in the zone we now know.
      const occupied = await db.studyDay.findUnique({
        where: { userId_dateKey: { userId, dateKey: belongsTo } },
        select: { id: true },
      });
      if (occupied) {
        // That day is already marked by a row of its own, so this one is a
        // duplicate of it and nothing is lost by removing it. This is the
        // only delete in the day-mark path, and it can only ever run when
        // the day it would preserve is already on the calendar.
        await db.studyDay.delete({ where: { id: existing.id } });
      } else {
        await db.studyDay.update({ where: { id: existing.id }, data: { dateKey: belongsTo } });
      }
    }

    // `markedAt` is written explicitly rather than left to the column
    // default, because it is no longer bookkeeping: the reader derives the
    // calendar day from it (src/lib/study-day-key.ts). Defaulting to now()
    // would be identical in production — `at` IS now — and wrong for every
    // caller that passes an instant, which is how the scenarios plant days.
    await db.studyDay.create({ data: { userId, dateKey, source, markedAt: at } });

    // Only ever reached when the day really was new, i.e. at most once a
    // day per learner. Without it the streak lags the learner by up to the
    // cache's 60 seconds: they open their first lesson of the day, the
    // flame does not light, and the reasonable conclusion is that opening a
    // lesson still does not count — which is the very complaint this
    // change set answers.
    await invalidateActivityDateKeys(userId, timeZone);
    // ВОЗВРАЩАЕМОЕ ЗНАЧЕНИЕ — «день ДЕЙСТВИТЕЛЬНО новый», и оно не
    // бухгалтерия: на нём висит выдача значков серии (долг 220). Правда
    // ровно здесь, потому что сюда попадают только те вызовы, которые
    // прошли мимо `return false` выше, то есть не чаще раза в сутки.
    return true;
  } catch (error) {
    // Includes the one race this design has: two requests arriving in the
    // same millisecond both find nothing and both insert. The unique index
    // rejects the loser, which is exactly the right outcome — one row for
    // the day — so it is logged and dropped, not retried.
    console.error("markStudyDay failed", error);
    return false;
  }
}

/** Every marked day of this learner, as `{ dateKey, source }`. Degrades to
 * an empty list rather than throwing (see 7.24): the streak still has its
 * five derived sources, so a missing table costs accuracy, not the profile
 * page. */
export async function getStudyDayRows(
  userId: string,
): Promise<Array<{ dateKey: string; source: string; markedAt: Date | null }>> {
  try {
    // `markedAt` comes along because the day a mark belongs to is derived
    // from the instant in the READER's zone, not read off the stored key —
    // see src/lib/study-day-key.ts for why.
    return await db.studyDay.findMany({
      where: { userId },
      select: { dateKey: true, source: true, markedAt: true },
    });
  } catch (error) {
    console.error("getStudyDayRows failed", error);
    return [];
  }
}

/** Just the keys, for callers that only need the calendar. Derived in
 * `timeZone` for the same reason streaks.ts derives them there — see
 * src/lib/study-day-key.ts. */
export async function getStudyDayKeys(
  userId: string,
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<string[]> {
  return (await getStudyDayRows(userId)).map((row) => studyDayKeyIn(row, timeZone));
}
