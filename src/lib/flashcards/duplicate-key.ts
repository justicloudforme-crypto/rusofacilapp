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

/**
 * Узаконенные пары карточек с ОДИНАКОВЫМ написанием русского слова —
 * омонимы («карта» = tarjeta и mapa) и пары «базовое слово + его карточка
 * в блоке синонимов/антонимов». Разобраны построчно в PROGRESS.md 7.89:
 * все двадцать строк созданы одним прогоном сида 14.08.2026, ни одна не
 * является копией другой, внутри пары различается от 5 до 8 полей.
 *
 * Список — ПО ПАРЕ id, а не по слову, и это главное в нём. Строка здесь
 * означает «вот эти две конкретные записи — не дубль», а НЕ «слово „карта“
 * разрешено дублировать». Поэтому третья строка с тем же словом ломает
 * совпадение множества id и ловится воротами как настоящий дубль.
 */
export const KNOWN_HOMONYM_ID_PAIRS: { word: string; ids: string[]; why: string }[] = [
  { word: "рецепт", ids: ["food3-retsept", "health-prescription"], why: "receta de cocina (A2 food) / receta médica (B1 health)" },
  { word: "карта", ids: ["shop-card", "city-map"], why: "tarjeta (A2 shopping) / mapa (A2 city)" },
  { word: "рынок", ids: ["shop-market", "work2-market"], why: "mercado (A1 shopping) / mercado económico (B1 work)" },
  { word: "облако", ids: ["tech-cloud", "weather-cloud"], why: "la nube — almacenamiento (B2 technology) / nube (A2 weather)" },
  { word: "доказательство", ids: ["abs2-evidence", "sci-dokazatelstvo"], why: "pruebas (B2 abstract) / demostración (B2 science)" },
  { word: "высокий", ids: ["cloth-tall", "syn-vysokiy"], why: "alto de estatura (A2 clothing) / карточка блока синонимов (A2 synonymsAntonyms)" },
  { word: "красивый", ids: ["cloth-beautiful", "syn-krasivyy"], why: "bonito о вещи (A1 clothing) / карточка блока синонимов (A2 synonymsAntonyms)" },
  { word: "правда", ids: ["abs-truth", "syn-pravda"], why: "verdad (B1 abstract) / карточка блока синонимов (B1 synonymsAntonyms)" },
  { word: "счастливый", ids: ["feel-happy", "syn-schastlivyy"], why: "feliz (A1 feelings) / карточка блока синонимов (B1 synonymsAntonyms)" },
  { word: "уверенный", ids: ["feel-confident", "syn-uverennyy"], why: "seguro de sí mismo (B1 feelings) / карточка блока синонимов (B2 synonymsAntonyms)" },
];

/** Множества id узаконенных пар в стабильном порядке — для сравнения целиком. */
const KNOWN_ID_SETS = new Set(KNOWN_HOMONYM_ID_PAIRS.map((p) => [...p.ids].sort().join(" ")));

export interface ExactCollision {
  key: string;
  ids: string[];
  count: number;
}

/**
 * Записи с совпадающим (с точностью до регистра и краёв) написанием — за
 * вычетом узаконенных пар выше.
 *
 * Группа пропускается ТОЛЬКО если множество её id совпадает с узаконенным
 * ЦЕЛИКОМ. Не «содержит» и не «пересекается»: появление третьей строки с
 * тем же словом меняет множество, совпадение теряется, и группа снова
 * красная. Исключение по слову ослепило бы ворота навсегда — ровно то,
 * чего допускать нельзя.
 */
export function exactCollisions<T>(
  items: T[],
  keyFn: (item: T) => string,
  idFn: (item: T) => string,
): ExactCollision[] {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const key = keyFn(item).trim().toLowerCase();
    const list = groups.get(key) ?? [];
    list.push(idFn(item));
    groups.set(key, list);
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .filter(([, ids]) => !KNOWN_ID_SETS.has([...ids].sort().join(" ")))
    .map(([key, ids]) => ({ key, ids: [...ids].sort(), count: ids.length }));
}
