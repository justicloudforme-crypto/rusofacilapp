/**
 * Разгружает десять переполненных филвордов: те же слова, разложенные по
 * большему числу сеток.
 *
 * Что делает ровно:
 *   · читает пазл (type=WORD_SEARCH, level, sequence) из манифеста
 *     src/lib/word-games/density-rungs.ts;
 *   · берёт ЕГО СОБСТВЕННЫЕ слова и подсказки — новых слов не появляется,
 *     старые не выбрасываются, лексика не трогается;
 *   · делит их на части и укладывает каждую в свою сетку 16×16;
 *   · первую часть записывает В СУЩЕСТВУЮЩУЮ строку (UPDATE по id):
 *     URL, id и весь WordGameProgress игроков сохраняются;
 *   · остальные части — новые строки в хвосте нумерации уровня, номера
 *     заранее прописаны в манифесте (никакой самодеятельности в проде).
 *
 * Чего НЕ делает: не удаляет строк, не трогает CROSSWORD, не трогает
 * бесплатные рунги 1–10 (все десять целей — платные, sequence > 10),
 * не меняет правило бесплатности, не пишет в sitemap.
 *
 * Проверки перед каждой записью, любая из них останавливает прогон:
 *   · множество слов «до» и «после» совпадает поэлементно;
 *   · каждое слово реально лежит в своей новой сетке (солвер, а не
 *     координаты);
 *   · каждая часть укладывается в порог density.ts;
 *   · номер хвостовой строки взят из манифеста, а не придуман;
 *   · в хвостовом номере ещё нет чужой строки.
 *
 * Использование:
 *   npx tsx prisma/redistribute-word-search.ts --dry-run
 *   npx tsx prisma/redistribute-word-search.ts --dry-run --only=B2/44
 *   npx tsx prisma/redistribute-word-search.ts --only=B2/44,C1/92
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" \
 *     npx tsx prisma/redistribute-word-search.ts --dry-run
 *
 * Флага --force нет и не будет: единственный способ записать — назвать
 * рунги через --only= или запустить весь манифест сознательно, увидев
 * перед этим --dry-run.
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
import { boardSize, boardSizeMismatches, splitPuzzle } from "../src/lib/word-games/redistribute";
import { auditPuzzle, puzzleInputFromRow } from "../src/lib/word-games/word-search-audit";
import { exceedsThreshold, severity } from "../src/lib/word-games/density";
import type { WordPlacement } from "../src/lib/word-games/types";

const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? null;
/**
 * ПОДСАДКА для сторожа размера доски: части собираются на две клетки
 * меньше исходной сетки. Прогон обязан упасть на сторожe и не записать
 * ничего. Без флага подсадки нет.
 *
 * Нужна потому, что размер доски раньше был зашит константой 16, а банк
 * держит шесть размеров (8/10/12/14/16/18). «Читаем размер из строки» —
 * утверждение, которое обязано иметь свой красный прогон, иначе оно
 * ничем не отличается от прежней константы, просто написанной иначе.
 */
const PLANT_SIZE = process.argv.includes("--plant-size");

function selected(): DensitySplit[] {
  if (!ONLY) return [...DENSITY_SPLITS];
  const wanted = ONLY.split(",").map((s) => s.trim()).filter(Boolean);
  const out: DensitySplit[] = [];
  for (const w of wanted) {
    const [level, seq] = w.split("/");
    const hit = DENSITY_SPLITS.find((s) => s.level === level && s.sequence === Number(seq));
    if (!hit) {
      console.error(`--only=${w}: такого рунга нет в манифесте density-rungs.ts. Доступны: ${DENSITY_SPLITS.map((s) => `${s.level}/${s.sequence}`).join(", ")}`);
      process.exit(1);
    }
    out.push(hit);
  }
  return out;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/**
 * Перед любой записью: останется ли лестница уровня сплошной 1…N.
 *
 * WordGamesPicker рисует ссылки `1…count`, где count — ЧИСЛО строк пары
 * (type, level), а не их номера. Дыра в нумерации поэтому не «некрасиво»,
 * а два молчаливых дефекта сразу: строка за дырой недостижима, и на
 * последнюю нарисованную ссылку приходит 404. Все пять лестниц сегодня
 * сплошные (проверено по всем 1738 строкам снимка), и разгрузка — первое,
 * что дописывает строки руками, то есть первое, что способно это сломать.
 *
 * Проверяется ВЕСЬ манифест, а не выбранные --only= рунги: манифест — это
 * обещание конечного состояния, и дыра в нём остаётся дырой независимо от
 * того, какой рунг запускают сегодня. Про --only= печатается отдельное
 * предупреждение: до прогона остальных рунгов лестница будет с дырой, и
 * это нормально ровно до конца прогона.
 */
async function assertLadderStaysContiguous(
  db: PrismaClient,
  selectedNow: DensitySplit[],
): Promise<boolean> {
  let ok = true;
  for (const level of densityLevels()) {
    const rows = await db.wordGamePuzzle.findMany({
      where: { type: "WORD_SEARCH", level },
      select: { sequence: true },
    });
    const existing = rows.map((r) => r.sequence);
    const gaps = ladderGaps(existing, densityTails(level));
    if (gaps.length > 0) {
      console.error(
        `${level}: после всего манифеста в лестнице WORD_SEARCH остаются дыры ${gaps.join(", ")} — ` +
          `WordGamesPicker рисует ссылки 1…N по ЧИСЛУ строк, поэтому дыра делает хвост недостижимым, ` +
          `а последнюю ссылку — 404. Поправьте tailSequences в density-rungs.ts.`,
      );
      ok = false;
      continue;
    }
    const partialGaps = ladderGaps(
      existing,
      selectedNow.filter((s) => s.level === level).flatMap((s) => s.tailSequences),
    );
    if (partialGaps.length > 0) {
      console.log(
        `${level}: предупреждение — в этом прогоне пишутся не все хвосты манифеста, ` +
          `до конца остальных рунгов лестница будет с дырой ${partialGaps.join(", ")}.`,
      );
    }
  }
  return ok;
}

async function main() {
  if (!DRY_RUN) {
    console.log("ЗАПИСЬ. Ожидается, что --dry-run уже был показан и одобрен.\n");
  } else {
    console.log("--dry-run: ничего не будет записано.\n");
  }

  const adapter = new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const db = new PrismaClient({ adapter });
  let updated = 0;
  let created = 0;
  try {
    const chosen = selected();
    if (!(await assertLadderStaysContiguous(db, chosen))) {
      process.exitCode = 1;
      return;
    }
    for (const split of chosen) {
      const label = `WORD_SEARCH/${split.level}/${split.sequence}`;
      const row = await db.wordGamePuzzle.findUnique({
        where: { type_level_sequence: { type: "WORD_SEARCH", level: split.level, sequence: split.sequence } },
      });
      if (!row) {
        console.error(`${label}: строки нет в базе — прогон остановлен.`);
        process.exitCode = 1;
        return;
      }

      const input = puzzleInputFromRow(row);
      if (!input) {
        console.error(`${label}: JSON строки не читается — прогон остановлен.`);
        process.exitCode = 1;
        return;
      }
      const before = auditPuzzle(input);
      const words = (input.words as WordPlacement[]).map((w) => ({ word: w.word, clue: w.clue ?? "" }));

      // Размер доски берётся ИЗ СТРОКИ, а не из константы: банк держит
      // 8×8, 10×10, 12×12, 14×14, 16×16 и 18×18, и разгрузка не имеет
      // права ни ужать 18 до 16, ни раздуть 10 до 16.
      const source = boardSize(input.grid);
      if (source.rows !== source.cols || source.rows === 0) {
        console.error(
          `${label}: доска ${source.rows}×${source.cols} — не квадрат, укладчик умеет только квадратные. Прогон остановлен.`,
        );
        process.exitCode = 1;
        return;
      }
      const buildSize = PLANT_SIZE ? source.rows - 2 : source.rows;
      if (PLANT_SIZE) {
        console.log(`${label}: --plant-size, части собираются ${buildSize}×${buildSize} вместо ${source.rows}×${source.rows} — сторож обязан это поймать.`);
      }

      const result = splitPuzzle(words, buildSize, `redistribute-WORD_SEARCH-${split.level}-${split.sequence}`);
      if (!result) {
        console.error(`${label}: разложить не удалось ни на 2, ни на ${split.parts}+ частей — прогон остановлен.`);
        process.exitCode = 1;
        return;
      }

      // Слова «до» и «после» — поэлементно, а не по количеству.
      const beforeSet = new Set(words.map((w) => w.word));
      const afterSet = new Set(result.wordsOut);
      const lost = [...beforeSet].filter((w) => !afterSet.has(w));
      const invented = [...afterSet].filter((w) => !beforeSet.has(w));
      if (lost.length > 0 || invented.length > 0) {
        console.error(`${label}: слова не сходятся. Потеряно: ${lost.join(", ") || "—"}; появилось лишнее: ${invented.join(", ") || "—"} — прогон остановлен.`);
        process.exitCode = 1;
        return;
      }

      if (result.parts.length !== split.parts) {
        console.error(
          `${label}: манифест обещает ${split.parts} части, разложилось на ${result.parts.length}. ` +
            `Номера хвостовых строк заданы заранее, придумывать новые скрипт не будет — поправьте density-rungs.ts и повторите.`,
        );
        process.exitCode = 1;
        return;
      }

      // Каждая часть — заново через солвер, а не «по построению».
      const partAudits = result.parts.map((part, i) =>
        auditPuzzle({
          id: `${row.id}-part${i}`,
          level: split.level,
          sequence: i === 0 ? split.sequence : split.tailSequences[i - 1],
          curved: false,
          grid: part.grid.grid,
          words: part.words,
        }),
      );
      const badPart = partAudits.find(
        (a) => a.missing.length > 0 || a.placementMismatches.length > 0 || exceedsThreshold(a),
      );
      const sizeProblems = boardSizeMismatches(source, result.parts);
      if (sizeProblems.length > 0) {
        console.error(
          `${label}: разгрузка изменила бы размер доски — ${sizeProblems.join("; ")}. ` +
            `Разгрузка раскладывает те же слова по большему числу сеток, а не перекраивает доску. Прогон остановлен.`,
        );
        process.exitCode = 1;
        return;
      }

      if (badPart) {
        console.error(
          `${label}: часть ${badPart.sequence} не проходит проверку — ненайденных ${badPart.missing.length}, ` +
            `координат не сходится ${badPart.placementMismatches.length}, занято ${pct(badPart.occupancy)}, слов на клетку ${badPart.maxOverlap}.`,
        );
        process.exitCode = 1;
        return;
      }

      console.log(
        `${label}: ${before.wordCount} слов, доска ${source.rows}×${source.cols}, занято ${pct(before.occupancy)}, слов на клетку ${before.maxOverlap}, тяжесть ${severity(before).toFixed(3)}`,
      );
      partAudits.forEach((a, i) => {
        const where = i === 0 ? `в ту же строку (id ${row.id}, sequence ${split.sequence})` : `новая строка sequence ${split.tailSequences[i - 1]}`;
        console.log(
          `   → часть ${i + 1}/${result.parts.length}: ${a.wordCount} слов, занято ${pct(a.occupancy)}, слов на клетку ${a.maxOverlap}, заполнителей ${pct(a.fillerShare)} — ${where}`,
        );
      });

      // Хвостовые номера обязаны быть свободны — или уже принадлежать
      // прошлому прогону этого же скрипта, чтобы повторный запуск был
      // идемпотентным. «Наша» строка опознаётся по содержимому, а не по
      // метке: все её слова обязаны быть словами исходного рунга. Чужая
      // строка в этом номере означает, что лестница уровня выросла и
      // манифест разошёлся с базой — это остановка, а не перезапись.
      for (const seq of split.tailSequences) {
        const existing = await db.wordGamePuzzle.findUnique({
          where: { type_level_sequence: { type: "WORD_SEARCH", level: split.level, sequence: seq } },
        });
        if (!existing) continue;
        const existingInput = puzzleInputFromRow(existing);
        const existingWords = existingInput ? existingInput.words.map((w) => w.word) : null;
        const ours = existingWords !== null && existingWords.length > 0 && existingWords.every((w) => beforeSet.has(w));
        if (!ours) {
          console.error(
            `${label}: sequence ${seq} уже занят строкой (id ${existing.id}), слова которой не принадлежат этому рунгу — прогон остановлен.`,
          );
          process.exitCode = 1;
          return;
        }
      }

      if (DRY_RUN) {
        updated += 1;
        created += split.tailSequences.length;
        continue;
      }

      await db.wordGamePuzzle.update({
        where: { id: row.id },
        data: { gridData: JSON.stringify(result.parts[0].grid), words: JSON.stringify(result.parts[0].words) },
      });
      updated += 1;

      for (let i = 1; i < result.parts.length; i++) {
        const seq = split.tailSequences[i - 1];
        await db.wordGamePuzzle.upsert({
          where: { type_level_sequence: { type: "WORD_SEARCH", level: split.level, sequence: seq } },
          create: {
            type: "WORD_SEARCH",
            level: split.level,
            sequence: seq,
            curved: false,
            premiumOnly: false,
            // Тема остаётся пустой намеренно: тема — это обещание
            // «филворд про еду», и хвостовая часть разложенного рунга
            // такого обещания не даёт. getTopicInfo(null) уже возвращает
            // null, заголовок собирается в общем, нетематическом виде.
            topic: null,
            gridData: JSON.stringify(result.parts[i].grid),
            words: JSON.stringify(result.parts[i].words),
          },
          update: {
            curved: false,
            topic: null,
            gridData: JSON.stringify(result.parts[i].grid),
            words: JSON.stringify(result.parts[i].words),
          },
        });
        created += 1;
      }
    }

    console.log(
      `\n${DRY_RUN ? "БЫЛО БЫ: " : "СДЕЛАНО: "}обновлено на месте ${updated}, новых строк в хвосте ${created}.`,
    );
    if (DRY_RUN) console.log("Ничего не записано.");
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
