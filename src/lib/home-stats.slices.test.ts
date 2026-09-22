import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ГЛАВНАЯ НЕ СТРОИТ ВЕСЬ БАНК РАДИ ТРИНАДЦАТИ КАРТОЧЕК — долг 250, шаг 1
 * (сайт), правка 18.09.2026.
 *
 * ЦЕНА, НАЗВАННАЯ ЧИСЛОМ (замер боевой базы 17.09.2026, только SELECT).
 * `getHomepageWordSample` и `getHomepagePreviewData` оба звали
 * `getFlashcardIndex()`, а это 5771 строка `FlashcardCard` плюс 11 542
 * строки `AudioAsset`; рядом `getStoryCatalog()` — ещё 325 строк Story и
 * группировка озвучки по всем рассказам. 17 638 просмотренных строк ради
 * 13 карточек и одного рассказа. Счётчиком самой базы (`rows_read`
 * ответов `/v2/pipeline`) — 28 046 против 1710 после правки.
 *
 * ПОЧЕМУ СТОРОЖ ПО ИСХОДНИКУ, А НЕ ПО ЗАМЕРУ. Вернуть полный банк можно
 * одной строкой — `const all = await getFlashcardIndex()`, — и замер
 * этого не заметит: страница будет выглядеть ровно так же и отвечать за
 * доли секунды на прогретом экземпляре. Дорого это ровно там, где
 * измерить нельзя с ноутбука: на холодном старте после выката, с которого
 * долг 250 и начался.
 *
 * ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ — в этом же файле: тот же предикат прикладывается
 * к подсаженному исходнику и обязан его поймать.
 */
const SRC = join(process.cwd(), "src");
const HOME_STATS = "lib/home-stats.ts";

/** Комментарии вычёркиваются: в этом файле правило объяснено словами, и
 *  слова называют обе прежние функции по имени. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

/** Аргумент вызова целиком, найденный СЧЁТОМ СКОБОК, а не регуляркой.
 *
 *  Прежняя версия искала закрывающую скобку по отступу — `\n {4}\}\)` — и
 *  это была дыра, а не мелочь: заход 7.222 добавил в этот файл выборку с
 *  другим отступом, и правило «полный проход запрещён» молча перестало её
 *  видеть, продолжая отчитываться «нарушений 0». Сторож, который не видит
 *  нарушения, хуже отсутствующего: он выдаёт отчёт.
 */
function callArgs(source: string, needle: string): string[] {
  const found: string[] = [];
  let from = 0;
  for (;;) {
    const at = source.indexOf(needle, from);
    if (at === -1) return found;
    let i = at + needle.length;
    let depth = 0;
    const start = i;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === "(" || ch === "{" || ch === "[") depth++;
      else if (ch === ")" || ch === "}" || ch === "]") {
        if (depth === 0) break;
        depth--;
      }
    }
    found.push(source.slice(start, i));
    from = i;
  }
}

/** Полный проход по банку, замаскированный под что угодно. */
function wholeBankReads(raw: string): string[] {
  const source = stripComments(raw);
  const bad: string[] = [];
  if (/getFlashcardIndex\s*\(/.test(source)) bad.push("зовёт getFlashcardIndex() — это весь банк карточек с озвучкой");
  if (/getStoryCatalog\s*\(/.test(source)) bad.push("зовёт getStoryCatalog() — это все рассказы с группировкой озвучки");

  // КАРТОЧКИ. С 21.09.2026 (7.222) правило не «есть ли `take`», а «сужена
  // ли выборка». Три прежних запроса с `take` слились в один по трём
  // темам сразу — ради одного кругового похода вместо трёх (строка долга
  // 284, N+1 на главной), — и `take` у него нет по построению: режутся
  // срезы уже в памяти. Границей стало сужение по УРОВНЮ и по ТЕМЕ:
  // именно оно держит выборку в сотне строк вместо 5771.
  for (const args of callArgs(source, "db.flashcardCard.findMany(")) {
    const narrowedByLevel = /\blevel:\s*"[A-C][12]"/.test(args);
    const narrowedByCategory = /\bcategory:\s*(?:"|\{\s*in:)/.test(args);
    const bounded = /\btake:\s*\w/.test(args);
    if (!bounded && !(narrowedByLevel && narrowedByCategory)) {
      bad.push("db.flashcardCard.findMany не сужен ни `take`, ни парой «уровень + тема» — полный проход");
    }
  }

  // РАССКАЗЫ. Здесь сужения по колонке мало: уровней всего шесть, и
  // `where: { level: "A1" }` без `take` — это всё равно сотни строк.
  for (const args of callArgs(source, "db.story.findMany(")) {
    if (!/\btake:\s*\w/.test(args)) bad.push("db.story.findMany без take — полный проход");
  }
  return bad;
}

describe("главная спрашивает срезы, а не весь банк (долг 250, шаг 1)", () => {
  const source = readFileSync(join(SRC, HOME_STATS), "utf8");

  it("ни одного полного прохода по банку и по рассказам", () => {
    expect(wholeBankReads(source)).toEqual([]);
  });

  it("срезы действительно есть — иначе «нарушений 0» доказано пустым файлом", () => {
    // Правило то же, что было, но считается по тому, чем срезы задаются
    // ТЕПЕРЬ: три темы перечислены константой, числа печатаемых карточек —
    // рядом с ней, и выборка сужена уровнем. Без этой проверки «нарушений
    // 0» доказывалось бы пустым файлом.
    expect(source, "список тем главной пропал").toMatch(/HOME_PREVIEW_CATEGORIES\s*=\s*\[[^\]]*"greetings"/);
    expect(source, "тема «еда» больше не спрашивается").toMatch(/"food"/);
    expect(source, "тема «город» больше не спрашивается").toMatch(/"city"/);
    expect(source, "срез не спрашивает уровень").toMatch(/level: "A1"/);
    const takes = source.match(/take:\s*\w/g) ?? [];
    expect(takes.length, "рассказ на главной читается без ограничения").toBeGreaterThanOrEqual(1);
    // Сколько карточек каждой темы печатается — тоже часть среза: без
    // этих чисел «сужено» означало бы только «не весь банк».
    expect(source).toMatch(/HOME_PREVIEW_TAKE\s*=\s*\{[^}]*greetings:\s*5/);
  });

  it("ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ: прежний код тем же предикатом ловится", () => {
    const before = `
      const all = await getFlashcardIndex();
      const stories = await getStoryCatalog();
    `;
    expect(wholeBankReads(before).length).toBeGreaterThan(1);
    const unbounded = `
  const rows = await db.story.findMany({
    where: { level: "A1" },
    orderBy: { createdAt: "desc" },
    });
`;
    expect(wholeBankReads(unbounded).some((p) => p.includes("без take"))).toBe(true);

    // ПОДСАДКА, КОТОРАЯ ЛОВИТ ИМЕННО ДЫРУ 7.222: тот же полный проход по
    // карточкам, записанный с ДРУГИМ отступом. Прежний предикат искал
    // закрывающую скобку по четырём пробелам и такую запись пропускал.
    const otherIndent = `
      const cards = await db.flashcardCard.findMany({
        orderBy: { createdAt: "asc" },
      });
`;
    expect(
      wholeBankReads(otherIndent).some((p) => p.includes("полный проход")),
      "полный проход по карточкам с нестандартным отступом не пойман",
    ).toBe(true);

    // И отрицательный контроль к нему: сужённая парой «уровень + тема»
    // выборка БЕЗ take нарушением быть не должна, иначе правило запретило
    // бы ровно ту правку, ради которой написано.
    const narrowed = `
      const cards = await db.flashcardCard.findMany({
        where: { level: "A1", category: { in: [...HOME_PREVIEW_CATEGORIES] } },
        orderBy: { createdAt: "asc" },
      });
`;
    expect(wholeBankReads(narrowed)).toEqual([]);
  });
});
