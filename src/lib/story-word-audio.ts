import "server-only";
import { db } from "./db";
import { pickWordClip, isHomograph } from "./story-word-pick";
import type { ReusableClipRow } from "./audio-reuse-pick";

export { isHomograph };

/**
 * URL оплаченного клипа для одного слова рассказа — то, что играет тап по
 * слову (долг 123, заход 7.166).
 *
 * До этого захода тап звучал браузерным `speechSynthesis` у ВСЕХ, включая
 * анонима на двух бесплатных рассказах, — ровно то, что владелец
 * запретил. Порядок поиска повторяет золотое правило проекта:
 *
 *  1. Собственный клип слова (`contentType='word'`) — банк, набранный
 *     этим заходом.
 *  2. Уже оплаченный клип ТОГО ЖЕ текста на другой поверхности —
 *     карточка, слово урока, термин глоссария, словарь медиа. Стоит $0 и
 *     звучит тем же `onyx`.
 *
 * Границы (правило целиком — в `story-word-pick.ts`, чтобы сторож считал
 * тем же кодом): рассказы не берутся никогда (там каст из пяти голосов),
 * омограф не отдаётся вовсе, регистр складывается, ё и е — нет.
 *
 * Отказ чтения деградирует, а не роняет страницу — тот же обмен, что в
 * `audio-reuse.ts`.
 */
export async function wordClipUrl(word: string): Promise<string | null> {
  const trimmed = word.trim();
  if (!trimmed || trimmed.length > 64) return null;
  if (isHomograph(trimmed)) return null;
  const lower = trimmed.toLowerCase();

  let rows: ReusableClipRow[] = [];
  try {
    rows = await db.audioAsset.findMany({
      where: {
        voice: "onyx",
        NOT: { contentType: "story" },
        OR: [{ text: trimmed }, { text: lower }],
      },
      select: { contentType: true, contentId: true, itemKey: true, text: true, audioUrl: true },
      orderBy: [{ contentType: "asc" }, { contentId: "asc" }, { itemKey: "asc" }],
    });
  } catch (error) {
    console.error("[story-word-audio] не прочитан AudioAsset; тап останется на запасном пути", error);
    return null;
  }
  return pickWordClip(rows, trimmed);
}
