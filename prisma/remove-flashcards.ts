/**
 * УДАЛЕНИЕ КАРТОЧЕК-ДУБЛЕЙ. По умолчанию НИЧЕГО НЕ ПИШЕТ.
 *
 * Скрипт рассчитан на один случай: в банке лежат две карточки на одно и
 * то же слово, одна из них с опечаткой, и лишнюю надо убрать, не потеряв
 * ни чужого прогресса, ни строки в пазле.
 *
 * Порядок ровно такой:
 *
 *   1. `--plan=<файл>` — список пар «убрать / оставить». Обе строки
 *      обязаны существовать: если `remove` уже нет, скрипт ОТКАЗЫВАЕТСЯ.
 *      Это и есть защита от второго прогона тем же файлом.
 *   2. Без `--apply` печатается, что привязано к каждой из строк:
 *      прогресс пользователей, озвучка (`AudioAsset`), вхождения слова в
 *      филворды и кроссворды.
 *   3. `--apply` выполняет перенос и удаление в транзакции.
 *
 * ПЕРЕНОС, А НЕ ПОТЕРЯ. Прогресс с удаляемой карточки переезжает на
 * остающуюся: если у пользователя уже есть строка на остающейся, две
 * сливаются в лучшую (known побеждает, box и correctStreak — максимум,
 * lastSeenAt — позднейший). `FlashcardProgress` не имеет внешнего ключа
 * на `FlashcardCard` (см. schema.prisma), поэтому удаление карточки
 * оставило бы висящую строку молча — её никто бы не увидел, и она просто
 * перестала бы показываться. Это и есть «потерянная запись».
 *
 * `--force` не поддерживается намеренно и отвергается вслух: единственная
 * причина, по которой он бы понадобился, — обойти отказ из пункта 1, а
 * это ровно тот случай, когда останавливаться и надо.
 *
 * Использование:
 *   npm run db:remove-flashcards -- --plan=prisma/data/remove-duplicates-2026-09-02.json
 *   npm run db:remove-flashcards -- --plan=… --apply
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";

interface Removal {
  /** id карточки, которую убираем. */
  remove: string;
  /** id карточки, которая остаётся и принимает привязки. */
  keep: string;
  /** Зачем — попадает в вывод, чтобы прогон читался без плана под рукой. */
  reason: string;
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

const PLAN = arg("plan");
const APPLY = process.argv.includes("--apply");

function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").trim();
}

async function main(): Promise<void> {
  if (process.argv.includes("--force")) {
    console.error(
      "\n--force не поддерживается. Единственное, что он мог бы обойти, — отказ\n" +
        "«строки уже нет», а это и есть тот случай, когда надо остановиться.\n",
    );
    process.exitCode = 1;
    return;
  }
  if (!PLAN) {
    console.error("Нужен --plan=<файл.json> со списком пар { remove, keep, reason }.");
    process.exitCode = 1;
    return;
  }

  const plan = JSON.parse(readFileSync(PLAN, "utf8")) as Removal[];
  if (!Array.isArray(plan) || plan.length === 0) {
    console.error(`План ${PLAN} пуст или не массив.`);
    process.exitCode = 1;
    return;
  }

  const dbUrl = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
  const db = new PrismaClient({
    adapter: new PrismaLibSql({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN }),
  });

  try {
    console.log(`\nБАЗА: ${dbUrl.startsWith("libsql") ? "ПРОД" : dbUrl}`);
    console.log(`ПЛАН: ${PLAN}, пар: ${plan.length}`);
    console.log(APPLY ? "РЕЖИМ: ЗАПИСЬ (--apply)" : "РЕЖИМ: только показ (--dry-run по умолчанию)");

    const puzzles = await db.wordGamePuzzle.findMany({ select: { id: true, type: true, level: true, sequence: true, words: true } });
    const cardsTotalBefore = await db.flashcardCard.count();

    let refused = false;
    const work: {
      removal: Removal;
      remove: { id: string; russian: string; level: string; category: string; transcription: string };
      keep: { id: string; russian: string; level: string; category: string; transcription: string };
      progress: { id: string; userId: string; known: boolean; box: number; correctStreak: number; lastSeenAt: Date | null }[];
      keepProgress: Map<string, { id: string; known: boolean; box: number; correctStreak: number; lastSeenAt: Date | null }>;
      audio: { id: string; itemKey: string; audioUrl: string }[];
      keepAudio: string[];
      puzzleHits: { where: string; word: string }[];
    }[] = [];

    for (const removal of plan) {
      const remove = await db.flashcardCard.findUnique({ where: { id: removal.remove } });
      const keep = await db.flashcardCard.findUnique({ where: { id: removal.keep } });
      console.log(`\n── ${removal.remove}  →  ${removal.keep}`);
      console.log(`   ${removal.reason}`);
      if (!remove) {
        console.log(`   ОТКАЗ: карточки ${removal.remove} в базе нет. Похоже, план уже применён.`);
        refused = true;
        continue;
      }
      if (!keep) {
        console.log(`   ОТКАЗ: остающейся карточки ${removal.keep} в базе нет.`);
        refused = true;
        continue;
      }
      console.log(`   убираем:  «${remove.russian}» [${remove.level}/${remove.category}] «${remove.transcription}»`);
      console.log(`   остаётся: «${keep.russian}» [${keep.level}/${keep.category}] «${keep.transcription}»`);
      if (normalize(remove.russian) !== normalize(keep.russian)) {
        console.log("   ОТКАЗ: после нормализации «ё» и регистра это РАЗНЫЕ слова — пара выбрана неверно.");
        refused = true;
        continue;
      }

      const progress = await db.flashcardProgress.findMany({ where: { cardId: remove.id } });
      const keepProgressRows = await db.flashcardProgress.findMany({ where: { cardId: keep.id } });
      const audio = await db.audioAsset.findMany({ where: { contentType: "flashcard", contentId: remove.id } });
      const keepAudio = await db.audioAsset.findMany({ where: { contentType: "flashcard", contentId: keep.id } });

      const puzzleHits: { where: string; word: string }[] = [];
      for (const p of puzzles) {
        const words = JSON.parse(p.words) as { word: string }[];
        for (const w of words) {
          if (normalize(w.word) === normalize(remove.russian)) {
            puzzleHits.push({ where: `${p.type} ${p.level}/${p.sequence}`, word: w.word });
          }
        }
      }
      const exactHits = puzzleHits.filter((h) => h.word === remove.russian);

      console.log(`   прогресс пользователей на убираемой:  ${progress.length}` +
        (progress.length ? ` (пользователи: ${[...new Set(progress.map((p) => p.userId))].join(", ")})` : ""));
      console.log(`   прогресс на остающейся:               ${keepProgressRows.length}`);
      console.log(`   AudioAsset на убираемой:              ${audio.length}` +
        (audio.length ? ` (${audio.map((a) => a.itemKey).join(", ")})` : ""));
      console.log(`   AudioAsset на остающейся:             ${keepAudio.length}` +
        (keepAudio.length ? ` (${keepAudio.map((a) => a.itemKey).join(", ")})` : ""));
      console.log(`   вхождений слова в пазлы (с нормализацией «ё»): ${puzzleHits.length}` +
        (puzzleHits.length ? ` → ${puzzleHits.map((h) => `${h.where}:«${h.word}»`).join(", ")}` : ""));
      console.log(`   из них написанных ровно как убираемая карточка: ${exactHits.length}`);
      if (exactHits.length > 0) {
        console.log("   ПРИМЕЧАНИЕ: слово в пазле — это текст, а не ссылка на карточку (WordGamePuzzle.words");
        console.log("   хранит слово и подсказку, снятые при генерации), поэтому пазл продолжит работать.");
      }

      work.push({
        removal,
        remove,
        keep,
        progress,
        keepProgress: new Map(keepProgressRows.map((r) => [r.userId, r])),
        audio,
        keepAudio: keepAudio.map((a) => a.itemKey),
        puzzleHits,
      });
    }

    if (refused) {
      console.error("\nОТКАЗ. Ни одна строка не тронута.");
      process.exitCode = 1;
      return;
    }

    if (!APPLY) {
      console.log("\nЗаписи не было (нет --apply).");
      return;
    }

    for (const item of work) {
      await db.$transaction(async (tx) => {
        for (const row of item.progress) {
          const existing = item.keepProgress.get(row.userId);
          if (!existing) {
            await tx.flashcardProgress.update({ where: { id: row.id }, data: { cardId: item.keep.id } });
            continue;
          }
          await tx.flashcardProgress.update({
            where: { id: existing.id },
            data: {
              known: existing.known || row.known,
              box: Math.max(existing.box, row.box),
              correctStreak: Math.max(existing.correctStreak, row.correctStreak),
              lastSeenAt:
                existing.lastSeenAt && row.lastSeenAt
                  ? new Date(Math.max(existing.lastSeenAt.getTime(), row.lastSeenAt.getTime()))
                  : (existing.lastSeenAt ?? row.lastSeenAt),
            },
          });
          await tx.flashcardProgress.delete({ where: { id: row.id } });
        }
        // Озвучка удаляемой карточки — это запись ЕЁ написания. Переносить
        // её на остающуюся нельзя: у «свёкровь» и «свекровь» разный звук.
        // Строка без карточки не читается ничем (ключ — contentId), поэтому
        // она убирается вместе с карточкой; сам файл в Blob не трогается —
        // удалять его отсюда значило бы стирать общий ресурс по локальному
        // решению (золотое правило озвучки, CLAUDE.md).
        if (item.audio.length > 0) {
          await tx.audioAsset.deleteMany({ where: { contentType: "flashcard", contentId: item.remove.id } });
        }
        await tx.flashcardCard.delete({ where: { id: item.remove.id } });
      });
      console.log(`\nУДАЛЕНО: ${item.remove.id} «${item.remove.russian}»; ` +
        `перенесено строк прогресса: ${item.progress.length}; убрано AudioAsset: ${item.audio.length}`);
    }

    const cardsTotalAfter = await db.flashcardCard.count();
    console.log(`\nБАНК: ${cardsTotalBefore} → ${cardsTotalAfter} карточек.`);
  } finally {
    await db.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
