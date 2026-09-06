/**
 * Свёртка строки и нечёткое сравнение — единственное место, где поиск
 * решает, «похожи ли» две строки.
 *
 * Замер 05.09.2026 (PROGRESS.md 7.127, часть 2) назвал три случая, на
 * которых прежний поиск отвечал нулём, и все три — не про содержимое, а
 * про написание:
 *
 *   `Précios` → 0   диакритика (а `Precios` в списке есть)
 *   `Cuenots` → 0   перестановка двух букв
 *   `Рассказов` → 0 падежное окончание (а `Рассказ` находил)
 *
 * Здесь они закрыты тремя разными приёмами, и это важно не перепутать:
 *
 *  1. `fold` — NFD, снятие диакритики, нижний регистр. `Précios` после
 *     неё равна `precios` буква в букву, то есть это ТОЧНОЕ совпадение, а
 *     не догадка. Побочно снимаются и русские надстрочные: в NFD «ё» —
 *     это «е» + комбинирующая диереза, «й» — «и» + бревис, и оба
 *     схлопываются туда, куда и надо.
 *  2. `withinEditDistance1` — расстояние Дамерау–Левенштейна не больше
 *     единицы, с перестановкой соседних букв как одной операцией. Это
 *     `Cuenots` → `cuentos`.
 *  3. `sharesStem` — общее начало слова. Это `Рассказов` → `Рассказы`.
 *
 * Чего здесь НЕТ и не будет без отдельного решения: настоящей русской
 * морфологии. Общее начало ловит окончание, но не чередование в основе
 * (`сон` / `сна`) и не супплетивизм (`идти` / `шёл`). Сколько именно
 * случаев из замера это покрывает — сказано числом в
 * scripts/check-search-coverage.ts, а не прилагательным здесь.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;
/** Всё, что не буква и не цифра, — разделитель слов. */
const NON_WORD = /[^\p{L}\p{N}]+/gu;

/** Нижний регистр без диакритики. Единственная функция, через которую
 * проходит и запрос, и всё, по чему ищут, — иначе они сравнивались бы по
 * разным правилам. */
export function fold(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase().trim();
}

export function tokenize(folded: string): string[] {
  return folded.split(NON_WORD).filter(Boolean);
}

/** Длина общего начала двух строк. */
export function sharedPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

/**
 * Достаточно ли общего начала, чтобы счесть два слова формами одного.
 *
 * Пять знаков — нижняя граница, и она выбрана не на глаз: при четырёх
 * `casa` и `caso` становятся «одним словом», а это уже не падеж, а другое
 * слово. Второе условие (общее начало — не меньше 70% длинного слова)
 * держит пару `рассказов`/`рассказы` (7 из 9) и отсекает
 * `рассказ`/`расследование` (5 из 13).
 */
export function sharesStem(a: string, b: string): boolean {
  if (a === b) return true;
  const shared = sharedPrefixLength(a, b);
  if (shared < 5) return false;
  return shared >= 0.7 * Math.max(a.length, b.length);
}

/**
 * Расстояние Дамерау–Левенштейна не больше 1: одна вставка, одно
 * удаление, одна замена или одна перестановка соседних букв.
 *
 * Написано отдельной проверкой, а не полной матрицей расстояний, ровно
 * потому, что порог — единица: тогда достаточно одного прохода, и
 * сравнение 3277 названий с запросом не стоит ничего заметного.
 */
export function withinEditDistance1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;

  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (i === la && i === lb) return true;

  if (la === lb) {
    // замена
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    // перестановка соседних
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }

  // одна лишняя буква в более длинной строке
  const [long, short] = la > lb ? [a, b] : [b, a];
  return long.slice(i + 1) === short.slice(i);
}

/**
 * Похожи ли два ОТДЕЛЬНЫХ слова. Порог длины у расстояния не случайный:
 * на словах короче пяти букв одна правка превращает `casa` в `cosa`, а
 * `dos` в `tos` — то есть в другое слово, а не в опечатку.
 */
export function tokensAreClose(query: string, candidate: string): boolean {
  if (candidate.startsWith(query) && query.length >= 3) return true;
  if (sharesStem(query, candidate)) return true;
  if (query.length >= 5 && candidate.length >= 5) return withinEditDistance1(query, candidate);
  return false;
}
