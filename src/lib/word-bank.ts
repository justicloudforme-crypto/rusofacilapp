import "server-only";
import { db } from "./db";
import { bankKey } from "./translation-normalize";

/**
 * СВОЙ банк переводов «русское слово → испанский» — то, что спрашивается
 * ПЕРЕД чужим сервисом (долг 169, заход 7.188).
 *
 * ПОЧЕМУ ВООБЩЕ. До 7.188 каждый тап по слову уходил в MyMemory — чужую
 * бесплатную память переводов с суточным потолком ≈916 тапов НА ВЕСЬ
 * САЙТ. При этом половина тапаемых слов у нас уже переведена РУКОЙ, и
 * переведена вернее: «большая» у нас карточкой, а MyMemory отдаёт «Most».
 * Замер 7.188 по снимку боевой базы: банк отвечает на **32,1 %** всех
 * словоупотреблений 325 рассказов, ничего не спрашивая наружу.
 *
 * ЧТО СЧИТАЕТСЯ БАНКОМ, тремя таблицами и в этом порядке:
 *
 *  1. `FlashcardCard.russian → translationEs` — 4084 однословных ключа.
 *     Первая, потому что это и есть словарь: слово и его перевод,
 *     написанные для ученика.
 *  2. `GlossaryTerm.russianEquivalent → term` — 13 ключей. Грамматическая
 *     метаречь («существительное» → `sustantivo`).
 *  3. `Idiom.phrase → spanishEquivalent` — 2 ключа. Идиом 771, но 769 из
 *     них МНОГОСЛОВНЫ, а у многословной идиомы перевода ОТДЕЛЬНОГО
 *     слова нет: отдать «сидеть» испанский эквивалент выражения
 *     целиком — соврать. Правило отсева одно на все три таблицы и живёт
 *     в `bankKey` (`translation-normalize.ts`).
 *
 * ЗАМЕЧАНИЕ К ЧИСЛУ 48,9 % ИЗ 7.187. Тот замер считал словоформы ВНУТРИ
 * многословных строк («образ мышления» — две), и потому назвал покрытие
 * 48,9 %. Реализуемо оно не полностью: перевести отдельное слово из
 * фразы нечем. Честное число — 32,1 %, и оно измерено тем же кодом
 * отбора ключей, что работает здесь.
 *
 * ЦЕНА ЧТЕНИЯ. Один запрос `IN (…)` на весь список слов, а не запрос на
 * слово: предзагрузка видимого абзаца спрашивает 40–60 слов сразу.
 * Отказ чтения базы не роняет тап — он деградирует до чужого сервиса,
 * тот же обмен, что в `story-word-audio.ts`.
 */
export interface BankHit {
  translation: string;
  source: "flashcard" | "glossary" | "idiom";
}

/** Сколько слов берётся за один заход предзагрузки. Абзац — 40–60 слов. */
export const BANK_LOOKUP_LIMIT = 120;

/**
 * Переводы из своего банка для списка слов. Ключи ответа — НОРМАЛИЗОВАННЫЕ
 * слова (`bankKey`), а не то, что прислал вызывающий: сличение с ответом
 * делается той же нормализацией с обеих сторон.
 */
export async function lookupWordBank(words: readonly string[]): Promise<Map<string, BankHit>> {
  const keys = [...new Set(words.map((word) => bankKey(word)).filter((key): key is string => key !== null))].slice(
    0,
    BANK_LOOKUP_LIMIT,
  );
  const found = new Map<string, BankHit>();
  if (keys.length === 0) return found;

  // Регистр в базе не нормализован, а SQLite `IN` регистрозависим для
  // кириллицы (его `NOCASE` знает только латиницу). Поэтому наружу
  // спрашиваются ОБЕ записи — как есть и с заглавной первой буквой, —
  // а сведение к ключу делается уже здесь, тем же `bankKey`.
  const variants = [...new Set(keys.flatMap((key) => [key, key.charAt(0).toUpperCase() + key.slice(1)]))];

  const remember = (source: string | null, translation: string | null, kind: BankHit["source"]) => {
    const key = bankKey(source);
    if (!key || !keys.includes(key) || found.has(key)) return;
    const text = translation?.trim();
    if (text) found.set(key, { translation: text, source: kind });
  };

  try {
    const cards = await db.flashcardCard.findMany({
      where: { russian: { in: variants } },
      select: { russian: true, translationEs: true },
    });
    for (const card of cards) remember(card.russian, card.translationEs, "flashcard");

    const missing = keys.filter((key) => !found.has(key));
    if (missing.length > 0) {
      const terms = await db.glossaryTerm.findMany({
        where: { russianEquivalent: { in: variants } },
        select: { russianEquivalent: true, term: true },
      });
      for (const term of terms) remember(term.russianEquivalent, term.term, "glossary");

      const idioms = await db.idiom.findMany({
        where: { phrase: { in: variants } },
        select: { phrase: true, spanishEquivalent: true },
      });
      for (const idiom of idioms) remember(idiom.phrase, idiom.spanishEquivalent, "idiom");
    }
  } catch (error) {
    // Банк — ускорение, а не единственный путь: при отказе чтения тап
    // уходит в чужой сервис, как он ходил до 7.188.
    console.error("[word-bank] чтение банка отказало, тап уйдёт наружу", error);
    return found;
  }

  return found;
}

/** Один перевод из своего банка. `null` — слова в банке нет. */
export async function lookupWordBankOne(word: string): Promise<BankHit | null> {
  const key = bankKey(word);
  if (!key) return null;
  const found = await lookupWordBank([word]);
  return found.get(key) ?? null;
}
