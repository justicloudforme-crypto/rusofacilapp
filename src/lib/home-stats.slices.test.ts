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

/** Полный проход по банку, замаскированный под что угодно. */
function wholeBankReads(raw: string): string[] {
  const source = stripComments(raw);
  const bad: string[] = [];
  if (/getFlashcardIndex\s*\(/.test(source)) bad.push("зовёт getFlashcardIndex() — это весь банк карточек с озвучкой");
  if (/getStoryCatalog\s*\(/.test(source)) bad.push("зовёт getStoryCatalog() — это все рассказы с группировкой озвучки");
  // `findMany` без `take` по банку или по рассказам — тот же полный проход
  // другими словами. `flashcardCard.count()` в полосе доверия к этому
  // правилу не относится: он считает, а не читает строки.
  for (const model of ["flashcardCard", "story"]) {
    const calls = source.match(new RegExp(`db\\.${model}\\.findMany\\(\\{[\\s\\S]*?\\n {4}\\}\\)`, "g")) ?? [];
    for (const call of calls) {
      if (!/\btake:\s*\d|\btake:\s*\w+/.test(call)) bad.push(`db.${model}.findMany без take — полный проход`);
    }
  }
  return bad;
}

describe("главная спрашивает срезы, а не весь банк (долг 250, шаг 1)", () => {
  const source = readFileSync(join(SRC, HOME_STATS), "utf8");

  it("ни одного полного прохода по банку и по рассказам", () => {
    expect(wholeBankReads(source)).toEqual([]);
  });

  it("срезы действительно есть — иначе «нарушений 0» доказано пустым файлом", () => {
    const takes = source.match(/take:/g) ?? [];
    expect(takes.length, "в файле нет ни одного take — читать стало нечем").toBeGreaterThanOrEqual(3);
    expect(source, "срез не спрашивает тему").toMatch(/category: "greetings"/);
    expect(source, "срез не спрашивает уровень").toMatch(/level: "A1"/);
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
  });
});
