import "server-only";
import { db } from "./db";
import {
  pickWordClip,
  pickStoryWordClip,
  storyWordItemKey,
  isHomograph,
  type StoryWordPlace,
} from "./story-word-pick";
import type { ReusableClipRow } from "./audio-reuse-pick";

export { isHomograph };

/**
 * URL оплаченного клипа для одного слова рассказа — то, что играет тап по
 * слову (долг 123, заход 7.166).
 *
 * До 7.166 тап звучал браузерным синтезом у ВСЕХ, включая анонима на двух
 * бесплатных рассказах, — ровно то, что владелец запретил; с 7.168 этого
 * запасного пути нет в коде вовсе, и слово без клипа просто молчит.
 * Порядок поиска повторяет золотое правило проекта:
 *
 *  1. Собственный клип слова (`contentType='word'`) — банк, набранный
 *     этим заходом.
 *  2. Уже оплаченный клип ТОГО ЖЕ текста на другой поверхности —
 *     карточка, слово урока, термин глоссария, словарь медиа. Стоит $0 и
 *     звучит тем же `onyx`.
 *
 * Границы (правило целиком — в `story-word-pick.ts`, чтобы сторож считал
 * тем же кодом): рассказы не берутся никогда (там каст из пяти голосов),
 * общего клипа омографу не отдаётся вовсе, регистр складывается, ё и е —
 * нет. Единственное, что омографу полагается, — вырезка из озвучки ЕГО
 * предложения, и она ищется по адресу места (заход 7.168): без `place`
 * ответ прежний, `null`.
 *
 * Отказ чтения деградирует, а не роняет страницу — тот же обмен, что в
 * `audio-reuse.ts`.
 */
export async function wordClipUrl(word: string, place?: StoryWordPlace): Promise<string | null> {
  const trimmed = word.trim();
  if (!trimmed || trimmed.length > 64) return null;

  // Омограф. Общего клипа у него нет и не будет — ударение зависит от
  // места, — но у САМОГО этого места может лежать вырезка из озвучки его
  // предложения (заход 7.168). Ищется она по точному адресу места, и
  // промах означает молчание, а не клип «того же слова откуда-нибудь».
  if (isHomograph(trimmed)) {
    if (!place) return null;
    try {
      const row = await db.audioAsset.findFirst({
        where: {
          contentType: "story-word",
          contentId: place.storyId,
          itemKey: storyWordItemKey(place),
          text: trimmed,
        },
        select: { contentType: true, contentId: true, itemKey: true, text: true, audioUrl: true },
      });
      return row ? pickStoryWordClip([row as ReusableClipRow], place, trimmed) : null;
    } catch (error) {
      console.error("[story-word-audio] не прочитана вырезка омографа", error);
      return null;
    }
  }
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
    console.error("[story-word-audio] не прочитан AudioAsset; клипа у слова не будет", error);
    return null;
  }
  return pickWordClip(rows, trimmed);
}
