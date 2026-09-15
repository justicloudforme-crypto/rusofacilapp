/**
 * ПЛИТКА ТЕМЫ ГОВОРИТ ПРАВДУ И НИКОГДА НЕ ПЕЧАТАЕТ НОЛЬ — 7.196, часть 2.
 *
 * ====================================================================
 * ЧТО СНЯЛ ВЛАДЕЛЕЦ И ЧЕМ ЕГО ФОРМУЛИРОВКА ОКАЗАЛАСЬ НЕВЕРНА
 * ====================================================================
 *
 * Снято: при выбранном C1 плитка «Еда и ресторан» пишет «266 слов», а
 * внутри той же темы плашка говорит «закрыто 8 слов уровня C1 в теме
 * «Еда и ресторан»». Формулировка владельца — «плитка не слушает
 * выбранный уровень».
 *
 * Перемерено, и формулировка опровергнута числом. Уровень плитка слушает:
 * прямой переход на `?level=C1` даёт 8, и по базе это верно. Неверно
 * другое — плитка держит ЧУЖИЕ числа всё время, пока едет ответ. Замер
 * 14.09.2026 с искусственной задержкой ответа `/api/flashcards/summary`
 * на 3000 мс: после нажатия на C1 плитка все три секунды печатает
 * «266 слов» и знака не несёт вовсе, потому что в разрезе «ВСЕ» тема не
 * закрыта. На телефоне по мобильной сети это и есть то, что видит
 * человек. Тем же измерением объяснён и второй дефект: до первого ответа
 * «0 слов» печатают 23 плитки из 23.
 *
 * ====================================================================
 * ЧТО СТОРОЖИТСЯ
 * ====================================================================
 *
 *   1. ЧИСЛО = ПЕРЕСЕЧЕНИЕ. Для каждого из пяти уровней и каждой из тем
 *      число на плитке сверяется с числом В БАЗЕ по паре «уровень × тема».
 *      Ожидание берётся из базы, а не из того же API, которое рисует
 *      экран, — иначе сторож сверял бы прибор сам с собой.
 *   2. НОЛЬ НЕ МЕЛЬКАЕТ. При искусственной задержке ответа на экране не
 *      должно быть ни одного «0 слов»: на месте числа стоит заглушка.
 *
 * Обе половины двусторонние:
 *   `--plant` подменяет ожидание на прежнее поведение (число темы целиком
 *   вместо пересечения) и на прежнюю заглушку (ноль вместо полосы); обе
 *   подсадки ОБЯЗАНЫ быть пойманы.
 *
 *   npx tsx scripts/check-dictionary-tiles.ts --base=http://localhost:3123
 *   npx tsx scripts/check-dictionary-tiles.ts --base=… --plant
 *   npx tsx scripts/check-dictionary-tiles.ts --base=… --table   # отчёт
 */
import { chromium } from "playwright";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";

const TOKEN = "RFNativeShell";
const COOKIE = "rf_native_shell";
const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
/** Сколько держать ответ, изображая мобильную сеть. */
const DELAY_MS = 2500;

interface Tile {
  label: string;
  total: number;
  bank: number;
  text: string;
  skeleton: boolean;
}

async function readTiles(page: import("playwright").Page): Promise<Tile[]> {
  return page.$$eval("[data-testid=category-tile]", (els) =>
    els.map((el) => ({
      label: (el.querySelector("span.min-h-11")?.textContent ?? "").trim(),
      total: Number(el.getAttribute("data-total") ?? "-1"),
      bank: Number(el.getAttribute("data-bank-total") ?? "-1"),
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
      skeleton: Boolean(el.querySelector("[data-testid=tile-count-skeleton]")),
    })),
  );
}

export async function main(): Promise<number> {
  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  if (!baseArg) {
    console.error("нужен --base=http://… — этой проверке нечего открывать без сервера");
    return 1;
  }
  const base = baseArg.slice("--base=".length);
  const plant = process.argv.includes("--plant");
  const table = process.argv.includes("--table");
  /**
   * `--ci` — форма пустой базы. Утверждение «число на плитке равно
   * пересечению» на фикстуре из четырнадцати карточек по-прежнему
   * проверяемо и проверяется; а отказ «в базе нет ни одной карточки» под
   * CI означал бы красноту по данным. Под `--ci` пустая база — пропуск с
   * явной строкой в выводе, а не молчаливый зелёный.
   */
  const ci = process.argv.includes("--ci");

  // ОЖИДАНИЕ ИЗ БАЗЫ. Считается ровно так же, как считает `siteCensus`, но
  // отдельным запросом — чтобы сторож не спрашивал ответ у того же места,
  // которое он судит.
  // Тот же адаптер, что у продукта (`src/lib/db.ts`): читается ЛОКАЛЬНАЯ
  // база, та же, из которой отвечает сервер под проверкой. В боевую базу
  // этот сторож не ходит никогда — `TURSO_*` здесь не читаются вовсе.
  const db = new PrismaClient({
    adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
  });
  const rows = await db.flashcardCard.findMany({ select: { category: true, level: true } });
  await db.$disconnect();
  const inBank = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.level}/${row.category}`;
    inBank.set(key, (inBank.get(key) ?? 0) + 1);
    const whole = `ALL/${row.category}`;
    inBank.set(whole, (inBank.get(whole) ?? 0) + 1);
  }
  if (rows.length === 0) {
    const message = "в базе нет ни одной карточки — сверять нечего, и «0 расхождений» тут ничего не значит";
    if (!ci) {
      console.error(message);
      return 1;
    }
    console.log(`check:dictionary-tiles — ПРОПУЩЕНО под --ci: ${message}`);
    return 0;
  }

  const browser = await chromium.launch();
  const problems: string[] = [];
  let compared = 0;
  let zerosWhileLoading = 0;
  let skeletonsWhileLoading = 0;

  try {
    const ctx = await browser.newContext({ userAgent: `${SAFARI} ${TOKEN}`, viewport: { width: 360, height: 720 } });
    await ctx.addCookies([{ name: COOKIE, value: "1", url: base }]);
    const page = await ctx.newPage();

    // ── ПОЛОВИНА 2: ноль не мелькает, пока едет ответ ──
    await page.route("**/api/flashcards/summary", async (route) => {
      await new Promise((r) => setTimeout(r, DELAY_MS));
      await route.continue();
    });
    await page.goto(`${base}/ru/vocabulary`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector("[data-testid=category-tile]", { timeout: 30_000 });
    // Признак оболочки клиент узнаёт из эффекта, а не на первом кадре
    // (`useIsNativeShell`), поэтому снимок делается ПОСЛЕ гидратации —
    // иначе сторож судил бы веб-ветку, думая, что судит оболочку.
    await page.waitForTimeout(800);
    const loading = await readTiles(page);
    // «Ноль на экране» — это `data-total=0` БЕЗ заглушки: именно так
    // выглядело «0 слов», и именно так его читает человек.
    zerosWhileLoading = loading.filter((t) => t.total === 0 && !t.skeleton).length;
    skeletonsWhileLoading = loading.filter((t) => t.skeleton).length;
    if (loading.length === 0) {
      problems.push("во время загрузки плиток на экране не было вовсе — проверять нечего");
    }
    const wantZeros = plant ? loading.length : 0;
    if (zerosWhileLoading !== wantZeros) {
      problems.push(
        `пока ответ едет (${DELAY_MS} мс), «0 слов» печатают ${zerosWhileLoading} плиток из ${loading.length}, ` +
          `ожидалось ${wantZeros}`,
      );
    }
    if (!plant && skeletonsWhileLoading !== loading.length) {
      problems.push(`заглушка стоит на ${skeletonsWhileLoading} плитках из ${loading.length}, ожидалась на всех`);
    }
    await page.unroute("**/api/flashcards/summary");

    // ── ПОЛОВИНА 1: число на плитке = пересечение «уровень × тема» ──
    const report: string[] = [];
    for (const level of LEVELS) {
      await page.goto(`${base}/ru/vocabulary?level=${level}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForSelector("[data-testid=category-tile]", { timeout: 30_000 });
      await page.waitForFunction(
        () => !document.querySelector("[data-testid=tile-count-skeleton]"),
        undefined,
        { timeout: 30_000 },
      );
      const tiles = await readTiles(page);
      // Сверяется РАСПРЕДЕЛЕНИЕ, а не «плитка X против строки X»: подпись
      // темы на экране локализована, а в базе лежит ключ. Отсортированные
      // списки чисел совпадают тогда и только тогда, когда совпадают и
      // сами числа, и их количество, — а подмена разреза (тема целиком
      // вместо пересечения) их разводит целиком, что и показывает подсадка.
      compared += tiles.length;
      const onScreen = tiles.map((t) => t.total).sort((a, b) => a - b);
      const expectedKey = plant ? "ALL" : level;
      const inDb = [...inBank.entries()]
        .filter(([key]) => key.startsWith(`${expectedKey}/`))
        .map(([, n]) => n)
        .sort((a, b) => a - b);
      // Темы, которых на этом уровне нет вовсе, плитка печатает нулём —
      // и это правда: строк действительно ноль.
      while (inDb.length < onScreen.length) inDb.unshift(0);
      const same = onScreen.length === inDb.length && onScreen.every((n, i) => n === inDb[i]);
      if (!same) {
        problems.push(
          `уровень ${level}: на экране ${JSON.stringify(onScreen)}, в базе по пересечению ${JSON.stringify(inDb)}`,
        );
      }
      report.push(
        `  ${level}: плиток ${tiles.length}, сумма на экране ${onScreen.reduce((a, b) => a + b, 0)}, ` +
          `сумма в базе ${inDb.reduce((a, b) => a + b, 0)}`,
      );
    }
    if (table) for (const line of report) console.log(line);
  } finally {
    await browser.close();
  }

  if (plant) {
    const caught = problems.length > 0;
    console.log(`  ${caught ? "поймано" : "ПРОПУЩЕНО"} — подсадка «число темы целиком вместо пересечения» и «ноль вместо заглушки»`);
    for (const p of problems.slice(0, 6)) console.log(`    ${p}`);
    console.log(
      caught
        ? "check:dictionary-tiles --plant — прежнее поведение роняет прогон"
        : "check:dictionary-tiles --plant — FAILED: подсадка прошла молча",
    );
    return caught ? 0 : 1;
  }

  if (problems.length) {
    console.error("ПЛИТКА ТЕМЫ РАСХОДИТСЯ С БАЗОЙ ИЛИ ПЕЧАТАЕТ НОЛЬ:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(
    `check:dictionary-tiles — сверено ${compared} плиток по ${LEVELS.length} уровням; ` +
      `во время загрузки «0 слов» ${zerosWhileLoading}, заглушек ${skeletonsWhileLoading}.`,
  );
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
