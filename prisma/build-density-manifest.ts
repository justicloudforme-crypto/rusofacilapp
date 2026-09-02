/**
 * Манифест разгрузки, посчитанный ПО ТОЙ БАЗЕ, против которой запущен —
 * а не взятый из прошлого замера. ТОЛЬКО ЧТЕНИЕ, ничего не пишет в базу.
 *
 * Зачем он есть. Манифест `src/lib/word-games/density-rungs.ts` был
 * посчитан по локальной копии банка, а применять его собирались к
 * проду, где под теми же номерами лежат другие пазлы. Ручной пересчёт
 * «двадцати худших» — это ровно то место, где такая подмена и живёт,
 * поэтому пересчёт делается скриптом и печатает всё, на чём основан
 * выбор: медиану, распределение по уровням, класс каждого рунга и
 * ЧИСЛО ЧАСТЕЙ, посчитанное укладкой, а не переписанное из старого
 * манифеста (в прошлый раз 5 рунгов из 20 требовали другого числа).
 *
 * Правило отбора — src/lib/word-games/rung-class.ts. Коротко: занятость
 * выше медианы банка → разгрузка; перекрытие ≥3 при занятости не выше
 * медианы → класс размещения (потолок в tryPlaceWord), в разгрузку не
 * берётся, его место занимает следующий по тяжести.
 *
 * Использование:
 *   npx tsx prisma/build-density-manifest.ts
 *   npx tsx prisma/build-density-manifest.ts --count=20 --explain=C1/114,C1/68
 *   npx tsx prisma/build-density-manifest.ts --json=docs/…json
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" \
 *     npx tsx prisma/build-density-manifest.ts
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";
import { auditPuzzle, puzzleInputFromRow, type PuzzleAudit } from "../src/lib/word-games/word-search-audit";
import { exceedsThreshold, severity, worstFirst } from "../src/lib/word-games/density";
import { medianOccupancy, selectSplits, classifyRung, type RungClass } from "../src/lib/word-games/rung-class";
import { boardSize, boardSizeMismatches, planLayout } from "../src/lib/word-games/redistribute";
import { bankFingerprint } from "../src/lib/word-games/bank-fingerprint";
import { DENSITY_SPLITS } from "../src/lib/word-games/density-rungs";
import type { WordPlacement } from "../src/lib/word-games/types";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

const COUNT = Number(arg("count") ?? 20);
const JSON_OUT = arg("json");
const EXPLAIN = (arg("explain") ?? "C1/114,C1/68,B2/141,B1/400").split(",").map((s) => s.trim()).filter(Boolean);
const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

async function main() {
  const dbUrl = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaLibSql({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN });
  const db = new PrismaClient({ adapter });
  try {
    const rows = await db.wordGamePuzzle.findMany({
      where: { type: "WORD_SEARCH" },
      select: { id: true, level: true, sequence: true, curved: true, gridData: true, words: true },
      orderBy: [{ level: "asc" }, { sequence: "asc" }],
    });
    if (rows.length === 0) {
      console.error("В базе нет ни одного WORD_SEARCH — считать нечего.");
      process.exitCode = 1;
      return;
    }
    const fingerprint = bankFingerprint(rows);
    console.log(`Банк: ${rows.length} строк WORD_SEARCH, отпечаток ${fingerprint.idsSha256.slice(0, 12)}…`);
    console.log(`Источник: ${dbUrl.startsWith("libsql://") ? new URL(dbUrl).host : dbUrl}\n`);

    const byKey = new Map<string, (typeof rows)[number]>();
    const audits: PuzzleAudit[] = [];
    for (const row of rows) {
      const input = puzzleInputFromRow(row);
      if (!input) {
        console.error(`${row.level}/${row.sequence} (${row.id}): JSON не читается — прогон остановлен.`);
        process.exitCode = 1;
        return;
      }
      byKey.set(`${row.level}/${row.sequence}`, row);
      audits.push(auditPuzzle(input));
    }

    /* ---- распределение по уровням ---- */
    const median = medianOccupancy(audits);
    console.log(`Медиана занятости по всему банку: ${pct(median)}\n`);
    console.log("Уровень   n     занято ср.  занято мед.  >порога   1 / 2 / 3 / 4+ слов на клетке");
    for (const level of LEVELS) {
      const g = audits.filter((a) => a.level === level);
      if (g.length === 0) continue;
      const mean = g.reduce((s, a) => s + a.occupancy, 0) / g.length;
      const hist = [1, 2, 3, 4].map((n) => g.filter((a) => (n === 4 ? a.maxOverlap >= 4 : a.maxOverlap === n)).length);
      console.log(
        `  ${level}    ${String(g.length).padEnd(6)}${pct(mean).padEnd(12)}${pct(medianOccupancy(g)).padEnd(13)}` +
          `${String(g.filter(exceedsThreshold).length).padEnd(10)}${hist.join(" / ")}`,
      );
    }
    const allHist = [1, 2, 3, 4].map((n) => audits.filter((a) => (n === 4 ? a.maxOverlap >= 4 : a.maxOverlap === n)).length);
    console.log(
      `  всего  ${String(audits.length).padEnd(6)}${pct(audits.reduce((s, a) => s + a.occupancy, 0) / audits.length).padEnd(12)}` +
        `${pct(median).padEnd(13)}${String(audits.filter(exceedsThreshold).length).padEnd(10)}${allHist.join(" / ")}`,
    );

    /* ---- отбор ---- */
    // Рунг берётся в манифест, только если новое правило действительно
    // приводит его в коридор (quality.ts). Не приводит — он не «плохо
    // разложится», он не разложится вовсе, и место обязан занять
    // следующий по тяжести. План считается здесь один раз и переиспользуется ниже.
    const planCache = new Map<string, ReturnType<typeof planLayout>>();
    const planOf = (a: PuzzleAudit) => {
      const key = `${a.level}/${a.sequence}`;
      if (!planCache.has(key)) {
        const row = byKey.get(key)!;
        const input = puzzleInputFromRow(row)!;
        const words = (input.words as WordPlacement[]).map((w) => ({ word: w.word, clue: w.clue ?? "" }));
        planCache.set(key, planLayout(words, `redistribute-WORD_SEARCH-${a.level}-${a.sequence}`, { curved: row.curved }));
      }
      return planCache.get(key)!;
    };
    const applied = new Set(
      DENSITY_SPLITS.filter((s) => s.applied).map((s) => `${s.level}/${s.sequence}`),
    );
    const selection = selectSplits(audits, COUNT, (a) => {
      if (applied.has(`${a.level}/${a.sequence}`)) return false;
      if (byKey.get(`${a.level}/${a.sequence}`)!.curved) return false;
      const plan = planOf(a);
      return Boolean(plan?.inCorridor);
    });
    console.log(`\nОтбор: ${selection.chosen.length} рунгов класса «разгрузка», вытеснено ${selection.skipped.length}.\n`);

    /* ---- число частей и хвостовые номера — считаются, не берутся ---- */
    const tailCursor = new Map<string, number>();
    for (const level of LEVELS) {
      const seqs = rows.filter((r) => r.level === level).map((r) => r.sequence);
      tailCursor.set(level, seqs.length ? Math.max(...seqs) : 0);
    }

    interface Entry {
      level: string;
      sequence: number;
      klass: RungClass;
      rank: number;
      occupancy: number;
      maxOverlap: number;
      severity: number;
      board: string;
      parts: number | null;
      /** Стороны, ВЫБРАННЫЕ планировщиком, по одной на часть. Первая —
       * сторона строки-источника (её доска может смениться), остальные —
       * хвостовых строк. */
      sizes: number[];
      tailSequences: number[];
      note: string;
      /** Id строки-источника и её слова НА МОМЕНТ ЗАМЕРА, по порядку.
       * Сверка перед записью (prisma/verify-density-rungs.ts) сравнивает
       * их с тем, что лежит в базе прямо сейчас. Сравнивать слова с
       * локальной копией больше нельзя: это другой банк. */
      rowId: string;
      words: string[];
    }
    const manifest: Entry[] = [];
    for (const c of selection.chosen) {
      const a = c.audit;
      const row = byKey.get(`${a.level}/${a.sequence}`)!;
      const input = puzzleInputFromRow(row)!;
      const source = boardSize(input.grid);
      const words = (input.words as WordPlacement[]).map((w) => ({ word: w.word, clue: w.clue ?? "" }));
      // Размер доски НЕ наследуется у источника: планировщик выбирает
      // сторону под длину слов и целевую занятость (quality.ts). Поэтому
      // здесь planLayout, а не «разложить на той же стороне».
      const split = planOf(a);
      let note = "";
      if (!split) note = "уложить не удалось ни при каком наборе сторон";
      else {
        if (!split.inCorridor) note = "в коридор не приводится — лучший достижимый план";
        const bad = boardSizeMismatches(split.parts.map((p) => p.size), split.parts);
        if (bad.length > 0) note = `${note ? `${note}; ` : ""}размер доски: ${bad.join("; ")}`;
      }
      const parts = split ? split.parts.length : null;
      const sizes = split ? split.parts.map((p) => p.size) : [];
      const tails: number[] = [];
      if (parts) {
        let cursor = tailCursor.get(a.level)!;
        for (let i = 1; i < parts; i++) tails.push(++cursor);
        tailCursor.set(a.level, cursor);
      }
      manifest.push({
        level: a.level,
        sequence: a.sequence,
        klass: c.klass,
        rank: c.rank,
        occupancy: Number(a.occupancy.toFixed(4)),
        maxOverlap: a.maxOverlap,
        severity: Number(c.severity.toFixed(4)),
        board: `${source.rows}×${source.cols}`,
        parts,
        sizes,
        tailSequences: tails,
        note,
        rowId: row.id,
        words: words.map((w) => w.word),
      });
    }

    console.log("№  рунг        ранг  доска   слов  занято  клетка  тяжесть  частей  стороны  хвосты");
    manifest.forEach((m, i) => {
      const a = selection.chosen[i].audit;
      console.log(
        `${String(i + 1).padStart(2)} ${`${m.level}/${m.sequence}`.padEnd(11)} ${String(m.rank).padEnd(5)} ` +
          `${m.board.padEnd(7)} ${String(a.wordCount).padEnd(5)} ${pct(m.occupancy).padEnd(7)} ${String(m.maxOverlap).padEnd(7)} ` +
          `${m.severity.toFixed(3).padEnd(8)} ${String(m.parts ?? "—").padEnd(7)} ${(m.sizes.join("+") || "—").padEnd(8)} ${m.tailSequences.join(", ") || "—"}${m.note ? `  ⚠ ${m.note}` : ""}`,
      );
    });

    if (selection.rejected.length > 0) {
      console.log("\nОтвергнуты правилом (в коридор не приводятся или уже разложены — их места заняли следующие):");
      for (const r of selection.rejected) {
        const plan = planOf(r.audit);
        const why = applied.has(`${r.audit.level}/${r.audit.sequence}`)
          ? "уже разложен"
          : !plan
            ? "уложить не удалось"
            : `лучший достижимый ${plan.parts.map((p) => `${p.size}×${p.size} ${pct(p.occupancy)}`).join(" + ")}`;
        console.log(
          `  ранг ${String(r.rank).padStart(3)}  ${`${r.audit.level}/${r.audit.sequence}`.padEnd(11)} занято ${pct(r.audit.occupancy)} — ${why}`,
        );
      }
    }

    if (selection.skipped.length > 0) {
      console.log("\nВытеснены классом (в разгрузку не идут):");
      for (const s of selection.skipped) {
        console.log(
          `  ранг ${String(s.rank).padStart(3)}  ${`${s.audit.level}/${s.audit.sequence}`.padEnd(11)} ` +
            `занято ${pct(s.audit.occupancy)} (медиана ${pct(selection.median)}), слов на клетку ${s.audit.maxOverlap} — класс «${s.klass}»`,
        );
      }
    }

    /* ---- отдельно названные рунги ---- */
    if (EXPLAIN.length > 0) {
      console.log("\nКлассификация названных рунгов:");
      const order = worstFirst(audits);
      for (const name of EXPLAIN) {
        const [level, seqStr] = name.split("/");
        const a = audits.find((x) => x.level === level && x.sequence === Number(seqStr));
        if (!a) {
          console.log(`  ${name}: такого рунга в этой базе нет`);
          continue;
        }
        const klass = classifyRung(a, selection.median);
        const rank = order.findIndex((x) => x.id === a.id) + 1;
        const taken = manifest.some((m) => m.level === a.level && m.sequence === a.sequence);
        console.log(
          `  ${name.padEnd(9)} ранг ${String(rank).padStart(4)}  занято ${pct(a.occupancy).padEnd(7)} ` +
            `(медиана ${pct(selection.median)})  слов на клетку ${a.maxOverlap}  тяжесть ${severity(a).toFixed(3)}  ` +
            `→ «${klass}», ${taken ? "В ДВАДЦАТКЕ" : "в двадцатку не идёт"}`,
        );
      }
    }

    /* ---- готовый блок для density-rungs.ts ---- */
    console.log("\n// ---- вставить в DENSITY_SPLITS ----");
    for (const m of manifest) {
      if (!m.parts) continue;
      console.log(
        `  { level: "${m.level}", sequence: ${m.sequence}, parts: ${m.parts}, sizes: [${m.sizes.join(", ")}], tailSequences: [${m.tailSequences.join(", ")}] },`,
      );
    }

    if (JSON_OUT) {
      writeFileSync(
        JSON_OUT,
        `${JSON.stringify({ source: dbUrl.startsWith("libsql://") ? new URL(dbUrl).host : dbUrl, bank: fingerprint, median, manifest, skipped: selection.skipped.map((s) => ({ level: s.audit.level, sequence: s.audit.sequence, rank: s.rank, occupancy: Number(s.audit.occupancy.toFixed(4)), maxOverlap: s.audit.maxOverlap, klass: s.klass })) }, null, 1)}\n`,
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
