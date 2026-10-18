// ФОРМАТ prisma/schema.prisma — ЗАХОД 7.274 (18.10.2026).
//
// Зачем. В 7.273 (#497) схему пришлось отдельным PR приводить к виду
// `prisma format`: правка за правкой она разъехалась — колонки полей
// сбились, рамки `/** */` стояли не так, как их ставит сама Prisma. Пока
// формат никто не проверяет, следующая правка схемы снова оставит
// «почти отформатированный» файл, и следующий `prisma format` принесёт в
// чужой PR пробельный диф на десятки строк. Решение 7.273 (раздел 7
// PROGRESS.md): после мержа #497 поставить проверку в `verify` и в CI.
//
// Что проверяется: `prisma format --check` по prisma/schema.prisma — тот
// же разбор, которым Prisma форматирует файл; своего представления о
// «правильных пробелах» здесь нет. Плюс два отказа своих: файла схемы нет
// и в файле нет ни одной `model` (пустая выборка — красный, правило
// замера 4.1: пустой файл Prisma честно считает отформатированным).
//
// Красный чинится одной командой: `npx prisma format`, и её диф едет в
// тот же PR, что и правка схемы.
//
// Контроль: `node scripts/check-schema-format.mjs --plant` — копии схемы
// во временной папке: чистая обязана молчать, с подсаженным лишним
// пробелом (в колонке поля и в конце строки) и пустая — краснеть.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const IS_ENTRY_POINT = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

export const SCHEMA = "prisma/schema.prisma";
const PRISMA_BIN = join("node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");

/** Файл схемы → список отказов (пустой — чисто). */
export function checkSchemaFormat(path) {
  if (!existsSync(path)) return [`${path} — файла схемы нет`];
  const text = readFileSync(path, "utf8");
  const models = (text.match(/^model \w+ \{/gm) ?? []).length;
  if (models === 0) return [`${path} — в схеме ни одной model: сверять формат не по чему`];
  const run = spawnSync(PRISMA_BIN, ["format", "--check", `--schema=${path}`], { encoding: "utf8" });
  if (run.error) return [`${path} — prisma не запустилась: ${run.error.message}`];
  if (run.status !== 0) {
    const said = `${run.stdout}\n${run.stderr}`.split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "";
    return [`${path} — не в формате prisma format (${said}); починка: npx prisma format`];
  }
  return [];
}

function report() {
  const failures = checkSchemaFormat(SCHEMA);
  for (const f of failures) console.error(`  ОТКАЗ: ${f}`);
  console.log(
    failures.length
      ? `check:schema-format — ${failures.length} отказ(ов)`
      : `check:schema-format — ${SCHEMA} в формате prisma format`,
  );
  return failures.length === 0;
}

function plantControls() {
  const real = readFileSync(SCHEMA, "utf8");
  const dir = mkdtempSync(join(tmpdir(), "rf-schema-format-"));
  let ok = true;
  try {
    const controls = [
      { name: "чистая копия схемы (отрицательный контроль)", text: real, red: false },
      {
        name: "лишний пробел в колонке первого поля `id`",
        text: real.replace(/^( {2}id)(\s+)/m, "$1$2 "),
        red: true,
      },
      {
        name: "пробел в конце строки объявления первой model",
        text: real.replace(/^(model \w+ \{)$/m, "$1 "),
        red: true,
      },
      { name: "пустой файл схемы", text: "", red: true },
    ];
    for (const [i, c] of controls.entries()) {
      if (c.red && c.text === real) {
        console.log(`  ПРОПУЩЕНО — ${c.name}: подсадка не легла, схема не изменилась`);
        ok = false;
        continue;
      }
      const path = join(dir, `schema-${i}.prisma`);
      writeFileSync(path, c.text);
      const red = checkSchemaFormat(path).length > 0;
      const right = red === c.red;
      console.log(`  ${right ? (c.red ? "поймано" : "молчит") : c.red ? "ПРОПУЩЕНО" : "ЛОЖНО КРАСНЫЙ"} — ${c.name}`);
      ok &&= right;
    }
    console.log(
      ok
        ? `check:schema-format --plant — ${controls.length - 1} из ${controls.length - 1} подсадок, 1 из 1 отрицательный контроль`
        : "check:schema-format --plant — FAILED",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return ok;
}

if (IS_ENTRY_POINT) {
  const ok = process.argv.includes("--plant") ? plantControls() : report();
  process.exitCode = ok ? 0 : 1;
}
