import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * One database read must not be able to take down a whole page.
 *
 * The 29.08.2026 outage in one sentence: sitemap.ts selected a column that
 * did not exist in production, the query threw, and /sitemap.xml returned
 * HTTP 500 — so a sitemap that had nothing to do with that column became
 * invisible to every crawler. The column was the trigger; the design
 * defect was that a single read could fail the entire response.
 *
 * sitemap.ts was fixed and pinned (crawlable-surface.test.ts). This file
 * extends the same rule to the pages with the SAME shape — a crawler-facing
 * page whose content is already in hand, ruined by a secondary read that
 * only decorates it — and, just as importantly, pins the reads that must
 * KEEP failing loudly, so a later pass does not "helpfully" wrap them.
 *
 * Granularity is one function, not one file, because the same file mixes
 * both kinds: word-games/data.ts serves a puzzle's own grid (content, must
 * throw), a ★ badge (decoration, must degrade) and the paywall's rung list
 * (must fail closed) from three adjacent queries.
 */

const SRC = join(process.cwd(), "src");

/** Byte ranges covered by a `try { … }` block, found by counting braces
 * rather than by regex: a `}` inside a string or a comment ends a naive
 * `[^}]*` match early, which is the exact mistake that made
 * ensure-schema-sync.ts blind to 25 production columns. */
function tryRanges(rawSource: string): Array<[number, number]> {
  const source = withoutComments(rawSource);
  const ranges: Array<[number, number]> = [];
  const header = /\btry\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = header.exec(source))) {
    let depth = 1;
    let i = header.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") depth--;
      i++;
    }
    ranges.push([match.index, i]);
  }
  return ranges;
}

/**
 * The source of one top-level declaration: from its `export function` /
 * `export const` / `function` line up to the start of the next top-level
 * declaration (or end of file).
 *
 * Deliberately NOT "find the first `{` and count braces". A signature can
 * open a brace before the body does — `Promise<Map<string, Array<{ type:
 * WordGameType … }>>>` is a real return type in word-games/data.ts — and a
 * body brace can sit inside a call, as in `export const f = cache(async ()
 * => {`. Both break brace counting from the first `{`; column-0 boundaries
 * do not care about either.
 */
function symbolBody(source: string, symbol: string): string {
  // `default` допущено 20.09.2026 (7.220): компонент страницы в Next.js
  // объявляется ровно как `export default async function Page…`, и без
  // этого слова сканер не находил НИ ОДНОГО из них — то есть три новые
  // границы этого захода он бы просто не увидел.
  const decl = new RegExp(
    `^(export\\s+)?(default\\s+)?(async\\s+)?(function|const)\\s+${symbol}\\b`,
    "m",
  );
  const start = source.search(decl);
  if (start === -1) throw new Error(`symbol not found: ${symbol}`);
  const rest = source.slice(start + 1);
  const next = rest.search(/^(export |function |const |async function |\/\*\*)/m);
  return next === -1 ? source.slice(start) : source.slice(start, start + 1 + next);
}

/**
 * Helpers that reach the database without the caller ever naming `db`.
 * A scanner that only knows `db.` calls reports "no reads here" for a
 * function whose every read is indirect, and the assertion then passes for
 * the wrong reason — which is what happened to getHomepageWordSample and
 * getHomepagePreviewData on the first run of this file.
 *
 * Each entry is checked below to be a real exported symbol, so a rename
 * cannot quietly empty this list.
 */
const DB_BACKED_HELPERS: Array<{ name: string; definedIn: string }> = [
  { name: "getFlashcardIndex", definedIn: "lib/flashcards/cache.ts" },
  { name: "getStoryCatalog", definedIn: "lib/stories-catalog.ts" },
  { name: "attachGlossaryAudio", definedIn: "lib/glossary-audio.ts" },
  // 20.09.2026 (7.220), семейство `BLOCKED`. Четыре помощника, чьи
  // чтения решили судьбу шести маршрутов из восьми записей Sentry.
  // `getTermBySlug` — единственный в списке НЕ экспортируемый: он
  // локальная функция страницы термина, и экспортировать её наружу
  // только ради сканера нельзя — Next.js разрешает у модуля страницы
  // закрытый набор экспортов.
  { name: "getCurrentUser", definedIn: "lib/auth.ts" },
  { name: "getSubscriptionsForUser", definedIn: "lib/subscription.ts" },
  { name: "getUserStreakStats", definedIn: "lib/streaks.ts" },
  { name: "getTermBySlug", definedIn: "app/[lang]/glossary/[slug]/page.tsx" },
  // 21.09.2026 (7.222), дедупликация чтений в пределах запроса. Три
  // чтения переехали за памятку `cache` из React, и без этих трёх строк
  // сканер перестал бы видеть их вовсе: `StoryReaderPage` и
  // `generateMetadata` страницы рассказа больше не пишут `db.story.` у
  // себя, а оба среза главной — `db.flashcardCard.`. Молчаливо пустой
  // сканер здесь опаснее отсутствия правила: он ОТЧИТЫВАЕТСЯ об успехе.
  { name: "getStoryById", definedIn: "app/[lang]/stories/[id]/page.tsx" },
  { name: "homePreviewPool", definedIn: "lib/home-stats.ts" },
];

/**
 * Blanks out comments, preserving every byte position so offsets still
 * line up with the original text.
 *
 * Needed because these files explain themselves at length and the prose
 * quotes the code: sitemap.ts's header says "so db.story.findMany() below
 * hit a real prod deploy failure", and a scanner that reads comments
 * reported that sentence as an unguarded read.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

/** Every query, with or without a directly attached `await`.
 *
 * Matching `await db.` alone was not enough and the omission was live:
 * getThemedPuzzlesByTopic passes its query as a callback to `cached(...)`,
 * so the `await` sits on the cache wrapper and the read itself reads
 * `db.wordGamePuzzle.findMany({`. A scanner that misses that shape reports
 * "no reads here" and the assertion passes for the wrong reason — which is
 * exactly what it did on the first run of this file. */
function readOffsets(rawSource: string): Array<{ offset: number; model: string }> {
  const source = withoutComments(rawSource);
  const direct = [
    ...source.matchAll(/\bdb\.(\w+)\.(findMany|findUnique|findFirst|count|aggregate|groupBy)\(/g),
  ].map((m) => ({ offset: m.index!, model: m[1] }));
  const indirect = DB_BACKED_HELPERS.flatMap(({ name }) =>
    [...source.matchAll(new RegExp(`\\b${name}\\(`, "g"))].map((m) => ({ offset: m.index!, model: name })),
  );
  return [...direct, ...indirect].sort((a, b) => a.offset - b.offset);
}

function unguardedReads(source: string): string[] {
  const ranges = tryRanges(source);
  return readOffsets(source)
    .filter(({ offset }) => !ranges.some(([start, end]) => offset > start && offset < end))
    .map(({ model }) => model);
}

/**
 * Reads that must degrade, and what each failure is allowed to cost. The
 * cost is written down because "wrap it" without "and then what does the
 * visitor see" is how a page ends up serving a confident `0 palabras`.
 */
/** `model` narrows the rule to one query inside the symbol. Some functions
 * legitimately mix both kinds: fetchFlashcardIndex reads the card bank
 * (content — must throw) and joins narration URLs (decoration — must
 * degrade) two lines apart. */
const MUST_DEGRADE: Array<{ where: string; file: string; symbol: string | null; model?: string; cost: string }> = [
  {
    where: "sitemap.ts (all three reads)",
    file: "app/sitemap.ts",
    symbol: null,
    cost: "that family's URLs are missing; the other ~1250 still ship",
  },
  {
    where: "attachGlossaryAudio",
    file: "lib/glossary-audio.ts",
    symbol: "attachGlossaryAudio",
    cost: "236 glossary URLs render without the play button, definitions intact",
  },
  {
    where: "getHomepageStats",
    file: "lib/home-stats.ts",
    symbol: "getHomepageStats",
    cost: "/es and /ru drop two trust-strip numbers, keeping copy, links and JSON-LD",
  },
  {
    where: "getHomepageWordSample",
    file: "lib/home-stats.ts",
    symbol: "getHomepageWordSample",
    cost: "the hero deck disappears; the page already guards on words.length",
  },
  {
    where: "getHomepagePreviewData",
    file: "lib/home-stats.ts",
    symbol: "getHomepagePreviewData",
    cost: "the three preview cards disappear; each is already null-guarded",
  },
  {
    where: "fetchFlashcardIndex (the narration join only)",
    file: "lib/flashcards/cache.ts",
    symbol: "fetchFlashcardIndex",
    model: "audioAsset",
    cost: "the whole card bank keeps working with audioUrl null; SpeakButton stays visible but silent",
  },
  {
    where: "getThemedPuzzlesByTopic",
    file: "lib/word-games/data.ts",
    symbol: "getThemedPuzzlesByTopic",
    cost: "23 vocabulary pages and 6 landings drop the puzzle link block",
  },
  {
    where: "getAllCurvedSequences",
    file: "lib/word-games/data.ts",
    symbol: "getAllCurvedSequences",
    cost: "/es|ru/word-games loses ★ badges but keeps all 196 puzzle links",
  },
  {
    // ДОЛГ 279, 20.09.2026 (7.219). Sentry JAVASCRIPT-NEXTJS-10: 300
    // событий `BLOCKED: Operation was blocked` на
    // `Page.generateMetadata (/[lang]/media/[id])`, unhandled. Накладка —
    // субтитры и признак встройки; содержимое медиа лежит в
    // mediaData.json рядом с кодом и от базы не зависит вовсе.
    where: "getMediaById (the MediaOverride read)",
    file: "lib/media/data.ts",
    symbol: "getMediaById",
    model: "mediaOverride",
    cost: "550 media URLs keep title, description, vocabulary and exercises; they lose subtitles",
  },
  {
    where: "getAllMedia (the MediaOverride read)",
    file: "lib/media/data.ts",
    symbol: "getAllMedia",
    model: "mediaOverride",
    cost: "the catalog, 650 story pages, 240 lesson pages and the sitemap keep their media blocks; a broken embed stops being hidden",
  },
  // ============================================================
  // СЕМЕЙСТВО `BLOCKED` — 20.09.2026, заход 7.220. Восемь записей
  // Sentry, 223 события, одна причина: Turso отказывает в чтении при
  // исчерпанной квоте. Шесть записей — шесть мест ниже; седьмая
  // (`mediaOverride` на странице рассказа) закрыта заходом 7.219
  // двумя строками выше; восьмая (`wordGamePuzzle` на /sitemap.xml)
  // уже стоит в try с 29.08.2026 — см. первую строку этого списка.
  // ============================================================
  {
    // JAVASCRIPT-NEXTJS-12, 126 событий — самая частая запись семейства.
    where: "stories/[id] generateMetadata",
    file: "app/[lang]/stories/[id]/page.tsx",
    symbol: "generateMetadata",
    cost: "650 story URLs keep their text, audio and paywall; the tab title falls back to the section's generic one",
  },
  {
    // JAVASCRIPT-NEXTJS-Z, 21 событие. Пришло с ТЕЛА страницы, а не
    // отсюда — но чтение то же самое и за одно открытие выполняется
    // дважды (замер 20.09.2026: GlossaryTerm.findUnique × 2 из пяти
    // запросов страницы). Деградирует половина, которая про заголовок.
    where: "glossary/[slug] generateMetadata",
    file: "app/[lang]/glossary/[slug]/page.tsx",
    symbol: "generateMetadata",
    cost: "236 glossary URLs keep their definition; the tab title falls back to the section's generic one",
  },
  {
    // JAVASCRIPT-NEXTJS-Y, 3 события.
    where: "StoriesPage (the catalog read only)",
    file: "app/[lang]/stories/page.tsx",
    symbol: "StoriesPage",
    model: "getStoryCatalog",
    cost: "the catalog page keeps its heading, breadcrumbs and layout, and says plainly that the list could not be loaded",
  },
  {
    // JAVASCRIPT-NEXTJS-X, 2 события.
    where: "GlossaryPage (the index read)",
    file: "app/[lang]/glossary/page.tsx",
    symbol: "GlossaryPage",
    cost: "the glossary index keeps its heading and layout and says plainly that the list could not be loaded",
  },
  {
    // JAVASCRIPT-NEXTJS-13, 1 событие.
    where: "VocabularyCategoryPage (the card bank read only)",
    file: "app/[lang]/vocabulary/[categoria]/page.tsx",
    symbol: "VocabularyCategoryPage",
    model: "getFlashcardIndex",
    cost: "23 vocabulary landings keep their prose, schema.org markup and game links; the word list is empty and says so",
  },
  {
    // Вторая половина той же записи: значок серии дней в шапке. Украшение,
    // и отказ обязан стоить значка. Своё try/catch, а не общее с чтением
    // человека выше, — иначе одно из двух молчало бы о своём отказе.
    where: "LangLayout (the streak badge read only)",
    file: "app/[lang]/layout.tsx",
    symbol: "LangLayout",
    model: "getUserStreakStats",
    cost: "the header loses the streak badge and keeps the avatar, the navigation and the page under it",
  },
  {
    // JAVASCRIPT-NEXTJS-14, 6 событий — и самая дорогая запись семейства
    // не числом, а ценой: раскладка рисует шапку, шапка стоит на каждой
    // странице, поэтому отказ стоил САЙТА для вошедшего человека.
    where: "getCurrentUserForChrome",
    file: "lib/auth.ts",
    symbol: "getCurrentUserForChrome",
    cost: "every page under a signed-in visitor renders with the guest header instead of returning 500",
  },
];

/**
 * Reads that must KEEP throwing, and why. Asserted, not just documented —
 * wrapping any of these would be a regression with no visible symptom.
 */
const MUST_FAIL_LOUDLY: Array<{ where: string; file: string; symbol: string; why: string }> = [
  {
    where: "getAllPremiumOnlySequences",
    file: "lib/word-games/data.ts",
    symbol: "getAllPremiumOnlySequences",
    why: "an empty map would present every paid rung as free — a read that decides what is behind the paywall fails closed",
  },
  {
    where: "getPuzzle",
    file: "lib/word-games/data.ts",
    symbol: "getPuzzle",
    why: "the grid IS the puzzle page — there is nothing left to render once the row cannot be read, so 500 is the honest answer",
  },
  {
    where: "getLandingPuzzleForTopic",
    file: "lib/word-games/data.ts",
    symbol: "getLandingPuzzleForTopic",
    why: "the themed landing's whole premise is its puzzle — it already 404s when the theme has none rather than embed an unrelated grid",
  },
  {
    where: "countAllSequences",
    file: "lib/word-games/data.ts",
    symbol: "countAllSequences",
    why: "this is the picker's content, not its decoration — degrading it would serve a hub with no puzzles on it",
  },
  {
    // ДОЛГ 227, 19.09.2026: чтение уехало из `protectAdminRoute` в общую
    // `liveSessionUser` — одну на оба гейта, админку и кабинет. Правило
    // не изменилось ни на знак, изменилось его МЕСТО: проглотить отказ
    // базы здесь значит пустить на /admin и в кабинет того, чью сессию
    // только что отозвали.
    where: "liveSessionUser",
    file: "proxy.ts",
    symbol: "liveSessionUser",
    why: "the read IS the authorisation check — swallowing its error and continuing would admit an unauthenticated request to /admin",
  },
  {
    // 20.09.2026 (7.219), вторая половина той же правки: публичные чтения
    // накладки медиа теперь деградируют, а это — НЕТ, и разница
    // содержательная, а не стилистическая.
    where: "getManualOverrideIds",
    file: "lib/media/data.ts",
    symbol: "getManualOverrideIds",
    why: "an empty set reads as \"nobody set a manual flag\", and the very next automated embed check would overwrite a human judgment call it exists to protect",
  },
  // ============================================================
  // ГРАНИЦЫ, ДОПИСАННЫЕ 20.09.2026 (7.220) ВМЕСТЕ С ДЕГРАДАЦИЕЙ ВЫШЕ.
  // Их три, и все три отвечают на один вопрос: почему ЭТО чтение не
  // деградирует, когда соседнее в том же файле — деградирует.
  // ============================================================
  {
    where: "StoryReaderPage",
    file: "app/[lang]/stories/[id]/page.tsx",
    symbol: "StoryReaderPage",
    why: "the story text IS the page — its own generateMetadata degrades because a tab title is decoration, but a reader page with no story on it would be a blank page pretending to be a story",
  },
  {
    where: "GlossaryTermPage",
    file: "app/[lang]/glossary/[slug]/page.tsx",
    symbol: "GlossaryTermPage",
    why: "the term IS the page, exactly as with the story reader — the index at /glossary degrades to an empty list because a list of links is not its own content, and one term page has nothing equivalent to fall back to",
  },
  {
    where: "getEntitlementTierFor",
    file: "lib/entitlement.ts",
    symbol: "getEntitlementTierFor",
    why: "a swallowed failure here answers \"free\" for somebody who has paid, so the paywall appears in front of material they already own — and the next thing that person does is pay for it again; a 500 costs one page view, a duplicate charge costs trust and money",
  },
];

/**
 * Not asserted, because the reason is the artefact and a mechanical check
 * would fight anyone who later finds a better answer.
 */
const LEFT_ALONE_ON_PURPOSE = {
  "glossary/[slug] getTermBySlug, stories/[id]":
    "the read is the page's content. A page that cannot load what it exists " +
    "to show has nothing to degrade to; 500 is the honest answer.",
  "api/* route handlers":
    "each response is already its own unit of failure and its caller can " +
    "retry. A 500 there costs one endpoint, not a page of content.",
  "lib/content-links.ts (story insights)":
    "that block is the measured variable of the live experiment on 165 frozen " +
    "pages until 25.09.2026. Touching when it renders — even only on the " +
    "failure path — touches the measurement. Revisit after the freeze.",
} as const;

describe("a single database read cannot take down a page", () => {
  it.each(MUST_DEGRADE)("$where degrades instead of throwing", ({ file, symbol, model }) => {
    const whole = readFileSync(join(SRC, file), "utf8");
    const source = symbol ? symbolBody(whole, symbol) : whole;
    const relevant = (models: string[]) => (model ? models.filter((m) => m === model) : models);
    expect(
      relevant(readOffsets(source).map((r) => r.model)).length,
      `${file}: no ${model ?? "db"} read found — has it moved or been renamed?`,
    ).toBeGreaterThan(0);
    expect(relevant(unguardedReads(source)), `${file}: read outside any try block`).toEqual([]);
    expect(source, `${file}: catches but does not log`).toMatch(/catch\s*\([^)]*\)\s*\{[\s\S]*?console\.error\(/);
  });

  it.each(MUST_FAIL_LOUDLY)("$where still fails loudly, on purpose", ({ file, symbol }) => {
    const source = symbolBody(readFileSync(join(SRC, file), "utf8"), symbol);
    expect(readOffsets(source).length, `${symbol}: no db read found`).toBeGreaterThan(0);
    expect(
      unguardedReads(source).length,
      `${symbol} was wrapped in try/catch — read MUST_FAIL_LOUDLY in this file before changing that`,
    ).toBeGreaterThan(0);
  });

  it("positive control: narrowing to a model cannot pass by matching nothing", () => {
    // `model` exists so one query inside a function can be required to
    // degrade while its neighbour stays bare. That would be a loophole if a
    // typo in the model name silently selected zero reads — so the
    // assertion above counts the narrowed set and fails at zero. Shown here
    // on a name that really is absent.
    const src = readFileSync(join(SRC, "lib/flashcards/cache.ts"), "utf8");
    const body = symbolBody(src, "fetchFlashcardIndex");
    const models = readOffsets(body).map((r) => r.model);
    expect(models).toContain("audioAsset");
    expect(models).toContain("flashcardCard");
    expect(models.filter((m) => m === "typoAsset")).toEqual([]);
    // the content read really is still bare, which is the point
    expect(unguardedReads(body)).toEqual(["flashcardCard"]);
  });

  it("positive control: an unwrapped read is reported", () => {
    // Without this, every assertion above could be passing because the
    // scanner finds nothing rather than because every read is wrapped.
    const clean = symbolBody(readFileSync(join(SRC, "lib/glossary-audio.ts"), "utf8"), "attachGlossaryAudio");
    expect(unguardedReads(clean)).toEqual([]);

    const planted = clean + "\nasync function later() { const x = await db.story.findMany(); return x; }\n";
    expect(unguardedReads(planted)).toEqual(["story"]);
  });

  it("positive control: the scanner is not fooled by a brace inside a comment", () => {
    // A naive /try\s*\{[^}]*\}/ ends the block at the first "}" in a doc
    // comment and would call a genuinely wrapped read unguarded — the same
    // failure that hid 25 columns from ensure-schema-sync.ts.
    const tricky = `
      try {
        // shape: { id: string, rows: number[] }
        const rows = await db.glossaryTerm.findMany();
        return rows;
      } catch (error) {
        console.error("x", error);
      }
    `;
    expect(unguardedReads(tricky)).toEqual([]);
    // and the naive version really does disagree, so the control is not vacuous
    expect(/try\s*\{[^}]*await db\./.test(tricky)).toBe(false);
  });

  it("positive control: symbolBody reads the whole function, braces and all", () => {
    // If it stopped early, MUST_FAIL_LOUDLY would pass by seeing nothing.
    const body = symbolBody(readFileSync(join(SRC, "lib/word-games/data.ts"), "utf8"), "getAllPremiumOnlySequences");
    expect(body).toContain("premiumOnly: true");
    expect(body).toContain("return byPair;");
    expect(() => symbolBody("const x = 1;", "nope")).toThrow(/symbol not found/);
  });

  it("positive control: a read quoted in a comment is not counted", () => {
    // sitemap.ts's own header sentence contains "db.story.findMany()".
    // Before the comment stripper this file reported it as an unguarded
    // read, so the check was wrong in the direction that creates work.
    const quoted = `// so db.story.findMany() below hit a real prod deploy failure\nconst x = 1;`;
    expect(readOffsets(quoted)).toEqual([]);
    // and the same text OUTSIDE a comment is still found, so the stripper
    // has not simply blinded the scanner
    expect(readOffsets(`const x = db.story.findMany();`).map((r) => r.model)).toEqual(["story"]);
  });

  it("the indirect-read list still names real declarations", () => {
    // A rename would otherwise empty this list silently and every
    // indirect read would go back to being invisible.
    //
    // `export` is optional since 20.09.2026 (7.220): getTermBySlug is a
    // module-local function of the glossary term page, and a page module
    // in Next.js may not carry an arbitrary extra export — so requiring
    // one here would mean changing the app to please the scanner.
    for (const { name, definedIn } of DB_BACKED_HELPERS) {
      const src = readFileSync(join(SRC, definedIn), "utf8");
      expect(src, `${definedIn} no longer declares ${name}`).toMatch(
        new RegExp(`(export\\s+)?(async\\s+)?(function|const)\\s+${name}\\b`),
      );
      expect(readOffsets(src).length, `${definedIn}: ${name} no longer touches the database`).toBeGreaterThan(0);
    }
  });

  /**
   * ШАПКА ЧИТАЕТ ЧЕЛОВЕКА ЧЕРЕЗ ДЕГРАДИРУЮЩУЮ ДВЕРЬ — 20.09.2026 (7.220).
   *
   * Отдельным правилом, а не строкой в MUST_DEGRADE, по устройству:
   * `getCurrentUserForChrome` сама по себе базу не трогает (она зовёт
   * `getCurrentUser`), поэтому сканер чтений в раскладке и в шапке видит
   * НОЛЬ обращений и сказать о них ничего не может. Проверено прямой
   * подсадкой при написании: возврат этих двух файлов к прежнему коду
   * (`getCurrentUser()` напрямую) не ловился ни одним из правил выше.
   *
   * Цена ошибки здесь — весь сайт для вошедшего человека, потому что
   * шапка стоит на каждой странице.
   */
  const CHROME_FILES = ["app/[lang]/layout.tsx", "components/Navbar.tsx"] as const;

  it.each(CHROME_FILES)("%s reads the visitor through getCurrentUserForChrome", (file) => {
    const source = withoutComments(readFileSync(join(SRC, file), "utf8"));
    expect(source, `${file}: header no longer uses the degrading door`).toContain(
      "getCurrentUserForChrome(",
    );
    // И вторая половина: прежняя, громкая дверь здесь не вызывается.
    // `\b(?<!ForChrome)` тут не годится — просмотр назад запрещён правилом
    // проекта (7.210), — поэтому вызовы считаются вычитанием.
    const all = (source.match(/\bgetCurrentUser\w*\(/g) ?? []).filter((m) => m !== "getCurrentUser(");
    const loud = (source.match(/\bgetCurrentUser\(/g) ?? []).length;
    expect(loud, `${file}: calls getCurrentUser() directly — that is the 500 this pass removed`).toBe(0);
    expect(all.length, `${file}: no call found at all — has it been renamed?`).toBeGreaterThan(0);
  });

  it("positive control: the chrome rule really can tell the two doors apart", () => {
    // Без этого предыдущая проверка могла бы проходить потому, что
    // регулярка не ловит ничего.
    const loudOnly = "const user = await getCurrentUser();";
    const quietOnly = "const user = await getCurrentUserForChrome();";
    expect((loudOnly.match(/\bgetCurrentUser\(/g) ?? []).length).toBe(1);
    expect((quietOnly.match(/\bgetCurrentUser\(/g) ?? []).length).toBe(0);
    expect((quietOnly.match(/\bgetCurrentUser\w*\(/g) ?? []).length).toBe(1);
  });

  it("records why some reads deliberately stay unguarded", () => {
    expect(MUST_FAIL_LOUDLY.length).toBeGreaterThanOrEqual(9);
    for (const { why } of MUST_FAIL_LOUDLY) expect(why.length).toBeGreaterThan(60);
    for (const reason of Object.values(LEFT_ALONE_ON_PURPOSE)) expect(reason.length).toBeGreaterThan(60);
  });
});
