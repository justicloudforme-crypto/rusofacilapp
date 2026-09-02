/**
 * Разгружает переполненные филворды: те же слова — на доске подходящего
 * размера и, если надо, на большем числе досок.
 *
 * Что делает ровно:
 *   · читает пазл (type=WORD_SEARCH, level, sequence) из манифеста
 *     src/lib/word-games/density-rungs.ts;
 *   · берёт ЕГО СОБСТВЕННЫЕ слова и подсказки — новых слов не появляется,
 *     старые не выбрасываются, лексика не трогается;
 *   · ВЫБИРАЕТ размер доски под длину слов и целевую занятость
 *     (src/lib/word-games/quality.ts) — из шести, которые держит банк
 *     (8/10/12/14/16/18), и делит слова на части, если одной сетки мало;
 *     размер источника при этом может смениться, зашитой константы нет;
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
 *   · каждая часть попадает в КОРИДОР quality.ts (не только под порог
 *     density.ts) — иначе прогон останавливается, а не пишет «лучшее из
 *     возможного» молча;
 *   · стороны, выбранные планировщиком, совпадают с теми, что записаны в
 *     манифесте: то, что показано до записи, и есть то, что пишется;
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
import { boardSize, boardSizeMismatches, planLayout } from "../src/lib/word-games/redistribute";
import { auditPuzzle, puzzleInputFromRow } from "../src/lib/word-games/word-search-audit";
import { exceedsThreshold, severity } from "../src/lib/word-games/density";
import { judge } from "../src/lib/word-games/quality";
import type { WordPlacement } from "../src/lib/word-games/types";

const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? null;
/**
 * ПОДСАДКА для сторожа размера доски: манифесту подменяется сторона
 * первой части (на две клетки меньше), а планировщик придёт к своей.
 * Прогон обязан упасть на сторожe и не записать ничего. Без флага
 * подсадки нет.
 *
 * Нужна потому, что размер доски теперь ВЫБИРАЕТСЯ, а не наследуется, и
 * банк держит шесть размеров (8/10/12/14/16/18). «Стороны из манифеста и
 * стороны планировщика обязаны совпасть» — утверждение, которое обязано
 * иметь свой красный прогон, иначе оно ничем не отличается от прежней
 * зашитой константы, просто написанной иначе.
 */
const PLANT_SIZE = process.argv.includes("--plant-size");
/**
 * Только приводит флаги доступа хвостовых строк к флагам их источника и
 * ничего больше — ни одной сетки не пересобирает. Нужен потому, что
 * первый прогон по проду записал хвосты с `premiumOnly: false`, а четыре
 * источника Premium-эксклюзивные. Идемпотентен: печатает, что расходится,
 * и трогает только такие строки.
 */
const SYNC_TAIL_FLAGS = process.argv.includes("--sync-tail-flags");

function selected(): DensitySplit[] {
  // По умолчанию — только НЕприменённые записи. Применённые остаются в
  // манифесте навсегда (на них держится защита хвостов от чистки
  // генератора), но их источники уже в коридоре: повторный прогон по ним
  // либо ничего не даст, либо разойдётся с числом частей и остановит
  // весь прогон. Назвать их через --only= по-прежнему можно.
  if (!ONLY) return DENSITY_SPLITS.filter((s) => !s.applied);
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

    if (SYNC_TAIL_FLAGS) {
      let fixed = 0;
      for (const split of chosen) {
        const src = await db.wordGamePuzzle.findUnique({
          where: { type_level_sequence: { type: "WORD_SEARCH", level: split.level, sequence: split.sequence } },
          select: { premiumOnly: true, curved: true },
        });
        if (!src) {
          console.error(`WORD_SEARCH/${split.level}/${split.sequence}: источника нет — пропущен.`);
          continue;
        }
        for (const seq of split.tailSequences) {
          const tail = await db.wordGamePuzzle.findUnique({
            where: { type_level_sequence: { type: "WORD_SEARCH", level: split.level, sequence: seq } },
            select: { id: true, premiumOnly: true, curved: true },
          });
          if (!tail) {
            console.error(`WORD_SEARCH/${split.level}/${seq}: хвостовой строки нет — пропущена.`);
            continue;
          }
          if (tail.premiumOnly === src.premiumOnly && tail.curved === src.curved) continue;
          console.log(
            `WORD_SEARCH/${split.level}/${seq}: premiumOnly ${tail.premiumOnly} → ${src.premiumOnly}, ` +
              `curved ${tail.curved} → ${src.curved} (у источника ${split.level}/${split.sequence})`,
          );
          if (!DRY_RUN) {
            await db.wordGamePuzzle.update({
              where: { id: tail.id },
              data: { premiumOnly: src.premiumOnly, curved: src.curved },
            });
          }
          fixed += 1;
        }
      }
      console.log(`\n${DRY_RUN ? "БЫЛО БЫ приведено" : "Приведено"} к флагам источника: ${fixed} хвостовых строк.`);
      return;
    }

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

      if (row.curved) {
        console.error(
          `${label}: это ★-рунг. Части собираются ПРЯМЫМ укладчиком (buildWordSearch), ` +
            `и разложить гнутый рунг им значит молча превратить его в другой тип игры. Прогон остановлен.`,
        );
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
      const result = planLayout(words, `redistribute-WORD_SEARCH-${split.level}-${split.sequence}`, {
        curved: row.curved,
      });
      if (!result) {
        console.error(`${label}: уложить не удалось ни при каком наборе сторон — прогон остановлен.`);
        process.exitCode = 1;
        return;
      }
      if (!result.inCorridor) {
        console.error(
          `${label}: лучший достижимый план всё равно вне коридора (${result.parts.map((p) => pct(p.occupancy)).join(" / ")}) — ` +
            `записывать такое молча нельзя, прогон остановлен.`,
        );
        process.exitCode = 1;
        return;
      }
      // Стороны берутся ИЗ МАНИФЕСТА, а планировщик обязан прийти к тем
      // же. Манифест — это то, что показали до записи; расхождение
      // означает, что база или правило сдвинулись между замером и
      // записью, и тогда пишется не то, что одобрено.
      const plannedSizes = PLANT_SIZE ? split.sizes.map((s, i) => (i === 0 ? s - 2 : s)) : split.sizes;
      if (PLANT_SIZE) {
        console.log(`${label}: --plant-size, манифесту подсажена сторона ${plannedSizes[0]} вместо ${split.sizes[0]} — сторож обязан это поймать.`);
      }
      const builtSizes = result.parts.map((p) => p.size);
      if (builtSizes.join(",") !== plannedSizes.join(",")) {
        console.error(
          `${label}: манифест обещает стороны ${plannedSizes.join("+")}, планировщик выбрал ${builtSizes.join("+")} — ` +
            `прогон остановлен. Пересчитайте density-rungs.ts через npm run db:build-density-manifest.`,
        );
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
          curved: row.curved,
          grid: part.grid.grid,
          words: part.words,
        }),
      );
      const badPart = partAudits.find(
        (a) =>
          a.missing.length > 0 ||
          a.placementMismatches.length > 0 ||
          exceedsThreshold(a) ||
          !judge(a).ok,
      );
      const sizeProblems = boardSizeMismatches(plannedSizes, result.parts);
      if (sizeProblems.length > 0) {
        console.error(
          `${label}: собранные части не совпали с выбранными сторонами — ${sizeProblems.join("; ")}. Прогон остановлен.`,
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
        `${label}: ${before.wordCount} слов, доска ${source.rows}×${source.cols}, занято ${pct(before.occupancy)}, слов на клетку ${before.maxOverlap}, тяжесть ${severity(before).toFixed(3)}, ` +
          `длиннейшее/сторона ${before.longestOverMinSide.toFixed(2)} — «${judge(before).zone}»${judge(before).longWord ? ", длинное слово" : ""}`,
      );
      partAudits.forEach((a, i) => {
        const where = i === 0 ? `в ту же строку (id ${row.id}, sequence ${split.sequence})` : `новая строка sequence ${split.tailSequences[i - 1]}`;
        console.log(
          `   → часть ${i + 1}/${result.parts.length}: доска ${a.rows}×${a.cols}, ${a.wordCount} слов, занято ${pct(a.occupancy)}, ` +
            `слов на клетку ${a.maxOverlap}, заполнителей ${pct(a.fillerShare)}, длиннейшее/сторона ${a.longestOverMinSide.toFixed(2)} — ${where}`,
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
            // Наследуется у источника, а не false. Хвост — это вторая
            // половина ТОГО ЖЕ пазла: если источник Premium-эксклюзивный,
            // а хвост нет, разгрузка молча отдаёт «стандартному»
            // подписчику половину слов платного пазла. Жёсткий false
            // сделал ровно это на четырёх рунгах (C1/164, C1/165,
            // B2/232, B1/400) — поймано сверкой после записи, исправлено
            // прогоном --sync-tail-flags.
            premiumOnly: row.premiumOnly,
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
            premiumOnly: row.premiumOnly,
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
