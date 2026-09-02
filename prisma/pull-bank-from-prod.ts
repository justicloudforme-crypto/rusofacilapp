/**
 * Пересев локальной `dev.db` банком с ПРОДА: WordGamePuzzle и
 * FlashcardCard. Прод — ТОЛЬКО НА ЧТЕНИЕ, ни одного запроса на запись к
 * нему здесь нет и быть не может: боевое соединение открывается отдельным
 * клиентом, и этот клиент используется ровно в двух `findMany`.
 *
 * Зачем. После 7.81-7.83 стало известно, что локальный банк и продовый —
 * это два независимых прогона одного генератора: под одними номерами
 * лежат разные пазлы (99,3% банка расходится). Пока это так, локально
 * нельзя проверить ничего, что зависит от содержимого пазла: снимок
 * описывает прод, `--dry-run` генератора врёт, а «локально прошло» не
 * значит ничего. Прод объявлен эталоном (7.83), поэтому сходятся не они к
 * нам, а мы к ним.
 *
 * Что делается с прогрессом. `WordGameProgress.puzzleId` ссылается на id
 * строки, а id у прода другие, поэтому простое удаление банка снесло бы
 * каскадом 451 локальную строку прогресса. Вместо этого прогресс
 * снимается заранее и переносится по (type, level, sequence) — по тому
 * же ключу, по которому 7.83 сопоставлял банки. Строки прогресса, для
 * которых рунга на проде нет, не выдумываются, а печатаются списком.
 *
 * `FlashcardProgress.cardId` переносить не надо: id карточки — слаг
 * (`v6-fridge`), одинаковый в обеих базах (7.83: 5678 из 5678 сошлись).
 * Это проверяется здесь же и печатается числом.
 *
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" \
 *     npm run db:pull-bank-from-prod              # показать, ничего не писать
 *   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" \
 *     npm run db:pull-bank-from-prod -- --apply   # записать в ЛОКАЛЬНУЮ dev.db
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";

const APPLY = process.argv.includes("--apply");

function rungKey(p: { type: string; level: string; sequence: number }): string {
  return `${p.type}/${p.level}/${p.sequence}`;
}

async function main() {
  const prodUrl = process.env.TURSO_DATABASE_URL;
  if (!prodUrl) {
    console.error(
      "\nНЕТ КЛЮЧА: не задан TURSO_DATABASE_URL. Пересевать нечем — эталон живёт на проде.\n" +
        "  Команда не «пропускается»: без ключа у неё нет источника.",
    );
    process.exitCode = 1;
    return;
  }
  const localUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  if (localUrl.startsWith("libsql://") || localUrl.startsWith("https://")) {
    console.error(`\nОТКАЗ: DATABASE_URL указывает на удалённую базу (${localUrl.split("?")[0]}). Пишем только в локальный файл.`);
    process.exitCode = 1;
    return;
  }

  const prod = new PrismaClient({
    adapter: new PrismaLibSql({ url: prodUrl, authToken: process.env.TURSO_AUTH_TOKEN }),
  });
  const local = new PrismaClient({ adapter: new PrismaLibSql({ url: localUrl }) });

  try {
    // --- Прод, только чтение ---------------------------------------
    const prodPuzzles = await prod.wordGamePuzzle.findMany();
    const prodCards = await prod.flashcardCard.findMany();
    console.log(`Прод (только чтение): WordGamePuzzle ${prodPuzzles.length}, FlashcardCard ${prodCards.length}.`);

    // --- Локальная база --------------------------------------------
    const localPuzzles = await local.wordGamePuzzle.findMany({
      select: { id: true, type: true, level: true, sequence: true },
    });
    const localCards = await local.flashcardCard.findMany({ select: { id: true } });
    const progress = await local.wordGameProgress.findMany();
    console.log(
      `Локально: WordGamePuzzle ${localPuzzles.length}, FlashcardCard ${localCards.length}, ` +
        `WordGameProgress ${progress.length}.`,
    );

    const localById = new Map(localPuzzles.map((p) => [p.id, p]));
    const prodByRung = new Map(prodPuzzles.map((p) => [rungKey(p), p]));
    const prodCardIds = new Set(prodCards.map((c) => c.id));
    const localCardIds = new Set(localCards.map((c) => c.id));

    const cardsOnlyLocal = [...localCardIds].filter((id) => !prodCardIds.has(id));
    const cardsOnlyProd = [...prodCardIds].filter((id) => !localCardIds.has(id));
    console.log(
      `Карточки: id совпало ${localCards.length - cardsOnlyLocal.length} из ${localCards.length}; ` +
        `есть только локально ${cardsOnlyLocal.length}, есть только на проде ${cardsOnlyProd.length}.`,
    );

    // Куда переедет прогресс.
    const remap: { progressId: string; from: string; to: string }[] = [];
    const orphaned: string[] = [];
    for (const row of progress) {
      const was = localById.get(row.puzzleId);
      const target = was ? prodByRung.get(rungKey(was)) : undefined;
      if (!was || !target) {
        orphaned.push(row.puzzleId);
        continue;
      }
      remap.push({ progressId: row.id, from: row.puzzleId, to: target.id });
    }
    const moved = remap.filter((r) => r.from !== r.to).length;
    console.log(
      `Прогресс: переносится ${remap.length} из ${progress.length} строк ` +
        `(из них меняют id пазла ${moved}); без рунга на проде — ${orphaned.length}.`,
    );
    for (const o of orphaned.slice(0, 20)) console.log(`  без пары: ${o}`);

    if (!APPLY) {
      console.log(
        "\n--dry-run (по умолчанию): в локальную базу ничего не записано.\n" +
          "  Записать: npm run db:pull-bank-from-prod -- --apply",
      );
      return;
    }

    // --- Запись, только в локальный файл ----------------------------
    // Карточки: id одинаковые, поэтому FlashcardProgress не трогается.
    let cardsWritten = 0;
    for (const card of prodCards) {
      const { id, ...rest } = card;
      await local.flashcardCard.upsert({ where: { id }, update: rest, create: card });
      cardsWritten++;
    }
    if (cardsOnlyLocal.length > 0) {
      await local.flashcardCard.deleteMany({ where: { id: { in: cardsOnlyLocal } } });
    }
    console.log(`Карточки записаны: ${cardsWritten}, удалено лишних локальных ${cardsOnlyLocal.length}.`);

    // Пазлы: банк заменяется целиком, прогресс восстанавливается после.
    // Порядок важен — удаление банка каскадом уносит прогресс, поэтому его
    // строки сначала сняты в память (выше), а потом создаются заново.
    await local.wordGameProgress.deleteMany({});
    await local.wordGamePuzzle.deleteMany({});
    for (let i = 0; i < prodPuzzles.length; i += 200) {
      await local.wordGamePuzzle.createMany({ data: prodPuzzles.slice(i, i + 200) });
    }
    const byProgressId = new Map(remap.map((r) => [r.progressId, r.to]));
    const restored = progress
      .filter((p) => byProgressId.has(p.id))
      .map((p) => ({ ...p, puzzleId: byProgressId.get(p.id)! }));
    if (restored.length > 0) await local.wordGameProgress.createMany({ data: restored });

    const after = await local.wordGamePuzzle.count();
    const afterProgress = await local.wordGameProgress.count();
    console.log(
      `Пазлы записаны: ${after} (было ${localPuzzles.length}). ` +
        `Прогресс восстановлен: ${afterProgress} из ${progress.length}.`,
    );
  } finally {
    await prod.$disconnect();
    await local.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
