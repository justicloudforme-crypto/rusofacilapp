/**
 * Спрос на поиск числом, из командной строки.
 *
 * Второй способ посмотреть накопленное (первый — страница
 * `/admin/search-demand`), и он нужен по той же причине, по которой в этом
 * репозитории вообще живут `report:*`-скрипты: страница показывает то, что
 * умеет показать вёрстка, а скрипт печатает числа, которые можно вставить
 * в отчёт и сверить через месяц.
 *
 * Против какой базы он считает — говорит сам, первой строкой вывода. Без
 * `TURSO_DATABASE_URL` в окружении это локальная `dev.db`, и тогда числа
 * НЕ продовые; молчаливо выдать локальный ноль за продовый — ровно та
 * ошибка, которую этот проект уже совершал (PROGRESS.md, правило замера).
 *
 *   npx tsx scripts/report-search-demand.ts
 *   npx tsx scripts/report-search-demand.ts --self-test
 */
import { isEntryPoint } from "../src/lib/entry-point";
import { summarizeSearchDemand, type SearchDemandRow } from "../src/lib/search/demand";

const MAX_ROWS_READ = 20_000;

function selfTest(): void {
  const rows: SearchDemandRow[] = [
    { query: "Cuentos", resultCount: 3, lang: "es", followed: true },
    { query: "cuentos", resultCount: 3, lang: "es", followed: false },
    { query: "Рассказов", resultCount: 0, lang: "ru", followed: false },
    { query: "zzqq", resultCount: 0, lang: "es", followed: false },
  ];
  const s = summarizeSearchDemand(rows);
  const checks: Array<[string, boolean]> = [
    ["всего строк 4", s.total === 4],
    ["различных строк 3 (регистр не различается)", s.distinctQueries === 3],
    ["без результата 2", s.zeroResult === 2],
    ["с переходом 1", s.followed === 1],
    ["по локалям es 3 / ru 1", s.byLang.find((l) => l.lang === "es")?.total === 3 && s.byLang.find((l) => l.lang === "ru")?.total === 1],
    ["самая частая строка — cuentos, 2 раза", s.topQueries[0]?.query === "cuentos" && s.topQueries[0]?.total === 2],
    ["в списке ненайденного 2 строки", s.topZeroResultQueries.length === 2],
    // Позитивный контроль: сводка обязана уметь сказать «ничего нет».
    ["пустой вход даёт нули", summarizeSearchDemand([]).total === 0 && summarizeSearchDemand([]).topQueries.length === 0],
  ];
  let failed = 0;
  for (const [name, ok] of checks) {
    console.log(`${ok ? "  ok" : "FAIL"}  ${name}`);
    if (!ok) failed++;
  }
  console.log(`\n${checks.length - failed} из ${checks.length}`);
  process.exit(failed === 0 ? 0 : 1);
}

async function main() {
  if (process.argv.includes("--self-test")) return selfTest();

  const { db } = await import("../src/lib/db");
  const target = process.env.TURSO_DATABASE_URL ? "Turso (боевая)" : (process.env.DATABASE_URL ?? "file:./dev.db");
  console.log(`База: ${target}`);

  let rows: SearchDemandRow[] = [];
  try {
    rows = await db.searchQuery.findMany({
      select: { query: true, resultCount: true, lang: true, followed: true },
      orderBy: { hourBucket: "desc" },
      take: MAX_ROWS_READ,
    });
  } catch (error) {
    console.error("Таблицы SearchQuery в этой базе нет (создаётся при сборке).", error);
    process.exit(1);
  }

  const s = summarizeSearchDemand(rows);
  const share = (part: number) => (s.total === 0 ? "—" : `${((part / s.total) * 100).toFixed(1)}%`);
  console.log(`Прочитано строк:            ${rows.length} (потолок ${MAX_ROWS_READ})`);
  console.log(`Записанных заходов:         ${s.total}`);
  console.log(`Различных строк:            ${s.distinctQueries}`);
  console.log(`Без единого результата:     ${s.zeroResult} (${share(s.zeroResult)})`);
  console.log(`Закончились переходом:      ${s.followed} (${share(s.followed)})`);
  console.log(`По локалям:                 ${s.byLang.map((l) => `${l.lang}=${l.total}`).join(", ") || "—"}`);

  console.log("\nСамые частые строки (строка · раз · из них 0 результатов · из них с переходом):");
  if (s.topQueries.length === 0) console.log("  — ни одной записи");
  for (const q of s.topQueries) console.log(`  ${q.query} · ${q.total} · ${q.zeroResult} · ${q.followed}`);

  console.log("\nСтроки, не нашедшие ничего:");
  if (s.topZeroResultQueries.length === 0) console.log("  — ни одной");
  for (const q of s.topZeroResultQueries) console.log(`  ${q.query} · ${q.total}`);
}

// Скрипт открывает соединение с базой — он не должен начинаться оттого,
// что файл кто-то импортировал (правило 7.30).
if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
