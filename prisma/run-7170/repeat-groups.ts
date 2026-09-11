/**
 * Заход 7.170, часть 1: «одно слово несколько раз в ОДНОМ предложении».
 *
 * ЗАЧЕМ. В 7.166 границы слова брались по ПЕРВОМУ совпадению текста в
 * расшифровке, поэтому у нескольких вхождений одного слова в одном
 * предложении вырезка выходила одинаковой байт в байт (7.168 назвал
 * четыре такие группы, девять мест). Этот скрипт пересчитывает список по
 * ЖИВОЙ боевой базе: все места омографов, сгруппированные по
 * (рассказ, абзац, предложение, словоформа), и для каждого места
 * говорит, где оно сейчас — записано, лежит на слух у владельца, или
 * вырезки нет вовсе.
 *
 *   npx tsx prisma/run-7170/repeat-groups.ts --plan=<plan-cuts.json>
 */
import { readFileSync } from "node:fs";
import { splitStoryParagraphs, buildStoryQueue } from "@/lib/stories";
import { isHomograph } from "@/lib/story-word-pick";

const WORD_SPLIT_REGEX = /([а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*)/gu;
const CYRILLIC_WORD_REGEX = /^[а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*$/u;
const PLAN = process.argv.find((a) => a.startsWith("--plan="))?.slice(7);

async function main() {
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const db = new PrismaClient({
    adapter: new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  });

  const written = new Set(
    (
      await db.audioAsset.findMany({
        where: { contentType: "story-word" },
        select: { contentId: true, itemKey: true },
      })
    ).map((r) => `${r.contentId}|${r.itemKey}`),
  );
  const onEar = new Map<string, string>();
  if (PLAN) {
    const plan = JSON.parse(readFileSync(PLAN, "utf-8")) as {
      rows: { storyId: string; itemKey: string; file: string; sha256: string }[];
    };
    for (const r of plan.rows) onEar.set(`${r.storyId}|${r.itemKey}`, `${r.file} sha ${r.sha256.slice(0, 8)}`);
  }

  const stories = await db.story.findMany({ select: { id: true, text: true } });
  type Place = { storyId: string; p: number; s: number; token: number; word: string };
  const places: Place[] = [];
  for (const story of stories) {
    for (const item of buildStoryQueue(splitStoryParagraphs(story.text))) {
      const tokens = item.text.split(WORD_SPLIT_REGEX).filter((t) => t.length > 0);
      tokens.forEach((token, i) => {
        if (!CYRILLIC_WORD_REGEX.test(token)) return;
        if (!isHomograph(token)) return;
        places.push({
          storyId: story.id,
          p: item.paragraphIndex,
          s: item.sentenceIndex,
          token: i,
          word: token,
        });
      });
    }
  }
  console.log(`мест омографов всего: ${places.length}`);

  const groups = new Map<string, Place[]>();
  for (const pl of places) {
    const k = `${pl.storyId}|${pl.p}-${pl.s}|${pl.word.toLowerCase()}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(pl);
  }
  const repeats = [...groups.entries()].filter(([, v]) => v.length > 1);
  console.log(
    `групп «одно слово несколько раз в одном предложении»: ${repeats.length}, мест в них: ${repeats.reduce((a, [, v]) => a + v.length, 0)}`,
  );
  for (const [k, v] of repeats.sort()) {
    console.log(`  ${k}`);
    for (const pl of v) {
      const key = `${pl.storyId}|${pl.p}-${pl.s}-${pl.token}`;
      const state = written.has(key)
        ? "ЗАПИСАНО на проде"
        : onEar.has(key)
          ? `на слух: ${onEar.get(key)}`
          : "вырезки нет вовсе";
      console.log(`    токен ${pl.token} → ${state}`);
    }
  }
}

main();
