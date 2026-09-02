/**
 * Филворды как ИГРА, а не как метрика: распределение трёх величин по
 * всему банку и dry-run нового правила. ТОЛЬКО ЧТЕНИЕ, в базу не пишет
 * ничего и никогда.
 *
 * Три величины (все — по записанным координатам, как в
 * word-search-audit.ts):
 *
 *  · ЗАНЯТОСТЬ — доля клеток, которых касается хоть одно слово. Она же
 *    вероятность того, что случайно ткнутая клетка окажется частью слова.
 *  · ОТНОШЕНИЕ длиннейшего слова к меньшей стороне сетки. Слово, занявшее
 *    80% стороны, ложится «ровным рядом»: положить его почти некуда.
 *  · ДОЛЯ КЛЕТОК-ЗАПОЛНИТЕЛЕЙ — тех, которых не касается ни одно слово.
 *    Она печатается, но осей всё равно ДВЕ, а не три: заполнители — это
 *    ровно 1 − занятость, тождественно, и отдельной информации в них нет
 *    (то же замечание уже стоило одного мёртвого пункта в пороге, см.
 *    PROGRESS 7.77).
 *
 * Правило — src/lib/word-games/quality.ts, там же обоснование цифрами.
 * Оно ОТЧЁТНОЕ: этот скрипт ничего не гейтит и ничем не падает, кроме
 * собственных ошибок.
 *
 * Использование:
 *   npx tsx prisma/word-search-quality-report.ts                 # распределения
 *   npx tsx prisma/word-search-quality-report.ts --plan          # + dry-run правила
 *   npx tsx prisma/word-search-quality-report.ts --plan --count=40 --json=docs/…json
 *   npx tsx prisma/word-search-quality-report.ts --plan --twice  # доказательство детерминизма
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" npx tsx prisma/word-search-quality-report.ts --plan
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";
import { auditPuzzle, puzzleInputFromRow, type PuzzleAudit } from "../src/lib/word-games/word-search-audit";
import { bankFingerprint } from "../src/lib/word-games/bank-fingerprint";
import { BOARD_SIZES, corridorFor, judge, LONGEST_OVER_SIDE_LIMIT } from "../src/lib/word-games/quality";
import { planLayout } from "../src/lib/word-games/redistribute";
import { severity, worstFirst } from "../src/lib/word-games/density";
import type { WordPlacement } from "../src/lib/word-games/types";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const PLAN = process.argv.includes("--plan");
const TWICE = process.argv.includes("--twice");
const COUNT = Number(arg("count") ?? 40);
const JSON_OUT = arg("json");
const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const quantile = (values: number[], p: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};

/** Гистограмма по полосам ширины `step`, печатается одной строкой. */
function histogram(values: number[], step: number, max: number): string {
  const out: string[] = [];
  for (let lo = 0; lo < max - 1e-9; lo += step) {
    const n = values.filter((v) => v >= lo && v < lo + step).length;
    if (n > 0) out.push(`${(lo * 100).toFixed(0)}–${((lo + step) * 100).toFixed(0)}%:${n}`);
  }
  return out.join("  ");
}

interface Row {
  id: string;
  level: string;
  sequence: number;
  curved: boolean;
  premiumOnly: boolean;
  gridData: string;
  words: string;
}

function group(label: string, audits: PuzzleAudit[]) {
  if (audits.length === 0) return;
  const occ = audits.map((a) => a.occupancy);
  const ratio = audits.map((a) => a.longestOverMinSide);
  const zones = { "разрежён": 0, "коридор": 0, "перегружен": 0 };
  let longWord = 0;
  for (const a of audits) {
    const v = judge(a);
    zones[v.zone] += 1;
    if (v.longWord) longWord += 1;
  }
  console.log(
    `\n── ${label} (n=${audits.length})\n` +
      `   занятость   мед ${pct(quantile(occ, 0.5))}  p10 ${pct(quantile(occ, 0.1))}  p90 ${pct(quantile(occ, 0.9))}` +
      `   заполнители мед ${pct(1 - quantile(occ, 0.5))}\n` +
      `   ${histogram(occ, 0.05, 1)}\n` +
      `   длиннейшее/сторона  мед ${quantile(ratio, 0.5).toFixed(2)}  p90 ${quantile(ratio, 0.9).toFixed(2)}  ` +
      `выше потолка ${LONGEST_OVER_SIDE_LIMIT}: ${longWord} (${pct(longWord / audits.length)})\n` +
      `   зоны: разрежён ${zones["разрежён"]} · коридор ${zones["коридор"]} · перегружен ${zones["перегружен"]}`,
  );
}

interface PlanRow {
  level: string;
  sequence: number;
  id: string;
  curved: boolean;
  premiumOnly: boolean;
  zone: string;
  longWord: boolean;
  occupancy: number;
  maxOverlap: number;
  severity: number;
  board: number;
  words: string[];
  /** Что предлагает новое правило. */
  plan: { sizes: number[]; occupancies: number[]; inCorridor: boolean } | null;
  /** Сколько НОВЫХ строк потребует этот пазл (частей минус одна). */
  newRows: number;
  action: "оставить" | "сменить размер" | "разложить" | "в коридор не приводится" | "не уложилось";
}

function planFor(row: Row, audit: PuzzleAudit): PlanRow {
  const input = puzzleInputFromRow(row)!;
  const words = (input.words as WordPlacement[]).map((w) => ({ word: w.word, clue: w.clue ?? "" }));
  const verdict = judge(audit);
  const base: Omit<PlanRow, "plan" | "newRows" | "action"> = {
    level: row.level,
    sequence: row.sequence,
    id: row.id,
    curved: row.curved,
    premiumOnly: row.premiumOnly,
    zone: verdict.zone,
    longWord: verdict.longWord,
    occupancy: Number(audit.occupancy.toFixed(4)),
    maxOverlap: audit.maxOverlap,
    severity: Number(severity(audit).toFixed(4)),
    board: audit.minSide,
    words: words.map((w) => w.word),
  };
  if (verdict.ok) return { ...base, plan: null, newRows: 0, action: "оставить" };

  const plan = planLayout(words, `redistribute-WORD_SEARCH-${row.level}-${row.sequence}`, {
    curved: row.curved,
  });
  if (!plan) return { ...base, plan: null, newRows: 0, action: "не уложилось" };
  const shape = {
    sizes: plan.parts.map((p) => p.size),
    occupancies: plan.parts.map((p) => Number(p.occupancy.toFixed(4))),
    inCorridor: plan.inCorridor,
  };
  const newRows = plan.parts.length - 1;
  const action: PlanRow["action"] = !plan.inCorridor
    ? "в коридор не приводится"
    : newRows === 0
      ? "сменить размер"
      : "разложить";
  return { ...base, plan: shape, newRows, action };
}

async function main() {
  const dbUrl = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaLibSql({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN });
  const db = new PrismaClient({ adapter });
  try {
    const rows = (await db.wordGamePuzzle.findMany({
      where: { type: "WORD_SEARCH" },
      select: { id: true, level: true, sequence: true, curved: true, premiumOnly: true, gridData: true, words: true },
      orderBy: [{ level: "asc" }, { sequence: "asc" }],
    })) as Row[];
    if (rows.length === 0) {
      console.error("В базе нет ни одного WORD_SEARCH — считать нечего.");
      process.exitCode = 1;
      return;
    }
    const fingerprint = bankFingerprint(rows);
    console.log(
      `Источник: ${dbUrl.startsWith("libsql://") ? new URL(dbUrl).host : dbUrl}\n` +
        `Банк: ${rows.length} строк WORD_SEARCH, отпечаток ${fingerprint.idsSha256.slice(0, 12)}…`,
    );
    const audits: PuzzleAudit[] = [];
    for (const row of rows) {
      const input = puzzleInputFromRow(row);
      if (!input) {
        console.error(`${row.level}/${row.sequence} (${row.id}): JSON не читается — прогон остановлен.`);
        process.exitCode = 1;
        return;
      }
      audits.push(auditPuzzle(input));
    }

    const corridor = corridorFor(false);
    const curvedCorridor = corridorFor(true);
    console.log(
      `\nПравило (src/lib/word-games/quality.ts): коридор занятости ` +
        `${pct(corridor.floor)}–${pct(corridor.ceiling)} для прямых и ` +
        `${pct(curvedCorridor.floor)}–${pct(curvedCorridor.ceiling)} для ★; ` +
        `потолок длиннейшего слова к стороне ${LONGEST_OVER_SIDE_LIMIT}.`,
    );
    console.log(
      "Заполнители = 1 − занятость тождественно, поэтому осей ДВЕ: занятость и длина слова.",
    );

    group("ВЕСЬ БАНК", audits);
    for (const level of LEVELS) group(`уровень ${level}`, audits.filter((a) => a.level === level));
    for (const size of BOARD_SIZES) group(`сетка ${size}×${size}`, audits.filter((a) => a.minSide === size));
    group("★ (гнутые)", audits.filter((a) => a.curved));
    group("прямые", audits.filter((a) => !a.curved));

    /* ---- сводка по зонам ---- */
    const verdicts = audits.map((a) => ({ a, v: judge(a) }));
    const inside = verdicts.filter((x) => x.v.ok).length;
    console.log(
      `\nИТОГО: в коридоре и под потолком ${inside} из ${audits.length} (${pct(inside / audits.length)}); ` +
        `разрежённых ${verdicts.filter((x) => x.v.zone === "разрежён").length}, ` +
        `перегруженных ${verdicts.filter((x) => x.v.zone === "перегружен").length}, ` +
        `со слишком длинным словом ${verdicts.filter((x) => x.v.longWord).length}.`,
    );

    if (!PLAN) return;

    /* ---- dry-run правила по всему банку ---- */
    const t0 = Date.now();
    const byId = new Map(rows.map((r) => [r.id, r]));
    const plans: PlanRow[] = audits.map((a) => planFor(byId.get(a.id)!, a));
    console.log(`\n=== DRY-RUN по всему банку (${plans.length} пазлов, ${((Date.now() - t0) / 1000).toFixed(1)} с) ===`);
    const byAction = new Map<string, PlanRow[]>();
    for (const p of plans) byAction.set(p.action, [...(byAction.get(p.action) ?? []), p]);
    for (const [action, list] of [...byAction.entries()].sort((x, y) => y[1].length - x[1].length)) {
      console.log(`  ${action.padEnd(26)} ${String(list.length).padStart(5)}  новых строк ${list.reduce((n, p) => n + p.newRows, 0)}`);
    }
    const newRows = plans.reduce((n, p) => n + p.newRows, 0);
    console.log(`  ВСЕГО новых строк, если применить ко всему банку: ${newRows}`);

    /* ---- доля Premium ---- */
    const premiumBefore = rows.filter((r) => r.premiumOnly).length;
    const premiumNew = plans.reduce((n, p) => n + (p.premiumOnly ? p.newRows : 0), 0);
    console.log(
      `  доля Premium: ${premiumBefore}/${rows.length} = ${pct(premiumBefore / rows.length)} → ` +
        `${premiumBefore + premiumNew}/${rows.length + newRows} = ${pct((premiumBefore + premiumNew) / (rows.length + newRows))} ` +
        `(хвост наследует платность источника)`,
    );

    /* ---- размеры досок до и после ---- */
    const sizeBefore = new Map<number, number>();
    const sizeAfter = new Map<number, number>();
    for (const p of plans) {
      sizeBefore.set(p.board, (sizeBefore.get(p.board) ?? 0) + 1);
      const sizes = p.plan ? p.plan.sizes : [p.board];
      for (const s of sizes) sizeAfter.set(s, (sizeAfter.get(s) ?? 0) + 1);
    }
    console.log(
      `  размеры досок было:  ${[...sizeBefore].sort((x, y) => x[0] - y[0]).map(([s, n]) => `${s}:${n}`).join(" ")}\n` +
        `  размеры досок стало: ${[...sizeAfter].sort((x, y) => x[0] - y[0]).map(([s, n]) => `${s}:${n}`).join(" ")}`,
    );

    /* ---- худшие COUNT, порядком из density.ts ---- */
    const order = worstFirst(audits);
    const worst = order.filter((a) => !judge(a).ok).slice(0, COUNT);
    console.log(`\n=== ХУДШИЕ ${worst.length} по тяжести (порядок density.ts) ===`);
    console.log("№  рунг        занято  клетка  тяжесть  доска  →  план (стороны / занятость)   новых строк");
    const chosen: PlanRow[] = [];
    worst.forEach((a, i) => {
      const p = plans.find((x) => x.id === a.id)!;
      chosen.push(p);
      const planText = p.plan
        ? `${p.plan.sizes.join("+")}  ${p.plan.occupancies.map((o) => pct(o)).join(" / ")}${p.plan.inCorridor ? "" : "  ⚠ вне коридора"}`
        : "—";
      console.log(
        `${String(i + 1).padStart(2)} ${`${a.level}/${a.sequence}`.padEnd(11)} ${pct(a.occupancy).padEnd(7)} ` +
          `${String(a.maxOverlap).padEnd(7)} ${severity(a).toFixed(3).padEnd(8)} ${`${a.minSide}×${a.minSide}`.padEnd(6)} → ${planText.padEnd(38)} ${p.newRows}`,
      );
    });

    /* ---- готовый блок манифеста ---- */
    console.log("\n// ---- вставить в DENSITY_SPLITS (хвостовые номера считает build-density-manifest) ----");

    if (TWICE) {
      const again = audits.map((a) => planFor(byId.get(a.id)!, a));
      const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
      const same = hash(plans) === hash(again);
      console.log(
        `\nДЕТЕРМИНИЗМ: два прогона планировщика подряд по ${plans.length} пазлам — ` +
          `${same ? "ПОБАЙТОВО ОДНО И ТО ЖЕ" : "РАСХОДЯТСЯ"}\n  sha256 #1 ${hash(plans)}\n  sha256 #2 ${hash(again)}`,
      );
      if (!same) process.exitCode = 1;
    }

    if (JSON_OUT) {
      writeFileSync(
        JSON_OUT,
        `${JSON.stringify(
          {
            source: dbUrl.startsWith("libsql://") ? new URL(dbUrl).host : dbUrl,
            bank: fingerprint,
            rule: { corridor, curvedCorridor, longestOverSideLimit: LONGEST_OVER_SIDE_LIMIT },
            totals: {
              puzzles: rows.length,
              ok: inside,
              newRowsIfWholeBank: newRows,
              premiumBefore,
              premiumAfter: premiumBefore + premiumNew,
            },
            worst: chosen,
            all: plans,
          },
          null,
          1,
        )}\n`,
        "utf8",
      );
      console.log(`\nЗаписано: ${JSON_OUT}`);
    }
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
