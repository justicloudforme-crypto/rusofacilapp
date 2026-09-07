/**
 * Удаление СВОИХ строк журнала спроса — поимённо, по списку из файла.
 *
 * Зачем это отдельный скрипт с манифестом, а не команда в консоли. Заход,
 * который проверяет журнал спроса браузером против прода, неизбежно пишет
 * в боевую таблицу `SearchQuery` — на каждый выход из окна поиска по
 * строке. Убирать их надо, иначе отчёт спроса врёт; но убирать «всё за
 * сегодня» или «всё, что похоже на тест» нельзя: 7.131 замерил, что
 * пока идёт заход, в ту же таблицу пишут живые посетители.
 *
 * Отсюда устройство:
 *
 *   * список — ФАЙЛ (`docs/search-demand-own-rows-*.json`), пара
 *     «id → точная строка запроса». Не диапазон дат, не шаблон, не «всё,
 *     что начинается с zzq»;
 *   * перед удалением каждая строка ЧИТАЕТСЯ и сверяется по `query`.
 *     Расхождение — отказ всего прогона, а не пропуск одной строки:
 *     если в базе под этим id лежит другой запрос, значит представление
 *     о таблице неверно, и продолжать нельзя;
 *   * по умолчанию не пишется НИЧЕГО. Запись — только по `--apply`;
 *   * `--force` не предусмотрен вовсе.
 *
 * ГЛАВНОЕ, ЧТО ЗДЕСЬ НЕ ИСПОЛЬЗУЕТСЯ КАК ОСНОВАНИЕ — отпечаток процесса
 * в `cuid`. Заход 7.130 опознавал свои строки по нему (одинаковый
 * отпечаток + непрерывный счётчик), а 7.131 замерил, что этого
 * недостаточно: отпечаток принадлежит серверному ПРОЦЕССУ, и посетителя,
 * которого обслужил тот же экземпляр, счётчик кладёт вплотную к моим
 * строкам — в последовательность `04jm` 0000–000b попала чужая `comida`
 * на 0008. Единственный признак «моё» — текст запроса, который набирал
 * прогон.
 *
 * База — та, на которую указывает окружение (`src/lib/db.ts`). Без
 * `TURSO_DATABASE_URL` это локальная `dev.db`, и скрипт говорит об этом
 * первой строкой: молча выдать локальную уборку за продовую — ровно та
 * ошибка, от которой предостерегает PROGRESS.md.
 *
 *   npx tsx scripts/delete-own-search-demand-rows.ts \
 *     --manifest=docs/search-demand-own-rows-2026-09-06.json          # dry-run
 *   npx tsx scripts/delete-own-search-demand-rows.ts \
 *     --manifest=docs/search-demand-own-rows-2026-09-06.json --apply  # удаление
 */
import { readFileSync } from "node:fs";
import { isEntryPoint } from "../src/lib/entry-point";

interface Manifest {
  note?: string;
  takenAt?: string;
  rows: Record<string, string>;
}

function readManifest(path: string): Manifest {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof parsed !== "object" || parsed === null || !("rows" in parsed)) {
    throw new Error(`${path}: ожидался объект с полем "rows"`);
  }
  const rows = (parsed as { rows: unknown }).rows;
  if (typeof rows !== "object" || rows === null || Array.isArray(rows)) {
    throw new Error(`${path}: "rows" должен быть объектом id → строка запроса`);
  }
  for (const [id, query] of Object.entries(rows as Record<string, unknown>)) {
    if (typeof query !== "string" || query.length === 0) {
      throw new Error(`${path}: у ${id} пустая или нестроковая строка запроса`);
    }
  }
  return parsed as Manifest;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const manifestPath = argv.find((a) => a.startsWith("--manifest="))?.slice("--manifest=".length);
  const apply = argv.includes("--apply");
  if (argv.includes("--force")) {
    console.error("--force не предусмотрен: несовпадение строки запроса — это отказ, а не повод дожать.");
    process.exit(1);
  }
  if (!manifestPath) {
    console.error("нужен --manifest=docs/search-demand-own-rows-<дата>.json");
    process.exit(1);
  }

  const manifest = readManifest(manifestPath);
  const entries = Object.entries(manifest.rows);

  const { db } = await import("../src/lib/db");
  const target = process.env.TURSO_DATABASE_URL ? "Turso (БОЕВАЯ)" : (process.env.DATABASE_URL ?? "file:./dev.db");
  console.log(`База:     ${target}`);
  console.log(`Манифест: ${manifestPath} — ${entries.length} строк${manifest.takenAt ? `, снят ${manifest.takenAt}` : ""}`);
  console.log(apply ? "Режим:    УДАЛЕНИЕ (--apply)\n" : "Режим:    dry-run, ничего не пишется (--apply для удаления)\n");

  const totalBefore = await db.searchQuery.count();
  let found = 0;
  let missing = 0;
  const mismatched: string[] = [];

  for (const [id, expected] of entries) {
    const row = await db.searchQuery.findUnique({ where: { id }, select: { query: true } });
    if (!row) {
      console.log(`  нет строки   ${id}  (${expected})`);
      missing++;
      continue;
    }
    if (row.query !== expected) {
      console.log(`  НЕ СОВПАЛО   ${id}: в базе «${row.query}», в манифесте «${expected}»`);
      mismatched.push(id);
      continue;
    }
    found++;
    console.log(`  ${apply ? "удаляю      " : "нашлась     "} ${id}  «${expected}»`);
    if (apply) {
      // Условие повторяет сверку: между чтением и удалением строка
      // измениться не может, но удаление, которое не зависит от
      // прочитанного, — это удаление по id, а не по основанию.
      await db.searchQuery.deleteMany({ where: { id, query: expected } });
    }
  }

  const totalAfter = await db.searchQuery.count();
  console.log(`\nстрок в таблице: было ${totalBefore}, стало ${totalAfter}`);
  console.log(`${apply ? "удалено" : "нашлось"}: ${found}; не найдено: ${missing}; расхождений: ${mismatched.length}`);

  if (mismatched.length > 0) {
    console.log("\nFAIL — под этими id лежат другие запросы, таблица не та, что ожидалась");
    process.exit(1);
  }
}

// Прод трогается только намеренным запуском файла, а не чьим-то импортом
// (правило 7.30).
if (isEntryPoint(import.meta.url)) {
  main();
}
