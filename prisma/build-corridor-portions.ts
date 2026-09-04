/**
 * Раскатка коридора 7.85 ПО ПОРЦИЯМ, а не «всё или ничего». ТОЛЬКО
 * ЧТЕНИЕ: в базу не пишет ничего и никогда.
 *
 * Зачем отдельный скрипт рядом с build-density-manifest.ts. Тот отбирает
 * «худшие N» по тяжести density.ts и по построению берёт только класс
 * «разгрузка» (занятость выше медианы) и только ПРЯМЫЕ рунги. Здесь
 * задача другая: разложить ВЕСЬ банк на порции, каждую из которых можно
 * записать, посмотреть глазами и остановиться. Порции режутся по трём
 * признакам, и все три выбраны потому, что каждый из них меняет ЦЕНУ
 * порции, а не её размер:
 *
 *  · ДЕЛЕНИЕ НА ЧАСТИ — единственное, что создаёт новые строки, новые
 *    URL и двигает долю Premium. Смена размера доски не стоит ничего.
 *  · ДОСКА 18×18 — единственное, что заметно меняет ВИД игры на
 *    телефоне. Порция, где потолок стороны 16, визуально не рискует
 *    ничем: банк держит 1396 досок 16×16 уже сегодня.
 *  · РУНГ 1–10 НЕ-C1 — единственное, что видно анониму и Google
 *    (isFreeWordGamePuzzle). Набор URL в sitemap от записи не меняется
 *    (он выведен из констант), но `updatedAt` таких строк попадает в
 *    <lastmod>, то есть побайтово файл станет другим. Поэтому они —
 *    отдельная порция, а не примесь к остальным.
 *
 * ★-рунги (curved) в порции НЕ ВХОДЯТ вовсе, и это не решение вкуса:
 * redistribute-word-search.ts отказывается писать гнутый рунг, потому
 * что части собираются прямым укладчиком (buildWordSearch). planLayout
 * принимает {curved}, но использует его ТОЛЬКО для границ коридора —
 * укладка всё равно прямая. То есть план для ★ существует на бумаге и
 * молча превратил бы ★ в обычный филворд. Скрипт считает их отдельной
 * строкой отчёта и в порции не кладёт.
 *
 * Использование:
 *   npx tsx prisma/build-corridor-portions.ts
 *   npx tsx prisma/build-corridor-portions.ts --json=docs/…json
 *   npx tsx prisma/build-corridor-portions.ts --emit=1   # блок для DENSITY_SPLITS
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" npx tsx prisma/build-corridor-portions.ts
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";
import { auditPuzzle, puzzleInputFromRow, type PuzzleAudit } from "../src/lib/word-games/word-search-audit";
import { bankFingerprint } from "../src/lib/word-games/bank-fingerprint";
import { judge } from "../src/lib/word-games/quality";
import { planLayout } from "../src/lib/word-games/redistribute";
import { severity } from "../src/lib/word-games/density";
import { DENSITY_SPLITS } from "../src/lib/word-games/density-rungs";
import { isFreeWordGamePuzzle } from "../src/lib/word-games/free-tier";
import type { WordPlacement } from "../src/lib/word-games/types";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const JSON_OUT = arg("json");
const EMIT = arg("emit");
const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Ровно то, что решает isFreeWordGamePuzzle: эти рунги видит аноним и
 * Google, и только их `updatedAt` попадает в <lastmod> sitemap.xml. */
function inSitemap(level: string, sequence: number): boolean {
  return isFreeWordGamePuzzle({ type: "WORD_SEARCH", level, sequence });
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

interface Item {
  level: string;
  sequence: number;
  id: string;
  curved: boolean;
  premiumOnly: boolean;
  inSitemap: boolean;
  board: number;
  occupancy: number;
  maxOverlap: number;
  severity: number;
  sizes: number[];
  occupanciesAfter: number[];
  parts: number;
  newRows: number;
  portion: number | null;
  bucket: string;
  tailSequences: number[];
  words: string[];
}

const PORTIONS: { n: number; title: string; why: string; pick: (i: Item) => boolean }[] = [
  {
    n: 1,
    title: "смена размера, потолок стороны 16, вне sitemap",
    why: "ноль новых строк, ноль новых URL, доля Premium не двигается, ни одна доска не становится шире того, что банк держит сегодня",
    pick: (i) => i.parts === 1 && !i.sizes.includes(18) && !i.inSitemap,
  },
  {
    n: 2,
    title: "смена размера, доска становится 18×18, вне sitemap",
    why: "по-прежнему ноль новых строк и ноль URL, но вид игры на телефоне меняется — это первая порция, которую нужно смотреть глазами",
    pick: (i) => i.parts === 1 && i.sizes.includes(18) && !i.inSitemap,
  },
  {
    n: 3,
    title: "деление на части, потолок стороны 16, вне sitemap",
    why: "первые новые строки и URL, но без нового вида доски — цена и риск разведены",
    pick: (i) => i.parts > 1 && !i.sizes.includes(18) && !i.inSitemap,
  },
  {
    n: 4,
    title: "деление на части с доской 18×18, вне sitemap",
    why: "самая дорогая порция: почти все новые строки и всё падение доли Premium",
    pick: (i) => i.parts > 1 && i.sizes.includes(18) && !i.inSitemap,
  },
  {
    n: 5,
    title: "рунги 1–10 не-C1 — те, что видит аноним и Google",
    why: "единственная порция, после которой sitemap.xml перестаёт быть побайтово тем же файлом (<lastmod> строк, которые в нём есть)",
    pick: (i) => i.inSitemap,
  },
];

async function main() {
  const dbUrl = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
  const db = new PrismaClient({
    adapter: new PrismaLibSql({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN }),
  });
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
        `Банк: ${rows.length} строк WORD_SEARCH, отпечаток ${fingerprint.idsSha256.slice(0, 12)}…\n`,
    );

    const applied = new Set(DENSITY_SPLITS.filter((s) => s.applied).map((s) => `${s.level}/${s.sequence}`));
    const items: Item[] = [];
    const buckets = new Map<string, number>();
    const bump = (k: string) => buckets.set(k, (buckets.get(k) ?? 0) + 1);

    for (const row of rows) {
      const input = puzzleInputFromRow(row);
      if (!input) {
        console.error(`${row.level}/${row.sequence} (${row.id}): JSON не читается — прогон остановлен.`);
        process.exitCode = 1;
        return;
      }
      const audit: PuzzleAudit = auditPuzzle(input);
      const base = {
        level: row.level,
        sequence: row.sequence,
        id: row.id,
        curved: row.curved,
        premiumOnly: row.premiumOnly,
        inSitemap: inSitemap(row.level, row.sequence),
        board: audit.minSide,
        occupancy: Number(audit.occupancy.toFixed(4)),
        maxOverlap: audit.maxOverlap,
        severity: Number(severity(audit).toFixed(4)),
        words: (input.words as WordPlacement[]).map((w) => w.word),
      };
      if (judge(audit).ok) {
        bump("уже в коридоре и под потолком");
        continue;
      }
      if (row.curved) {
        // Считаем отдельно и НЕ кладём в порцию: см. шапку файла.
        bump("★ — прямой укладчик превратил бы её в другую игру");
        continue;
      }
      const words = (input.words as WordPlacement[]).map((w) => ({ word: w.word, clue: w.clue ?? "" }));
      const plan = planLayout(words, `redistribute-WORD_SEARCH-${row.level}-${row.sequence}`, { curved: false });
      if (!plan) {
        bump("уложить не удалось ни при каком наборе сторон");
        continue;
      }
      if (!plan.inCorridor) {
        bump("в коридор не приводится ни одним набором");
        continue;
      }
      if (applied.has(`${row.level}/${row.sequence}`)) {
        bump("уже разложен прошлым заходом");
        continue;
      }
      const item: Item = {
        ...base,
        sizes: plan.parts.map((p) => p.size),
        occupanciesAfter: plan.parts.map((p) => Number(p.occupancy.toFixed(4))),
        parts: plan.parts.length,
        newRows: plan.parts.length - 1,
        portion: null,
        bucket: "порция",
        tailSequences: [],
      };
      item.portion = PORTIONS.find((p) => p.pick(item))?.n ?? null;
      items.push(item);
    }

    /* ---- хвостовые номера: курсор на уровень, порции по порядку ---- */
    const cursor = new Map<string, number>();
    for (const level of LEVELS) {
      const seqs = rows.filter((r) => r.level === level).map((r) => r.sequence);
      cursor.set(level, seqs.length ? Math.max(...seqs) : 0);
    }
    const ordered = [...items].sort(
      (a, b) => (a.portion ?? 9) - (b.portion ?? 9) || a.level.localeCompare(b.level) || a.sequence - b.sequence,
    );
    for (const it of ordered) {
      let c = cursor.get(it.level)!;
      for (let k = 1; k < it.parts; k++) it.tailSequences.push(++c);
      cursor.set(it.level, c);
    }

    /* ---- что правило вообще делает с банком ---- */
    console.log("Что правило делает с банком (порядок — от «ничего не стоит» к «стоит дороже всего»):");
    for (const [k, v] of [...buckets.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(52)} ${String(v).padStart(5)}`);
    }
    console.log(`  ${"РАСКЛАДЫВАЕТСЯ ПО ПОРЦИЯМ".padEnd(52)} ${String(items.length).padStart(5)}`);

    /* ---- порции ---- */
    const premiumBefore = rows.filter((r) => r.premiumOnly).length;
    let bank = rows.length;
    let premium = premiumBefore;
    let boards18 = rows.filter((r) => {
      const input = puzzleInputFromRow(r as Row);
      return input ? auditPuzzle(input).minSide === 18 : false;
    }).length;
    console.log(
      `\nСтарт: банк ${bank}, платных ${premium} = ${pct(premium / bank)}, досок 18×18 ${boards18}.\n`,
    );
    console.log(
      "порц  n     новых  плат.  Δ18×18  новых URL  lastmod  банк   доля Premium  по уровням",
    );
    const summary: unknown[] = [];
    for (const p of PORTIONS) {
      const s = items.filter((i) => i.portion === p.n);
      const newRows = s.reduce((n, i) => n + i.newRows, 0);
      const premNew = s.reduce((n, i) => n + (i.premiumOnly ? i.newRows : 0), 0);
      const d18 = s.reduce((n, i) => n + i.sizes.filter((x) => x === 18).length - (i.board === 18 ? 1 : 0), 0);
      const lastmod = s.filter((i) => i.inSitemap).length * 2;
      bank += newRows;
      premium += premNew;
      boards18 += d18;
      console.log(
        `${String(p.n).padEnd(6)}${String(s.length).padEnd(6)}${String(newRows).padEnd(7)}${String(premNew).padEnd(7)}` +
          `${String(d18).padEnd(8)}${String(newRows * 2).padEnd(11)}${String(lastmod).padEnd(9)}${String(bank).padEnd(7)}` +
          `${pct(premium / bank).padEnd(14)}${LEVELS.map((l) => `${l}:${s.filter((i) => i.level === l).length}`).join(" ")}`,
      );
      summary.push({
        portion: p.n,
        title: p.title,
        why: p.why,
        rungs: s.length,
        newRows,
        premiumTails: premNew,
        delta18: d18,
        newUrls: newRows * 2,
        sitemapLastmodTouched: lastmod,
        bankAfter: bank,
        premiumShareAfter: Number((premium / bank).toFixed(4)),
        byLevel: Object.fromEntries(LEVELS.map((l) => [l, s.filter((i) => i.level === l).length])),
      });
    }
    console.log(
      `\nЕсли раскатать все пять: банк ${rows.length} → ${bank}, платных ${premiumBefore} → ${premium} ` +
        `(${pct(premiumBefore / rows.length)} → ${pct(premium / bank)}), досок 18×18 → ${boards18}.`,
    );

    if (EMIT) {
      const n = Number(EMIT);
      const s = ordered.filter((i) => i.portion === n);
      console.log(`\n// ---- порция ${n}: вставить в DENSITY_SPLITS (${s.length} рунгов) ----`);
      for (const i of s) {
        console.log(
          `  { level: "${i.level}", sequence: ${i.sequence}, parts: ${i.parts}, sizes: [${i.sizes.join(", ")}], tailSequences: [${i.tailSequences.join(", ")}] },`,
        );
      }
      console.log(`\n// --only=${s.map((i) => `${i.level}/${i.sequence}`).join(",")}`);
    }

    if (JSON_OUT) {
      writeFileSync(
        JSON_OUT,
        `${JSON.stringify(
          {
            source: dbUrl.startsWith("libsql://") ? new URL(dbUrl).host : dbUrl,
            bank: fingerprint,
            buckets: Object.fromEntries(buckets),
            totals: {
              puzzles: rows.length,
              premiumBefore,
              bankAfterAllPortions: bank,
              premiumAfterAllPortions: premium,
              boards18AfterAllPortions: boards18,
            },
            portions: summary,
            items: ordered,
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
