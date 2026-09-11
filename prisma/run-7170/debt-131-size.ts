/**
 * Заход 7.170, часть 5: размер долга 131 — 217 мест омографов без
 * вырезки. Ничего не синтезирует и не пишет: только считает, во что
 * обойдётся каждый из предложенных владельцу вариантов.
 *
 *   npx tsx prisma/run-7170/debt-131-size.ts --list=<without-after.txt>
 */
import { readFileSync } from "node:fs";
import { splitStoryParagraphs, buildStoryQueue } from "@/lib/stories";

const LIST = process.argv.find((a) => a.startsWith("--list="))?.slice(7) ?? "";

async function main() {
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const db = new PrismaClient({
    adapter: new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  });

  const places = readFileSync(LIST, "utf-8").trim().split("\n")
    .filter((l) => l.startsWith("рассказы: тап по слову"))
    .map((l) => {
      const m = /^рассказы: тап по слову\t(\S+) (\d+)-(\d+)-(\d+) (\S+)/u.exec(l)!;
      return { storyId: m[1], p: Number(m[2]), s: Number(m[3]), token: Number(m[4]), word: m[5] };
    });
  console.log(`мест без вырезки: ${places.length}`);
  console.log(`различных словоформ: ${new Set(places.map((x) => x.word.toLowerCase())).size}`);
  console.log(`различных рассказов: ${new Set(places.map((x) => x.storyId)).size}`);

  const stories = new Map((await db.story.findMany({ select: { id: true, text: true } })).map((s) => [s.id, s.text]));
  const sentences = new Map<string, string>();
  for (const pl of places) {
    const text = stories.get(pl.storyId);
    if (!text) continue;
    const item = buildStoryQueue(splitStoryParagraphs(text)).find((q) => q.paragraphIndex === pl.p && q.sentenceIndex === pl.s);
    if (item) sentences.set(`${pl.storyId}|${pl.p}-${pl.s}`, item.text);
  }
  const chars = [...sentences.values()].reduce((a, t) => a + t.length, 0);
  console.log(`различных предложений: ${sentences.size}, знаков в них: ${chars}`);
  // Тариф банка: gpt-4o-mini-tts, $0,60 за 1 млн знаков ввода
  // (те же числа, которыми считались все прежние заходы).
  console.log(`пересинтез этих предложений целиком: ≈$${((chars / 1_000_000) * 0.6).toFixed(3)}`);
  const words = [...new Set(places.map((x) => x.word.toLowerCase()))];
  const wordChars = words.reduce((a, w) => a + w.length, 0);
  console.log(`изолированный клип на каждую словоформу (ЗАПРЕЩЁН правилом): ${words.length} слов, ${wordChars} знаков, ≈$${((wordChars / 1_000_000) * 0.6).toFixed(4)}`);
  console.log(`клип на каждое МЕСТО отдельным синтезом слова: ${places.length} клипов, ≈$${((places.reduce((a, x) => a + x.word.length, 0) / 1_000_000) * 0.6).toFixed(4)}`);
}

main();
