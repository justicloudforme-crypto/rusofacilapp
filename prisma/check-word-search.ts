/**
 * Целостность филвордов (Sopa de Letras) — солвер по всему банку пазлов.
 * CHECK ONLY, ничего не пишет и ничего не перегенерирует.
 *
 * Три величины на каждый WORD_SEARCH-пазл:
 *  1. Найдено ли каждое слово из списка В САМОЙ СЕТКЕ — прямой линией в
 *     одном из 8 направлений (для ★/curved — гнутым 8-связным путём без
 *     повторов клеток). Координаты, записанные генератором, намеренно НЕ
 *     читаются: игрок их не видит, и расхождение сетки с координатами —
 *     это ровно тот дефект, который надо поймать.
 *  2. Плотность = сумма длин слов ÷ число клеток.
 *  3. Отношение длиннейшего слова к МЕНЬШЕЙ стороне сетки: выше 1 —
 *     слово физически не может лечь ни по короткой оси, ни по диагонали
 *     (её длина ограничена короткой стороной), только по длинной.
 *
 * Позитивный контроль обязателен и встроен: каждый прогон сначала
 * подсаживает три пазла — нормальный, с ненайденным словом и с
 * переполненной сеткой — и падает, если проверка не поймала оба дефекта
 * или заругалась на нормальный. «0 проблем» без него не результат
 * (PROGRESS.md, раздел 4.1).
 *
 * Использование:
 *   npm run check:word-search
 *   npm run check:word-search -- --self-test     # только контроль
 *   npm run check:word-search -- --density=0.65  # порог плотности
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run check:word-search
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";
import {
  auditPuzzle,
  puzzleInputFromRow,
  type PuzzleAudit,
  type PuzzleInput,
} from "../src/lib/word-games/word-search-audit";

const DEFAULT_DENSITY_CEILING = 0.65;

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

/* ------------------------------------------------------------------ */
/* Позитивный контроль                                                 */
/* ------------------------------------------------------------------ */

/** Нормальный пазл: 6×6, три слова, каждое реально лежит в сетке. */
function cleanControl(): PuzzleInput {
  const grid = [
    ["к", "о", "т", "а", "б", "в"],
    ["г", "д", "е", "ж", "з", "и"],
    ["д", "о", "м", "к", "л", "м"],
    ["н", "о", "п", "р", "с", "т"],
    ["с", "ы", "р", "у", "ф", "х"],
    ["ц", "ч", "ш", "щ", "ъ", "ы"],
  ];
  return {
    id: "control-clean",
    level: "A1",
    sequence: 0,
    curved: false,
    grid,
    words: [{ word: "кот" }, { word: "дом" }, { word: "сыр" }],
  };
}

/** Тот же пазл, но одно слово из списка в сетке отсутствует. */
function missingWordControl(): PuzzleInput {
  const base = cleanControl();
  return { ...base, id: "control-missing", words: [...base.words, { word: "лиса" }] };
}

/** Переполненная сетка: 6×6 = 36 клеток, слов на 40 букв (111%), и
 * длиннейшее слово (14 букв) длиннее обеих сторон. */
function overfullControl(): PuzzleInput {
  const base = cleanControl();
  return {
    ...base,
    id: "control-overfull",
    words: [
      { word: "дееспособность" },
      { word: "конституционный" },
      { word: "кот" },
      { word: "дом" },
      { word: "сыр" },
      { word: "мама" },
    ],
  };
}

interface ControlOutcome {
  label: string;
  passed: boolean;
  detail: string;
}

function runControls(densityCeiling: number): ControlOutcome[] {
  const out: ControlOutcome[] = [];

  const clean = auditPuzzle(cleanControl());
  out.push({
    label: "нормальный пазл — проверка обязана промолчать",
    passed:
      clean.missing.length === 0 &&
      clean.undecided.length === 0 &&
      clean.density <= densityCeiling &&
      clean.longestOverMinSide <= 1,
    detail: `ненайденных ${clean.missing.length}, плотность ${(clean.density * 100).toFixed(1)}%, длиннейшее/сторона ${clean.longestOverMinSide.toFixed(2)}`,
  });

  const missing = auditPuzzle(missingWordControl());
  out.push({
    label: "подсаженное слово, которого нет в сетке — обязана поймать",
    passed: missing.missing.length === 1 && missing.missing[0] === "лиса",
    detail: `поймано: ${missing.missing.length ? missing.missing.join(", ") : "ничего"}`,
  });

  const overfull = auditPuzzle(overfullControl());
  out.push({
    label: "переполненная сетка — обязана поймать",
    passed: overfull.density > densityCeiling && overfull.impossibleByLength,
    detail: `плотность ${(overfull.density * 100).toFixed(1)}%, длиннейшее ${overfull.longestLength} букв при сетке ${overfull.rows}×${overfull.cols}`,
  });

  // Контроль гнутого поиска: тот же список на ★-правилах. «дом» в сетке
  // выше лежит по столбцу, «кот» — по строке; гнутый поиск обязан найти
  // оба и обязан НЕ найти подсаженное.
  const curvedClean = auditPuzzle({ ...cleanControl(), id: "control-curved", curved: true });
  const curvedMissing = auditPuzzle({ ...missingWordControl(), id: "control-curved-missing", curved: true });
  out.push({
    label: "★ (гнутый путь) — молчит на нормальном, ловит подсаженное",
    passed: curvedClean.missing.length === 0 && curvedMissing.missing.length === 1,
    detail: `нормальный: ${curvedClean.missing.length}, подсаженный: ${curvedMissing.missing.join(", ") || "ничего"}`,
  });

  return out;
}

/* ------------------------------------------------------------------ */

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function report(audits: PuzzleAudit[], densityCeiling: number): boolean {
  const broken = audits.filter((a) => a.missing.length > 0);
  const undecided = audits.filter((a) => a.undecided.length > 0);
  const dense = audits.filter((a) => a.density > densityCeiling);
  const tooLong = audits.filter((a) => a.longestOverMinSide > 1);
  const impossible = audits.filter((a) => a.impossibleByLength);

  console.log(`\nПазлов WORD_SEARCH: ${audits.length} (★/curved: ${audits.filter((a) => a.curved).length})`);
  console.log(`С ненайденными словами:        ${broken.length}`);
  console.log(`Не решено (упёрлось в предел): ${undecided.length}`);
  console.log(`Плотность выше ${pct(densityCeiling)}:        ${dense.length}`);
  console.log(`Длиннейшее слово > меньшей стороны: ${tooLong.length}`);
  console.log(`  из них длиннее и большей стороны (лечь не может вовсе): ${impossible.length}`);

  const byDensity = [...audits].sort((a, b) => b.density - a.density).slice(0, 10);
  console.log(`\nХудшие 10 по плотности:`);
  console.log(`  уровень/рунг        сетка   слов  букв  плотность  длиннейшее`);
  for (const a of byDensity) {
    console.log(
      `  ${`${a.level}/${a.sequence}`.padEnd(18)} ${`${a.rows}×${a.cols}`.padEnd(7)} ${String(a.wordCount).padEnd(5)} ${String(a.letters).padEnd(5)} ${pct(a.density).padEnd(10)} ${a.longestWord} (${a.longestLength})`,
    );
  }

  const byRatio = [...audits].sort((a, b) => b.longestOverMinSide - a.longestOverMinSide).slice(0, 10);
  console.log(`\nХудшие 10 по «длиннейшее слово ÷ меньшая сторона»:`);
  for (const a of byRatio) {
    console.log(
      `  ${`${a.level}/${a.sequence}`.padEnd(18)} ${`${a.rows}×${a.cols}`.padEnd(7)} ${a.longestWord} (${a.longestLength}) → ${a.longestOverMinSide.toFixed(2)}`,
    );
  }

  if (broken.length > 0) {
    console.log(`\nПазлы с ненайденными словами (все):`);
    for (const a of broken.slice(0, 50)) {
      console.log(`  ${a.level}/${a.sequence} (${a.id}) ${a.rows}×${a.cols}: ${a.missing.join(", ")}`);
    }
    if (broken.length > 50) console.log(`  … и ещё ${broken.length - 50}`);
  }
  if (undecided.length > 0) {
    console.log(`\nНе доказано ни в одну сторону (гнутый поиск упёрся в предел шагов):`);
    for (const a of undecided) console.log(`  ${a.level}/${a.sequence}: ${a.undecided.join(", ")}`);
  }

  return broken.length === 0 && undecided.length === 0;
}

async function main() {
  const densityCeiling = Number(arg("density") ?? DEFAULT_DENSITY_CEILING);
  const selfTestOnly = process.argv.includes("--self-test");

  console.log("Позитивный контроль:");
  const controls = runControls(densityCeiling);
  for (const c of controls) {
    console.log(`  ${c.passed ? "OK  " : "ПРОВАЛ"} ${c.label} — ${c.detail}`);
  }
  if (controls.some((c) => !c.passed)) {
    console.error("\nКонтроль не пройден — прогону по банку верить нельзя.");
    process.exitCode = 1;
    return;
  }
  if (selfTestOnly) {
    console.log("\nТолько контроль (--self-test), банк не читался.");
    return;
  }

  const adapter = new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const db = new PrismaClient({ adapter });
  try {
    const rows = await db.wordGamePuzzle.findMany({
      where: { type: "WORD_SEARCH" },
      select: { id: true, level: true, sequence: true, curved: true, gridData: true, words: true },
      orderBy: [{ level: "asc" }, { sequence: "asc" }],
    });
    if (rows.length === 0) {
      console.error("\nВ базе нет ни одного WORD_SEARCH — сравнивать нечего, это не «0 проблем».");
      process.exitCode = 1;
      return;
    }
    const parsed = rows.map((row) => ({ row, input: puzzleInputFromRow(row) }));
    const unreadable = parsed.filter((p) => p.input === null);
    if (unreadable.length > 0) {
      console.error(`\nСтрок с нечитаемым JSON: ${unreadable.length}`);
      for (const u of unreadable.slice(0, 20)) console.error(`  ${u.row.level}/${u.row.sequence} (${u.row.id})`);
    }
    const audits = parsed.flatMap((p) => (p.input ? [auditPuzzle(p.input)] : []));
    const ok = report(audits, densityCeiling);
    if (!ok || unreadable.length > 0) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
