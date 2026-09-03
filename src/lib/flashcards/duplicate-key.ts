/**
 * Ключ, по которому две записи банка считаются ОДНИМ словом.
 *
 * Прежний аудит (prisma/vocabulary-idioms-audit.ts) сравнивал строки
 * посимвольно, только опустив регистр. «свёкровь» и «свекровь» для него
 * разные слова, «сёрфинг» и «серфинг» — тоже, и обе пары спокойно лежали
 * в живом банке, пока их не нашли глазами (PROGRESS.md 7.89).
 *
 * Правило: «ё» и «е» — одна буква для целей поиска дублей. Это НЕ значит,
 * что они одна буква в русском: «все» (todos) и «всё» (todo) — разные
 * слова, и таких пар в языке немного. Поэтому нормализация ловит всё, а
 * настоящие пары перечислены поимённо ниже — добавить пару можно только
 * сознательной правкой этого файла, а не флагом на месте.
 */

/** Регистр вниз, «ё» → «е», края обрезаны. */
export function normalizeRussianKey(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

/**
 * Настоящие пары русских слов, различающиеся ТОЛЬКО буквой «ё». Ключ — уже
 * нормализованная форма. Список закрытый и короткий намеренно: каждая
 * строка здесь — это утверждение «эти два написания означают разное», и
 * оно должно приниматься человеком.
 */
export const KNOWN_YO_PAIRS: { key: string; variants: string[]; why: string }[] = [
  { key: "все", variants: ["все", "всё"], why: "todos / todo — разные слова, обе карточки нужны" },
  { key: "небо", variants: ["небо", "нёбо"], why: "cielo / paladar" },
];

const KNOWN_KEYS = new Set(KNOWN_YO_PAIRS.map((p) => p.key));

export interface YoCollision {
  key: string;
  variants: string[];
}

/**
 * Записи, схлопывающиеся в один ключ после нормализации «ё» и регистра —
 * за вычетом известных настоящих пар и за вычетом тех, что совпадают уже
 * буква в букву (их ловит прежнее правило, и дублировать его вывод
 * незачем: одна находка не должна печататься дважды).
 */
export function yoCollisions<T>(items: T[], keyFn: (item: T) => string): YoCollision[] {
  const groups = new Map<string, Set<string>>();
  for (const item of items) {
    const raw = keyFn(item).trim().toLowerCase();
    const key = normalizeRussianKey(raw);
    const set = groups.get(key) ?? new Set<string>();
    set.add(raw);
    groups.set(key, set);
  }
  return [...groups.entries()]
    .filter(([key, variants]) => variants.size > 1 && !KNOWN_KEYS.has(key))
    .map(([key, variants]) => ({ key, variants: [...variants].sort() }));
}
