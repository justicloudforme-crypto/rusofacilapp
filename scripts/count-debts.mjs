// Сводка таблицы долгов считается СКРИПТОМ по самой таблице.
// Состояние читается ПО НАЧАЛУ ячейки состояния, а не поиском слова где
// угодно: у №70 и №89 внутри текста есть «ЗАКРЫТА» про половину, а сами
// они открыты — счёт по вхождению слова соврал бы.
import { readFileSync } from "node:fs";
const src = process.argv[2] ?? "PROGRESS.md";
const rows = [];
for (const line of readFileSync(src, "utf8").split("\n")) {
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
const open = rows.filter((r) => r.state.startsWith("открыт"));
const closed = rows.filter((r) => r.state.startsWith("закрыт"));
const dropped = rows.filter((r) => r.state.startsWith("снят"));
const nums = rows.map((r) => r.n);
const dupes = nums.filter((x, i) => nums.indexOf(x) !== i);
const max = Math.max(...nums);
const holes = [];
for (let i = 1; i <= max; i++) if (!nums.includes(i)) holes.push(i);
console.log(
  `строк ${rows.length}, открытых ${open.length}, закрытых ${closed.length}, ` +
    `снятых ${dropped.length}, сумма ${open.length + closed.length + dropped.length}, ` +
    `дублей ${dupes.length}${dupes.length ? " (" + dupes.join(",") + ")" : ""}, ` +
    `дыр ${holes.length}${holes.length ? " (" + holes.join(",") + ")" : ""}`,
);
console.log(`  из них открытых частично: ${open.filter((r) => r.state.includes("частично")).map((r) => r.n).join(", ")}`);
