/**
 * СВЕРКА ПЕРЕД ЗАПИСЬЮ. Ничего не пишет и писать не умеет.
 *
 * Разгрузка (7.78, 7.80) применяется к боевой базе, которую этот заход
 * видит впервые. Манифест `src/lib/word-games/density-rungs.ts` и снимок
 * `docs/word-search-baseline-2026-09-01.json` сняты с ЛОКАЛЬНОЙ копии
 * банка, а расхождение локальной копии с продом в этом проекте —
 * известный, уже случавшийся класс (PROGRESS.md, правило №7). Поэтому
 * прежде чем `redistribute-word-search.ts` тронет прод, надо доказать,
 * что прод — та же база, для которой манифест считался.
 *
 * Что сверяется по каждому из 20 рунгов манифеста:
 *   · строка существует;
 *   · её занятость и максимум слов на клетку совпадают со снимком
 *     (то есть рунг ещё НЕ разгружен и не изменился с 01.09.2026);
 *   · её список слов совпадает ПОЭЛЕМЕНТНО со списком в локальной копии
 *     (--words-from=file:./dev.db), если он передан. Локальная копия
 *     может быть УЖЕ разгружена — тогда слова рунга лежат в нём и в его
 *     хвостах, — поэтому сравнивается объединение источника с хвостами,
 *     а не одна строка: иначе разгруженная локальная копия дала бы
 *     расхождение на ровном месте;
 *   · рунг платный (sequence за пределом бесплатного лимита).
 *
 * И по каждому из 24 хвостовых номеров: в базе его нет вовсе — иначе
 * лестница уровня уже выросла и манифест разошёлся с базой.
 *
 * Плюс лестница каждого затронутого уровня печатается как есть: сколько
 * строк, какой максимум, где дыры.
 *
 * Использование:
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" \
 *     npx tsx prisma/verify-density-rungs.ts
 *   … --words-from=file:./dev.db      # ещё и поэлементная сверка слов
 *   … --round=1 | --round=2           # только один круг
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";
import {
  DENSITY_SPLITS,
  densityLevels,
  densityTails,
  ladderGaps,
  type DensitySplit,
} from "../src/lib/word-games/density-rungs";
import { auditPuzzle, puzzleInputFromRow } from "../src/lib/word-games/word-search-audit";
import { WORD_GAME_FREE_RUNGS_PER_LEVEL } from "../src/lib/word-games/free-tier";
import { readFileSync } from "node:fs";

const BASELINE = "docs/word-search-baseline-2026-09-01.json";
const ROUND_SIZE = 10;

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

/** Круг — это просто половина манифеста: первые десять записей и вторые
 * десять. Порядок в файле и есть порядок применения (7.80). */
export function roundOf(splits: readonly DensitySplit[], round: 1 | 2): DensitySplit[] {
  return round === 1 ? splits.slice(0, ROUND_SIZE) : splits.slice(ROUND_SIZE, ROUND_SIZE * 2);
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function client(url: string, authToken?: string) {
  return new PrismaClient({ adapter: new PrismaLibSql({ url, authToken }) });
}

async function main() {
  const roundArg = arg("round");
  const round = roundArg ? (Number(roundArg) as 1 | 2) : null;
  const chosen = round ? roundOf(DENSITY_SPLITS, round) : [...DENSITY_SPLITS];
  const wordsFrom = arg("words-from");

  const prodUrl = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
  const db = client(prodUrl, process.env.TURSO_AUTH_TOKEN);
  const local = wordsFrom ? client(wordsFrom) : null;

  const baseline: Record<string, { occupancy: number; maxOverlap: number }> = JSON.parse(
    readFileSync(BASELINE, "utf8"),
  );

  let problems = 0;
  const complain = (msg: string) => {
    problems += 1;
    console.error(`  ✗ ${msg}`);
  };

  try {
    console.log(
      `База: ${prodUrl.replace(/^(libsql:\/\/[^.]{0,8}).*$/, "$1…")}${
        wordsFrom ? `, слова сверяются с ${wordsFrom}` : ", слова НЕ сверяются (нет --words-from=)"
      }`,
    );
    console.log(`Рунгов к сверке: ${chosen.length}${round ? ` (круг ${round})` : " (весь манифест)"}\n`);

    for (const split of chosen) {
      const key = `WORD_SEARCH/${split.level}/${split.sequence}`;
      const row = await db.wordGamePuzzle.findUnique({
        where: {
          type_level_sequence: { type: "WORD_SEARCH", level: split.level, sequence: split.sequence },
        },
      });
      if (!row) {
        complain(`${key}: строки на проде НЕТ.`);
        continue;
      }
      const input = puzzleInputFromRow(row);
      if (!input) {
        complain(`${key}: JSON строки не читается.`);
        continue;
      }
      const a = auditPuzzle(input);
      const want = baseline[key];
      const words = input.words.map((w) => w.word).sort();

      const notes: string[] = [];
      if (!want) {
        complain(`${key}: в снимке ${BASELINE} такого ключа нет.`);
      } else {
        if (Math.abs(a.occupancy - want.occupancy) > 1e-9) {
          complain(
            `${key}: занятость на проде ${pct(a.occupancy)}, в снимке ${pct(want.occupancy)}.`,
          );
        }
        if (a.maxOverlap !== want.maxOverlap) {
          complain(`${key}: слов на клетку на проде ${a.maxOverlap}, в снимке ${want.maxOverlap}.`);
        }
      }
      if (split.sequence <= WORD_GAME_FREE_RUNGS_PER_LEVEL) {
        complain(`${key}: это БЕСПЛАТНЫЙ рунг — манифест не имеет права его трогать.`);
      }
      if (a.missing.length > 0) {
        complain(`${key}: солвер не находит в сетке ${a.missing.length} слов: ${a.missing.join(", ")}`);
      }

      if (local) {
        const lrow = await local.wordGamePuzzle.findUnique({
          where: {
            type_level_sequence: { type: "WORD_SEARCH", level: split.level, sequence: split.sequence },
          },
        });
        const linput = lrow ? puzzleInputFromRow(lrow) : null;
        if (!linput) {
          complain(`${key}: в локальной копии строки нет — сверить слова не с чем.`);
        } else {
          const lwords = [...linput.words.map((w) => w.word)];
          // Локальная копия могла быть разгружена раньше прода: тогда часть
          // слов рунга живёт в его хвостовых строках. Их надо добрать,
          // иначе «разошлось» скажет не про базы, а про порядок прогонов.
          let tailsSeen = 0;
          for (const seq of split.tailSequences) {
            const trow = await local.wordGamePuzzle.findUnique({
              where: { type_level_sequence: { type: "WORD_SEARCH", level: split.level, sequence: seq } },
            });
            const tinput = trow ? puzzleInputFromRow(trow) : null;
            if (tinput) {
              tailsSeen += 1;
              lwords.push(...tinput.words.map((w) => w.word));
            }
          }
          if (tailsSeen > 0) {
            notes.push(`локально рунг уже разгружен, слова собраны из ${tailsSeen + 1} строк`);
          }
          lwords.sort();
          const lost = lwords.filter((w) => !words.includes(w));
          const extra = words.filter((w) => !lwords.includes(w));
          if (lost.length || extra.length) {
            complain(
              `${key}: набор слов разошёлся. Есть локально и нет на проде: ${lost.join(", ") || "—"}; ` +
                `есть на проде и нет локально: ${extra.join(", ") || "—"}`,
            );
          } else {
            notes.push(`слова ${lwords.length}/${lwords.length} совпали поэлементно`);
          }
        }
      }

      console.log(
        `  ✓ ${key}: ${a.wordCount} слов, занято ${pct(a.occupancy)}, слов на клетку ${a.maxOverlap}` +
          (notes.length ? `, ${notes.join(", ")}` : ""),
      );
    }

    console.log("\nХвостовые номера — обязаны быть свободны:");
    const tails = chosen.flatMap((s) => s.tailSequences.map((seq) => ({ level: s.level, seq })));
    for (const { level, seq } of tails) {
      const existing = await db.wordGamePuzzle.findUnique({
        where: { type_level_sequence: { type: "WORD_SEARCH", level, sequence: seq } },
      });
      if (existing) complain(`WORD_SEARCH/${level}/${seq}: номер УЖЕ занят строкой id ${existing.id}.`);
    }
    console.log(`  ${tails.length} номеров проверено: ${tails.map((t) => `${t.level}/${t.seq}`).join(", ")}`);

    console.log("\nЛестницы WORD_SEARCH на этой базе:");
    for (const level of densityLevels()) {
      const rows = await db.wordGamePuzzle.findMany({
        where: { type: "WORD_SEARCH", level },
        select: { sequence: true },
      });
      const existing = rows.map((r) => r.sequence);
      const nowGaps = ladderGaps(existing, []);
      const afterGaps = ladderGaps(existing, densityTails(level));
      console.log(
        `  ${level}: ${rows.length} строк, максимум ${Math.max(0, ...existing)}, ` +
          `дыр сейчас ${nowGaps.length ? nowGaps.join(", ") : "нет"}; ` +
          `после всего манифеста дыр ${afterGaps.length ? afterGaps.join(", ") : "нет"}`,
      );
      if (afterGaps.length) complain(`${level}: манифест оставляет дыры ${afterGaps.join(", ")}.`);
    }

    console.log(
      problems === 0
        ? "\nСВЕРКА ПРОЙДЕНА: расхождений нет, писать можно."
        : `\nСВЕРКА ПРОВАЛЕНА: расхождений ${problems}. Ничего не писать.`,
    );
    if (problems > 0) process.exitCode = 1;
  } finally {
    await db.$disconnect();
    await local?.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
