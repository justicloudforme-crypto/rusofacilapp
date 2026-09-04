/**
 * Which word-game puzzles are free, as a plain rule with no dependencies.
 *
 * Extracted from src/lib/entitlement.ts on 02.09.2026 for the same reason
 * isExamSlugFormat was extracted from the server-only exams/content.ts:
 * the rule is needed where that module cannot be imported. Three callers
 * now share it — the runtime entitlement checks (which re-export it, so
 * every existing import keeps working), src/app/robots.ts, and
 * prisma/generate-word-games.ts, an offline Node script that crashes on
 * `import "server-only"`.
 *
 * Keeping one definition matters more than the import convenience: the
 * generator's --only=free scope, the robots.txt Allow lines, and the
 * paywall redirect all have to mean the same 80 URLs. A second copy of
 * "sequence <= 10, not C1" would drift and open or hide puzzles silently.
 */
export const WORD_GAME_FREE_RUNGS_PER_LEVEL = 10;

/**
 * Рунги, бесплатные ИМЕНЕМ, а не номером.
 *
 * Правило выше — вычисляемое: «первые десять номеров любой лестницы,
 * кроме C1». Оно и есть основной признак бесплатности, и оно не
 * трогается. Но правило по номеру не умеет сказать «вот эта конкретная
 * страница тоже открыта», а такая нужда возникает: разгрузка филвордов
 * (density-rungs.ts) уносит половину слов бесплатного тематического
 * рунга на новую строку, номер которой по построению стоит в конце
 * лестницы — далеко за десяткой. Слова остаются те же, страница-источник
 * остаётся в индексе, а вторая половина её содержимого оказывается за
 * пейволлом.
 *
 * Поэтому исключение названо ПЕРЕЧИСЛЕНИЕМ координат, а не расширением
 * условия: список видно в дифе, его длину сторожит тест, и он не
 * открывает ничего, кроме того, что в нём написано. Условие вида
 * «sequence <= 10 ИЛИ это хвост» открыло бы 277 страниц разом.
 *
 * Пустой список — это НЕ мёртвый код: он держит форму, в которой
 * исключение единственно возможно. Каждый ключ обязан быть хвостом
 * манифеста разгрузки, и это сверяется в обе стороны в
 * density-rungs.test.ts.
 */
export interface WordGameRungRef {
  type: string;
  level: string;
  sequence: number;
}

export const EXTRA_FREE_WORD_GAME_RUNGS: readonly WordGameRungRef[] = [];

const EXTRA_FREE_KEYS = new Set(
  EXTRA_FREE_WORD_GAME_RUNGS.map((r) => `${r.type}/${r.level}/${r.sequence}`),
);

/**
 * Free-trial word games: the first N rungs of every (type, level) ladder
 * except C1 — 80 puzzles, 2 types x 4 levels x N.
 *
 * Checked against the puzzle itself rather than a page-level gate in every
 * route that serves puzzle data or grades an answer: a puzzleId is a plain
 * string a client could otherwise pass straight to
 * /api/word-games/check|hint|complete to solve a locked puzzle without
 * ever fetching it through the gated GET route.
 */
export function isFreeWordGamePuzzle(puzzle: { type: string; level: string; sequence: number }): boolean {
  if (puzzle.type !== "WORD_SEARCH" && puzzle.type !== "CROSSWORD") return false;
  if (EXTRA_FREE_KEYS.has(`${puzzle.type}/${puzzle.level}/${puzzle.sequence}`)) return true;
  return puzzle.level !== "C1" && puzzle.sequence <= WORD_GAME_FREE_RUNGS_PER_LEVEL;
}

/**
 * Все бесплатные номера одной лестницы (type, level), по возрастанию.
 *
 * Зачем. До 05.09.2026 правило бесплатности жило в ЧЕТЫРЁХ местах, и
 * только одно из них звало функцию выше: sitemap.ts крутил
 * `for (let sequence = 1; sequence <= LIMIT; sequence++)`, robots.ts —
 * `Array.from({ length: LIMIT })`, data.ts — `where: { sequence: { lte:
 * LIMIT } }`. Общая КОНСТАНТА у них была, общего ПРАВИЛА не было: три
 * пересказа «первые LIMIT номеров» своими словами. Пересказ переживает
 * любое изменение правила молча — ровно то, ради чего free-tier.ts и
 * выделяли из entitlement.ts.
 *
 * Здесь номера не перечисляются заново, а ПРОСЕИВАЮТСЯ через
 * `isFreeWordGamePuzzle`: если правило завтра изменится, изменится и
 * этот список, и ни одна поверхность не отстанет.
 */
export function freeSequencesFor(type: string, level: string): number[] {
  const out: number[] = [];
  for (let sequence = 1; sequence <= WORD_GAME_FREE_RUNGS_PER_LEVEL; sequence += 1) {
    if (isFreeWordGamePuzzle({ type, level, sequence })) out.push(sequence);
  }
  for (const rung of EXTRA_FREE_WORD_GAME_RUNGS) {
    if (rung.type !== type || rung.level !== level) continue;
    // Через то же правило, а не «раз в списке — значит бесплатен»:
    // список и функция обязаны согласоваться, и если они разойдутся,
    // молчать об этом здесь нельзя.
    if (isFreeWordGamePuzzle(rung) && !out.includes(rung.sequence)) out.push(rung.sequence);
  }
  return out.sort((a, b) => a - b);
}

/**
 * `where` для запросов, которые не умеют выразить `isFreeWordGamePuzzle`
 * на SQL. Заведомо НАДмножество: точный ответ всё равно даёт правило,
 * применённое к прочитанным строкам (см. getFreeSequences в data.ts).
 */
export type FreeWordGameWhereClause =
  | { level: { not: string }; sequence: { lte: number } }
  | { type: string; level: string; sequence: number };

export function freeWordGameWhere(): { OR: FreeWordGameWhereClause[] } {
  return {
    OR: [
      { level: { not: "C1" }, sequence: { lte: WORD_GAME_FREE_RUNGS_PER_LEVEL } },
      ...EXTRA_FREE_WORD_GAME_RUNGS.map((r) => ({ type: r.type, level: r.level, sequence: r.sequence })),
    ],
  };
}

/**
 * Which puzzles a signed-out visitor — and therefore a crawler — can
 * actually OPEN. Free by the rule above, and not behind the second gate.
 *
 * The two are not the same rule, and treating them as one was a real
 * defect. `isFreeWordGamePuzzle` is only the FIRST of two checks the
 * puzzle page makes: after it comes
 *
 *   if ((row.curved || row.premiumOnly) && !canAccessCurvedPuzzle(tier))
 *     redirect(`/${lang}/pricing?next=…`)
 *
 * and `canAccessCurvedPuzzle` is Premium-only (entitlement.ts). So a row
 * with `curved` or `premiumOnly` set inside rungs 1…10 passes the free
 * rule and still answers an anonymous visitor with a 307 into /pricing.
 * Every link surface built for crawlers — the free index on
 * /[lang]/word-games and on /es/juegos-para-aprender-ruso, and the
 * neighbour rungs on a puzzle page — must ask THIS question, not the one
 * above, or it publishes links that redirect.
 *
 * Found on 04.09.2026 by the e2e fixture, which holds exactly such a row
 * (WORD_SEARCH/A1/2, curved + premiumOnly) as its ★ sample. Production
 * has none today — measured 02.09.2026, `premiumOnly` inside 1…10 was 0
 * for all ten (type, level) pairs — so this was true by data, not by
 * code, and one `db:set-premium-only-word-games` run away from being
 * false. See PROGRESS.md 7.103.
 */
export function isPubliclyOpenableWordGamePuzzle(puzzle: {
  type: string;
  level: string;
  sequence: number;
  curved?: boolean | null;
  premiumOnly?: boolean | null;
}): boolean {
  return isFreeWordGamePuzzle(puzzle) && !puzzle.curved && !puzzle.premiumOnly;
}
