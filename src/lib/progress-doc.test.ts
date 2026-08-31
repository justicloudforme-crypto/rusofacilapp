import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PROGRESS.md is the project's cold-start document: the file someone opens
 * with no other context and continues the work from. That makes it
 * load-bearing, and load-bearing files get a test.
 *
 * Two incidents behind this one. On 28.08.2026 PROGRESS.md was truncated to
 * **0 bytes** by a script that read the file inside its own
 * open-for-write call — caught only because a grep afterwards returned
 * nothing. On 30.08.2026 a patch inserted its section twice, leaving a
 * 240-line duplicate in the middle of the orientation material, which
 * nobody noticed until the file was read end to end a day later.
 *
 * So: it must be big, it must answer the questions a cold reader asks, and
 * no section may appear twice.
 */

const PROGRESS = readFileSync(join(process.cwd(), "PROGRESS.md"), "utf8");

/** Each entry is a question a cold reader has, and a string in the file
 * that answers it. Deliberately phrased as questions — when one of these
 * fails, the fix is to write the answer, not to delete the assertion. */
const COLD_START_QUESTIONS: [string, string][] = [
  ["what is this project", "## 0. ЧТО ЭТО ЗА ПРОЕКТ"],
  ["what is the stack", "Next.js 16.3"],
  ["where does production data live", "Turso"],
  ["how do I run and check it", "## 1. КАК ЗАПУСТИТЬ И ПРОВЕРИТЬ"],
  // Added 01.09.2026 after a real cold start: the very first action of the
  // session — noticing local main was three merges behind prod — was the
  // one thing the file did not tell anyone to do.
  ["is my local main up to date", "git merge --ff-only origin/main"],
  ["why do half the pages not render locally", "prisma/dev.db"],
  ["how do I render a DB page without credentials", "migrate diff --from-empty"],
  ["what state is it in, measured when", "## 2. ТЕКУЩЕЕ СОСТОЯНИЕ"],
  ["is prod running the code I am looking at", "sentry-release"],
  ["is the sitemap the whole site", "## 3. ОБХОД ПО SITEMAP ≠ ОБХОД САЙТА"],
  ["how is the URL list built now", "статические маршруты из кода"],
  ["when may I trust a check that returns zero", "## 4. ПРАВИЛА ЗАМЕРА"],
  ["does that apply to before/after comparisons too", "Сравнение двух пустых выборок обязано падать"],
  ["why case-insensitive attributes", "hrefLang"],
  ["what went wrong with regexes built from data", "isPlausibleShortCode"],
  ["where is the shared escape", "src/lib/regex.ts"],
  ["can the filter I apply before measuring be wrong too", "### 4.5."],
  ["how does robots.txt resolve Allow against Disallow", "Order of precedence for rules"],
  ["what did the title change break and why", "## 5. ЗАГОЛОВКИ: ЧТО СЛОМАЛОСЬ"],
  ["why was the simple reorder rejected", "174 заголовка вместо 69"],
  ["what may I not touch", "## 6. ЗАМОРОЖЕННЫЕ СТРАНИЦЫ"],
  ["how is the freeze lifted", "contentPageTitle"],
  ["when is it lifted", "25.09.2026"],
  ["what is the plan for themed puzzles", "## 7. ТЕМАТИЧЕСКИЕ ПАЗЛЫ"],
  ["how do I work here (branches, PRs)", "Договорённости по процессу"],
  ["what can hurt production from my laptop", "ОСТАВШИЕСЯ ДЫРЫ"],
  ["what is known-unknown", "ЧТО НЕ ПРОВЕРЕНО И ЧЕМ ЭТО БЛОКИРОВАНО"],
  ["why is nothing static", "ВЕСЬ САЙТ РЕНДЕРИТСЯ ДИНАМИЧЕСКИ"],
  ["what is the experiment", "ЭКСПЕРИМЕНТЫ «ТЕЛО ТОНКИМ СТРАНИЦАМ»"],
  ["how is the experiment read out", "docs/experiment-readout-2026-09-25.md"],
  ["never write a file while reading it", "одним проходом"],
  // Added 29.08.2026, the round that stamped lastmod on production and
  // recovered a sitemap outage. Each of these is something a cold reader
  // would otherwise have to reconstruct from the code.
  ["which date is in lastmod and why that one", "часы сервера — единственный источник правды"],
  ["how many puzzle URLs carry a lastmod", "URL пазлов с `lastmod` | **138**"],
  ["how many carry none, and why", "URL пазлов без `lastmod` | **22**"],
  ["why stories have no lastmod yet", "рассказы с `lastmod` | **0 из 650**"],
  ["what limits manual Search Console submission", "Лимит Search Console — **10 URL в сутки**"],
  ["which reindex batches were already sent", "СТАТУС ОТПРАВКИ"],
  ["what keeps the other URLs crawled", "Остальные 124 изменённых URL вручную не отправляются"],
  ["what took the sitemap down and how it was fixed", "### 7.17. АВАРИЯ"],
  ["how are open debts written down", "условие → триггер → следствие"],
  ["was a seventh landing page decided", "РЕШЕНИЕ: ждать данных"],
  // Added 29.08.2026 after the SECOND real cold start — the one that began
  // straight after a compaction, with this file as the only input. Each of
  // these is a question that round had to answer and the file could not,
  // or answered with a number that had gone stale.
  ["how many sitemap URLs carry a lastmod in total", "из них с `lastmod` / без | **376 / 1530**"],
  // Pinned to the RE-CHECK, not to a SHA. A hardcoded release breaks on
  // every deploy and teaches the next reader to edit the test rather than
  // to re-measure — which is the opposite of what section 2 says to do.
  ["which release is production on, and how do I re-check", "**Прод на 29.08.2026, после мержа"],
  ["how do I re-check that release myself", "grep -o 'sentry-release=[a-f0-9]*'"],
  ["has the reindex batch actually been sent", "пачка 1 | **НЕТ"],
  ["did the file survive a compaction", "### 1.3."],
  ["is the sitemap resilient, and how was that shown", "### 7.21."],
  ["how big was the schema-parser bug really", "**25, в 6 моделях**"],
  ["is every database read in sitemap.ts protected", "защищено было только ОДНО чтение из"],
  ["what is left that needs Turso credentials", "PRAGMA table_info"],
  ["what should the next round do", "### 7.22."],
  ["what would be premature to build next", "три из четырёх крупных направлений упираются в календарь"],
  ["why did local data disagree with production on dates", "Хвост этой же ошибки"],
  // Added 29.08.2026, the round that got read-only Turso credentials and
  // closed the column audit directly instead of by inference.
  ["are any columns missing on production", "**недостающих колонок на проде** | **0**"],
  ["how was that proven, and with what control", "### 7.23."],
  ["can running the test suite touch production", "гейтом на точку входа"],
  ["which database reads may fail without killing a page", "### 7.24."],
  ["which reads must keep failing loudly, and why", "MUST_FAIL_LOUDLY"],
  ["why is the story insights block left alone", "измеряемая\n  переменная"],
  ["where does the robots.txt matcher live now", "src/lib/robots-matcher.ts"],
  ["how many URLs may a crawler actually fetch", "**итого разрешённое множество** | **1904**"],
  ["do local and production dates agree", "### 7.26."],
  ["has the glossary seed been run against production", "### 7.27."],
  // Added 29.08.2026, the round that ran the seed and lost manual Search
  // Console submission as a lever.
  ["how many glossary terms are live", "терминов в глоссарии | **119**"],
  ["can I submit URLs to Search Console by hand", "у владельца исчерпан лимит Search Console"],
  ["when does the salud clock start", "от даты подачи пачки 1"],
  ["what recrawl levers are left", "### 7.28."],
  ["how big is the whole crawlable site now", "весь краулимый сайт | **2372** URL"],
  ["how many URLs may a crawler fetch", "**разрешено краулеру** (200 и разрешено robots) | **1908**"],
  ["are there indexable pages nobody watches", "### 7.29."],
  ["do scripts run when imported", "### 7.30."],
  ["how do I stop a script running on import", "isEntryPoint(import.meta.url)"],
  ["can the test suite reach production", "указывающим на несуществующий хост"],
  // Added 29.08.2026 with the first production incident, and rewritten the
  // same day when it was diagnosed and fixed. These exist so a cold reader
  // learns what the audit numbers cannot see BEFORE quoting them.
  ["is anything broken in production right now", "## 2.1. ИНЦИДЕНТЫ НА ПРОДЕ"],
  ["what is incident 1", "### ИНЦИДЕНТ №1"],
  ["what actually broke, and what caused it", "Причина, в одну строку"],
  ["why did the audit not catch it", "Почему этого не увидел ни один замер в этом файле"],
  ["what do the 1908 URLs actually prove", "Не называть анонимный обход «проверкой сайта»"],
  ["how do I tell a client failure from a server one", "даёт **500**, а не 200"],
  ["how do I check what a browser really sees", "check-rendered-surface.mjs"],
  ["which pages render differently when signed in", "Меняются все девять"],
  ["how do I log in locally without a password", "HMAC-SHA256 по `SESSION_SECRET`"],
  ["are there users in the local dev.db", "**333 пользователя**"],
  ["was the entry-point gate fully verified", "по всем пяти"],
  ["can a test reach production through DATABASE_URL", "0 соединений"],
  // Added 29.08.2026, after the fix was confirmed on production.
  ["how long was the site broken for", "СКОЛЬКО ЭТО ДЛИЛОСЬ"],
  ["were search engines affected", "Google исполняет JavaScript"],
  ["is the fix confirmed on production, not just locally", "подтверждена на живом проде"],
  ["how many lessons are there really", "Уроков 120, URL 240"],
  ["does the service worker serve a pre-deploy build", "пред-деплойную"],
  ["which cache actually held the stale page", "все документы падают в общий `others`"],
  ["what runs before a merge", "check:rendered:local"],
  ["is the freeze still intact", "Заморозка цела"],
  ["which pages change with user progress", "Структурно** различаются"],
  ["why is the ru glossary in Spanish", "остался испанской копией"],
  ["do the landing pages need an h2", "ровно шесть тематических лендингов"],
  // Added 29.08.2026, second round after the incident.
  ["is the ru dictionary fully translated now", "переведён целиком, 25 ключей"],
  ["should Cyrillic in es.json be treated as a bug", "ложным классом"],
  ["where else can database content break a render", "где ещё данные попадают в парсер"],
  ["was there a second live bug of the same kind", "ВТОРАЯ ЖИВАЯ АВАРИЯ"],
  ["does the flashcard search break on a hyphen", "любом запросе с дефисом"],
  ["does check:rendered run in CI", "внутри существующей задачи `e2e`"],
  ["why does CI need a glossary fixture", "не воспроизвёлся бы в CI"],
  ["how long does the CI render check take", "**38 секунд**"],
  ["why did a CI step hang for an hour", "сервер переживал остановку"],
  ["what stops the verify server", "process.kill(-pid)"],
  ["what does a subscriber see that a free account does not", "настоящая отрезка данных"],
  ["is the paid surface actually checked on production", "ПРОГОН НА ПРОДЕ СОСТОЯЛСЯ"],
  ["what is still not covered for a subscriber", "Что осталось непокрытым и почему"],
  ["where is the test account password", "ТЕСТОВЫЙ АККАУНТ: где лежит пароль"],
  ["how do I run the subscriber check next time", "RUSOFACIL_TEST_PASSWORD"],
  ["which URLs do I check in Search Console", "Список URL для проверки"],
  ["how do I tell the outage from ordinary noise", "6 контрольных незатронутых"],
  // Added 31.08.2026, the round that overturned its predecessor's diagnosis.
  // The first of these matters most: 7.63 is still in the file and still
  // states the wrong cause, so a cold reader must meet the correction before
  // acting on it.
  ["why could nobody buy Premium for six days", "### 7.66."],
  ["can I trust what 7.63 says the cause was", "ЭТОТ РАЗДЕЛ СОДЕРЖИТ ОШИБОЧНЫЙ ДИАГНОЗ"],
  ["must the Stripe secret key be rolled", "не перевыпускался и не нуждается в этом"],
  ["does anything check that a price id is alive", "/api/admin/stripe-health"],
  ["what does the price check fail to catch", "Чего эта проверка НЕ ловит"],
  ["what happens when Stripe refuses the checkout", "checkout-blocked"],
];

describe("PROGRESS.md is usable from a cold start", () => {
  it("is not empty or truncated", () => {
    // The 0-byte incident. 100 kB is far below the real size (~223 kB) and
    // far above anything an accident would leave behind.
    expect(PROGRESS.length).toBeGreaterThan(100_000);
    expect(PROGRESS.startsWith("# PROGRESS.md")).toBe(true);
  });

  it("answers every question a cold reader starts with", () => {
    const unanswered = COLD_START_QUESTIONS.filter(([, marker]) => !PROGRESS.includes(marker)).map(
      ([question, marker]) => `${question}  (looked for: ${marker})`,
    );
    expect(unanswered).toEqual([]);
  });

  it("positive control: a question with no answer in the file is reported", () => {
    // Without this the assertion above could pass because the search is
    // broken rather than because the answers are there.
    const fake: [string, string][] = [["a question nobody wrote up", "МАРКЕР-КОТОРОГО-НЕТ-В-ФАЙЛЕ"]];
    const unanswered = fake.filter(([, marker]) => !PROGRESS.includes(marker));
    expect(unanswered).toHaveLength(1);
  });

  it("has no section repeated", () => {
    // The duplicated-block incident: a patch inserted its section twice and
    // the file carried two near-identical copies of 240 lines.
    const headings = PROGRESS.split("\n").filter((line) => line.startsWith("## "));
    expect(headings.length).toBeGreaterThan(20);
    const seen = new Set<string>();
    const repeated: string[] = [];
    for (const h of headings) {
      if (seen.has(h)) repeated.push(h);
      seen.add(h);
    }
    expect(repeated).toEqual([]);
  });

  it("never mixes Latin and Cyrillic inside one word", () => {
    // The standing content check, applied to the document itself — it
    // quotes Russian and Spanish side by side on almost every page.
    const mixed = new Set<string>();
    for (const word of PROGRESS.split(/[^\p{L}]+/u)) {
      if (/[А-Яа-яЁё]/.test(word) && /[A-Za-z]/.test(word)) mixed.add(word);
    }
    expect([...mixed]).toEqual([]);
  });
});
