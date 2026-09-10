import "server-only";
import { db } from "./db";
import { pickReusableClips, type ReusableClipRow } from "./audio-reuse-pick";

/**
 * «Этот текст уже озвучен — отдай тот файл» (заход 7.163).
 *
 * Ничего не синтезирует и синтезировать не может: читает `AudioAsset` и
 * возвращает URL уже оплаченных клипов. Золотое правило проекта
 * (CLAUDE.md) — озвучить один раз, сохранить, переиспользовать; тот же
 * приём уже стоит у `/es/alfabeto-cirilico` (`alphabet-audio.ts`, 66
 * клипов, ни одного нового) и у бесплатного отрывка рассказа (7.161).
 *
 * ЗАЧЕМ. Замер 7.163: 679 кнопок «слушать» у примеров на слайдах уроков и
 * 1312 у словаря медиа-страниц не имеют СВОЕЙ строки в `AudioAsset` — их
 * никогда не озвучивал ни один генератор. Но 492 и 494 из них — это тот
 * же текст, что уже озвучен у словарного слова, грамматического примера
 * или карточки. Играл там браузерный синтез, то есть системный женский
 * голос, — ровно то, что владелец запретил.
 *
 * ГРАНИЦЫ, и они не декоративные:
 *
 *  * `contentType='story'` исключён. Рассказы озвучены КАСТОМ: 3873 клипа
 *    `onyx` и 437 другими голосами (`echo`, `ash`, `nova`, `shimmer`).
 *    Взять оттуда клип по совпадению текста значило бы уронить женский
 *    голос в урок. Весь остальной банк — 17 752 клипа — `onyx`,
 *    `gpt-4o-mini-tts`, без единого исключения (проверено запросом
 *    `GROUP BY contentType, voice, model` по боевой базе 10.09.2026).
 *  * Совпадение — ПОБУКВЕННОЕ, по колонке `AudioAsset.text`, где лежит
 *    ровно тот текст, который был синтезирован. Ничего не нормализуем:
 *    «пять» и «Пять?» — разные записи и разные клипы.
 *  * `preferContentId` даёт первенство клипу того же урока, если один и
 *    тот же текст озвучен в нескольких местах. Порядок иначе
 *    детерминирован (`contentType`, `contentId`, `itemKey`), чтобы два
 *    рендера одной страницы не выдавали разные файлы.
 *
 * Отказ чтения деградирует, а не роняет страницу — тот же обмен, что в
 * `glossary-audio.ts` и `alphabet-audio.ts`.
 */
export async function clipsByText(
  texts: readonly string[],
  preferContentId?: string,
): Promise<Record<string, string>> {
  const wanted = [...new Set(texts.filter((text) => typeof text === "string" && text.length > 0))];
  if (wanted.length === 0) return {};

  let rows: ReusableClipRow[] = [];
  try {
    rows = await db.audioAsset.findMany({
      where: { text: { in: wanted }, NOT: { contentType: "story" } },
      select: { contentType: true, contentId: true, itemKey: true, text: true, audioUrl: true },
      orderBy: [{ contentType: "asc" }, { contentId: "asc" }, { itemKey: "asc" }],
    });
  } catch (error) {
    console.error("[audio-reuse] не прочитан AudioAsset; поверхность отдаётся без переиспользованных клипов", error);
    return {};
  }

  return pickReusableClips(rows, preferContentId);
}
