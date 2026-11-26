import { bankKey } from "../translation-normalize";
import batch01 from "./batch-01.json";

/**
 * ПАРТИИ СВОЕГО БАНКА ПЕРЕВОДОВ, которые живут в коде, а не в базе
 * (долг 171, заход 7.312, решение владельца 15.11.2026: «пополнять свой
 * банк небольшими партиями»).
 *
 * ПОЧЕМУ ФАЙЛ, А НЕ СТРОКИ В БАЗЕ. Отдельной таблицы у банка нет: он
 * собирается из карточек, глоссария и идиом (`word-bank.ts`), и каждая
 * из этих таблиц ВИДНА ученику целиком. Строка «ему → a él» в
 * `FlashcardCard` стала бы карточкой в колоде — без клипа озвучки (а
 * «клип у всех» — правило прода), без примера и без эмодзи. Новая
 * таблица — смена схемы, на которую разрешения нет. Файл же:
 *   · проверяется в PR глазами и тестом построчно (`index.test.ts`);
 *   · откатывается одним revert, без резервной копии и скрипта отката;
 *   · отвечает БЕЗ чтения базы — и продолжает отвечать, когда база лежит;
 *   · ничего не стирает и не перезаписывает в боевых данных.
 *
 * ОТКУДА ПЕРЕВОДЫ. Только из словарей уроков (`src/lib/lessons/content.json`
 * → `vocabulary`), где та же словоформа стоит отдельной строкой; урок
 * записан у каждого слова в `from`. Тест сличает перевод с уроком знак в
 * знак — выдуманный или «поправленный» перевод роняет `npm run test`.
 *
 * ФОРМЫ СЛОВА. Банк сличает словоформу как она напечатана (правило
 * `bankKey`: регистр, ударение, невидимые знаки — и ничего больше). Каждая
 * форма — своя строка: «был», «была», «было», «были» — четыре ключа, и
 * каждый со своим переводом из урока. Морфологии здесь нет намеренно —
 * почему, сказано в `translation-normalize.ts`.
 *
 * ПОРЯДОК. Партии спрашиваются ПОСЛЕ таблиц базы: если слово позже
 * появится карточкой, ответит карточка.
 */
export interface BatchEntry {
  word: string;
  translation: string;
  from: string[];
  storyUses: number;
}

export interface Batch {
  batch: number;
  run: string;
  entries: BatchEntry[];
  rejected: { word: string; count: number; reason: string }[];
}

export const WORD_BANK_BATCHES: readonly Batch[] = [batch01 as Batch];

/** Ключ → перевод по всем партиям. Первая партия, назвавшая ключ, выигрывает. */
const BATCH_MAP: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const batch of WORD_BANK_BATCHES) {
    for (const entry of batch.entries) {
      const key = bankKey(entry.word);
      const text = entry.translation.trim();
      if (key && text && !map.has(key)) map.set(key, text);
    }
  }
  return map;
})();

/** Перевод из партий для уже нормализованного ключа; `null` — слова нет. */
export function lookupBatchKey(key: string): string | null {
  return BATCH_MAP.get(key) ?? null;
}

/** Сколько ключей отвечают партиями (для замеров и тестов). */
export function batchKeyCount(): number {
  return BATCH_MAP.size;
}
