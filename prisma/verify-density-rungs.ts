/**
 * СВЕРКА ПЕРЕД ЗАПИСЬЮ. Ничего не пишет и писать не умеет.
 *
 * Разгрузка применяется к боевой базе. Манифест
 * `src/lib/word-games/density-rungs.ts` и снимок
 * продовый снимок (`PROD_BASELINE_PATH`) теперь сняты С ПРОДА —
 * с той же базы, в которую пойдёт запись, — и сверка доказывает не
 * «это та же база», а «база не сдвинулась между замером и записью».
 * Раньше и манифест, и снимок были локальными, и именно эта сверка
 * поймала, что прод держит другой банк (PROGRESS.md 7.81-7.83).
 *
 * Что сверяется по каждому ещё не применённому рунгу манифеста:
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
 * И по каждому хвостовому номеру: в базе его нет вовсе — иначе
 * лестница уровня уже выросла и манифест разошёлся с базой.
 *
 * Плюс лестница каждого затронутого уровня печатается как есть: сколько
 * строк, какой максимум, где дыры.
 *
 * Использование:
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" \
 *     npx tsx prisma/verify-density-rungs.ts
 *   … --words-from=file:./dev.db      # ещё и поэлементная сверка слов
 *   … --round=1 | --round=2 | …        # только один десяток из ещё
 *                                      # неприменённых записей манифеста
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
  PORTION_5_SOURCES,
  type DensitySplit,
} from "../src/lib/word-games/density-rungs";
import { auditPuzzle, puzzleInputFromRow } from "../src/lib/word-games/word-search-audit";
import { boardSize } from "../src/lib/word-games/redistribute";
import { isFreeWordGamePuzzle } from "../src/lib/word-games/free-tier";
import { readFileSync } from "node:fs";
import { PROD_BASELINE_PATH, type BaselineFile } from "../src/lib/word-games/bank-fingerprint";

function baselineArg(): string | undefined {
  const hit = process.argv.find((a) => a.startsWith("--baseline="));
  return hit ? hit.slice("--baseline=".length) : undefined;
}
const BASELINE = baselineArg() ?? PROD_BASELINE_PATH;
const ROUND_SIZE = 10;

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

/**
 * Круг — десяток НЕПРИМЕНЁННЫХ записей манифеста по порядку файла;
 * порядок в файле и есть порядок применения (7.80).
 *
 * Применённые записи из счёта исключаются: их источники уже разгружены,
 * их занятость со снимком «до» не сходится по построению, и сверять их
 * перед следующей записью — значит красить прогон в красный тем, что уже
 * сделано. Раньше кругов было ровно два, и оба были половинами файла.
 */
export function pendingSplits(splits: readonly DensitySplit[]): DensitySplit[] {
  return splits.filter((s) => !s.applied);
}

export function roundOf(splits: readonly DensitySplit[], round: number): DensitySplit[] {
  const pending = pendingSplits(splits);
  return pending.slice((round - 1) * ROUND_SIZE, round * ROUND_SIZE);
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function client(url: string, authToken?: string) {
  return new PrismaClient({ adapter: new PrismaLibSql({ url, authToken }) });
}

async function main() {
  const roundArg = arg("round");
  const round = roundArg ? Number(roundArg) : null;
  const chosen = round ? roundOf(DENSITY_SPLITS, round) : pendingSplits(DENSITY_SPLITS);
  const wordsFrom = arg("words-from");
  // Слова, размер доски и id строки НА МОМЕНТ ЗАМЕРА — из того самого
  // JSON, по которому манифест и составлен (--json= у
  // build-density-manifest). Это единственная сверка слов, которая
  // теперь что-то значит: локальная копия держит другой банк, и
  // --words-from=file:./dev.db гарантированно покажет расхождение,
  // не относящееся к делу.
  const manifestFile = arg("words-from-manifest");
  interface ManifestEntry {
    level: string;
    sequence: number;
    board: string;
    parts: number | null;
    sizes?: number[];
    tailSequences: number[];
    rowId?: string;
    words?: string[];
  }
  const measured = new Map<string, ManifestEntry>();
  if (manifestFile) {
    const parsed = JSON.parse(readFileSync(manifestFile, "utf8")) as { manifest: ManifestEntry[] };
    for (const e of parsed.manifest) measured.set(`${e.level}/${e.sequence}`, e);
  }

  const prodUrl = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
  const db = client(prodUrl, process.env.TURSO_AUTH_TOKEN);
  const local = wordsFrom ? client(wordsFrom) : null;

  const baselineFile = JSON.parse(readFileSync(BASELINE, "utf8")) as BaselineFile<{
    occupancy: number;
    maxOverlap: number;
  }>;
  const baseline = baselineFile.puzzles;

  let problems = 0;
  const complain = (msg: string) => {
    problems += 1;
    console.error(`  ✗ ${msg}`);
  };

  try {
    console.log(
      `База: ${prodUrl.replace(/^(libsql:\/\/[^.]{0,8}).*$/, "$1…")}${
        manifestFile
          ? `, слова/доска сверяются с замером ${manifestFile}`
          : wordsFrom
            ? `, слова сверяются с ${wordsFrom}`
            : ", слова НЕ сверяются (нет --words-from-manifest=)"
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
        // Снимок хранит занятость округлённой до 4 знаков
        // (check-word-search.ts: `Number(a.occupancy.toFixed(4))`), а
        // живое значение — полное. Сравнение «до девятого знака»
        // объявляло расхождением 87.1% против 87.1% на каждой второй
        // строке: сторож, который всегда красный, ничего не сторожит.
        // Допуск — ровно половина последнего хранимого знака.
        const ROUNDING = 5e-5;
        if (Math.abs(a.occupancy - want.occupancy) > ROUNDING) {
          complain(
            `${key}: занятость на проде ${(a.occupancy * 100).toFixed(3)}%, в снимке ${(want.occupancy * 100).toFixed(3)}%.`,
          );
        }
        if (a.maxOverlap !== want.maxOverlap) {
          complain(`${key}: слов на клетку на проде ${a.maxOverlap}, в снимке ${want.maxOverlap}.`);
        }
      }
      const key5 = `${split.level}/${split.sequence}`;
      // Через ту же функцию, что и пейволл с robots.txt, а не через
      // `sequence <= 10`: бесплатность — это `level !== "C1" && sequence
      // <= 10`, и голое сравнение по номеру объявляло бесплатным C1/10,
      // который бесплатным никогда не был (у C1 бесплатных рунгов нет
      // вовсе). Дубль правила ровно тот, ради устранения которого
      // free-tier.ts и выделяли.
      //
      // 05.09.2026 (PROGRESS 7.109) у этого запрета появилось РОВНО ОДНО
      // исключение — порция 5, которая и есть «рунги 1-10 не-C1», и она
      // названа перечислением в `PORTION_5_SOURCES`, а не условием.
      // Разница принципиальная: «кроме бесплатных» отменило бы проверку
      // целиком, а список из двадцати шести ключей оставляет её строгой
      // для всех остальных 821 записи и для любой будущей порции.
      if (isFreeWordGamePuzzle({ type: "WORD_SEARCH", level: split.level, sequence: split.sequence })) {
        if (PORTION_5_SOURCES.includes(key5)) {
          console.log(`  · ${key}: бесплатный рунг порции 5 — разрешён списком PORTION_5_SOURCES.`);
        } else {
          complain(`${key}: это БЕСПЛАТНЫЙ рунг вне порции 5 — манифест не имеет права его трогать.`);
        }
      }
      if (a.missing.length > 0) {
        complain(`${key}: солвер не находит в сетке ${a.missing.length} слов: ${a.missing.join(", ")}`);
      }

      const m = measured.get(`${split.level}/${split.sequence}`);
      if (manifestFile) {
        if (!m) {
          complain(`${key}: в замере ${manifestFile} такого рунга нет.`);
        } else {
          if (m.rowId && m.rowId !== row.id) {
            complain(`${key}: id строки ${row.id}, в замере ${m.rowId} — строку пересоздали.`);
          }
          const size = boardSize(input.grid);
          const board = `${size.rows}×${size.cols}`;
          if (m.board && m.board !== board) {
            complain(`${key}: доска ${board}, в замере ${m.board}.`);
          }
          if (m.parts !== null && m.parts !== split.parts) {
            complain(`${key}: манифест обещает ${split.parts} част(и), замер дал ${m.parts}.`);
          }
          // Стороны — такая же часть обещания, как число частей: размер
          // доски теперь ВЫБИРАЕТСЯ (quality.ts), и «14+18» в манифесте
          // против «16+16» в замере значит, что записана будет не та
          // доска, которую показывали.
          if (m.sizes && JSON.stringify(m.sizes) !== JSON.stringify(split.sizes)) {
            complain(
              `${key}: стороны манифеста [${split.sizes.join(", ")}] ≠ сторонам замера [${m.sizes.join(", ")}].`,
            );
          }
          if (JSON.stringify(m.tailSequences) !== JSON.stringify(split.tailSequences)) {
            complain(
              `${key}: хвосты манифеста [${split.tailSequences.join(", ")}] ≠ хвостам замера [${m.tailSequences.join(", ")}].`,
            );
          }
          if (m.words) {
            const now = input.words.map((w) => w.word);
            const same = now.length === m.words.length && now.every((w, i) => w === m.words![i]);
            if (!same) {
              const lost = m.words.filter((w) => !now.includes(w));
              const extra = now.filter((w) => !m.words!.includes(w));
              complain(
                `${key}: слова разошлись с замером. Было и нет: ${lost.join(", ") || "—"}; ` +
                  `есть и не было: ${extra.join(", ") || "—"}` +
                  (lost.length === 0 && extra.length === 0 ? " (тот же набор, другой ПОРЯДОК)" : ""),
              );
            } else {
              notes.push(`слова ${now.length}/${now.length} совпали поэлементно и по порядку, доска ${board}`);
            }
          }
        }
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
      // Исключений у этого запрета нет и у порции 5 тоже: хвост в
      // бесплатной десятке добавил бы страницу в sitemap.xml, набор URL
      // которого выведен из констант free-tier.ts, а не из базы.
      if (isFreeWordGamePuzzle({ type: "WORD_SEARCH", level, sequence: seq })) {
        complain(`WORD_SEARCH/${level}/${seq}: хвост попал в БЕСПЛАТНУЮ десятку — это добавило бы URL в sitemap.`);
      }
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
