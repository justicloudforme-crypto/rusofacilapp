// Сводка таблицы долгов считается СКРИПТОМ по самой таблице.
// Состояние читается ПО НАЧАЛУ ячейки состояния, а не поиском слова где
// угодно: у №70 и №89 внутри текста есть «ЗАКРЫТА» про половину, а сами
// они открыты — счёт по вхождению слова соврал бы.
//
// СУММА КАТЕГОРИЙ ОБЯЗАНА СХОДИТЬСЯ С ЧИСЛОМ СТРОК, и это теперь не
// печатается справочно, а ПРОВЕРЯЕТСЯ: скрипт выходит с кодом 1, если
// открытых + закрытых + снятых ≠ строк. Повод: 09.09.2026 сводка
// «105 строк, 60 открытых, 44 закрытых» читалась как потерянная строка —
// на деле третья категория печаталась, а не терялась (единственная снятая
// строка — долг 36, «СНЯТ 31.08.2026 как несуществующий», PROGRESS.md:29972).
// Пересчёт подтвердил 60 + 44 + 1 = 105. Чтобы этот вопрос не задавался
// в третий раз, утверждение закреплено проверкой, а не прозой.
//
// Контроль: `node scripts/count-debts.mjs --plant`.
import { readFileSync } from "node:fs";
const PLANT = process.argv.includes("--plant");
const src = PLANT ? "PROGRESS.md" : (process.argv[2] ?? "PROGRESS.md");
// Разбор идёт по ТЕКСТУ, а не по имени файла, и это не украшение: тест
// src/lib/entry-point.test.ts запрещает скрипту писать файлы на импорте, а
// подсадке нужен изменённый вариант таблицы. Вариант живёт в памяти —
// временных файлов не создаётся вовсе. Поймано CI, а не локальным
// прогоном: `npm run verify` юнит-тесты не запускает, их гоняет только CI.
function collect(text) {
const rows = [];
for (const line of text.split("\n")) {
  const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]*)\|/);
  if (!m) continue;
  const n = +m[1];
  const state = m[2].replace(/\*\*/g, "").trim().toLowerCase();
  // только строки таблицы долгов: у неё состояние начинается с «открыт»,
  // «закрыт» или «снят»
  // Граница слова обязательна: без неё «закрытие вкладки» из совсем
  // другой таблицы читается как «закрыт» — поймано контролем ДО.
  if (!/^(открыт|открыта|закрыт|закрыта|снят|снята)(?![а-яё])/.test(state)) continue;
  rows.push({ n, state });
}
return rows;
}
function summarise(rows) {
  const open = rows.filter((r) => r.state.startsWith("открыт"));
  const closed = rows.filter((r) => r.state.startsWith("закрыт"));
  const dropped = rows.filter((r) => r.state.startsWith("снят"));
  const nums = rows.map((r) => r.n);
  const dupes = nums.filter((x, i) => nums.indexOf(x) !== i);
  const max = nums.length ? Math.max(...nums) : 0;
  const holes = [];
  for (let i = 1; i <= max; i++) if (!nums.includes(i)) holes.push(i);
  const sum = open.length + closed.length + dropped.length;
  return { rows, open, closed, dropped, dupes, holes, sum, balanced: sum === rows.length };
}

function print(s) {
  console.log(
    `строк ${s.rows.length}, открытых ${s.open.length}, закрытых ${s.closed.length}, ` +
      `снятых ${s.dropped.length}, сумма ${s.sum}, ` +
      `дублей ${s.dupes.length}${s.dupes.length ? " (" + s.dupes.join(",") + ")" : ""}, ` +
      `дыр ${s.holes.length}${s.holes.length ? " (" + s.holes.join(",") + ")" : ""}`,
  );
  console.log(
    `  из них открытых частично: ${s.open.filter((r) => r.state.includes("частично")).map((r) => r.n).join(", ")}`,
  );
  console.log(`  снятых поимённо: ${s.dropped.map((r) => r.n).join(", ") || "нет"}`);
  console.log(
    s.balanced
      ? `  сумма категорий сходится с числом строк: ${s.open.length} + ${s.closed.length} + ${s.dropped.length} = ${s.rows.length}`
      : `  СУММА НЕ СХОДИТСЯ: ${s.open.length} + ${s.closed.length} + ${s.dropped.length} = ${s.sum}, а строк ${s.rows.length} — ${Math.abs(s.rows.length - s.sum)} строк(и) не названы ни одной категорией`,
  );
}

if (PLANT) {
  // Подсадка: строка таблицы в состоянии, которого счётчик не знает.
  // Именно так и выглядела бы «потерянная строка», о которой шёл спор.
  const body = readFileSync("PROGRESS.md", "utf8");
  const healthy = summarise(collect(body));
  let ok = healthy.balanced;
  console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровая таблица (отрицательный контроль)`);

  // 1. состояние вне трёх категорий: строка исчезает из счёта совсем
  const s1 = summarise(collect(body.replace("| 36 | **СНЯТ", "| 36 | **отложен")));
  const caught1 = !s1.balanced || s1.rows.length !== healthy.rows.length;
  console.log(
    `  ${caught1 ? "поймано" : "ПРОПУЩЕНО"} — единственная снятая строка переименована в состояние вне трёх категорий ` +
      `(строк ${s1.rows.length} против ${healthy.rows.length})`,
  );

  // 2. прямой разлад суммы: подделываем счёт через дубль номера
  const s2 = summarise([...collect(body), { n: 999, state: "неведомо" }]);
  const caught2 = !s2.balanced;
  console.log(`  ${caught2 ? "поймано" : "ПРОПУЩЕНО"} — строка с неизвестным состоянием в наборе: сумма ${s2.sum} против строк ${s2.rows.length}`);

  ok &&= caught1 && caught2;
  console.log(ok ? "count:debts --plant — 2 из 2 подсадок, 1 из 1 отрицательный контроль" : "count:debts --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
} else {
  const s = summarise(collect(readFileSync(src, "utf8")));
  print(s);
  if (!s.balanced) {
    console.error(
      "count:debts — ОТКАЗ: сумма категорий не сходится с числом строк таблицы долгов.\n" +
        "  Строка состояния каждого долга обязана начинаться с «открыт», «закрыт» или «снят».",
    );
    process.exitCode = 1;
  }
}
