/**
 * Заход 7.171: список мест омографов без годной вырезки (долг 131) —
 * сведённый из журнала повторной вырезки 7.168 и из ЖИВОЙ боевой базы,
 * чтобы ни один из двух источников не поверили на слово.
 *
 * ЛОВУШКА, РАДИ КОТОРОЙ ЭТОТ ШАГ ОТДЕЛЬНЫЙ (класс долга 104, повтор 7.170):
 * в журналах вырезки поле `token` — номер СЛОВА в предложении, а
 * `AudioAsset.itemKey` и поимённый список `check:listen-buttons` называют
 * номер ТОКЕНА (пробелы и знаки препинания тоже токены). Здесь номер
 * пересчитывается и КАЖДОЕ место проверяется утверждением «токен по
 * пересчитанному номеру равен нужному слову».
 *
 *   npx tsx prisma/run-7171/places.ts --journal=<homo2.jsonl> --list=<without.txt> --out=<places.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { splitStoryParagraphs, buildStoryQueue } from "@/lib/stories";
import { isHomograph, storyWordItemKey } from "@/lib/story-word-pick";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const JOURNAL = arg("journal")!;
const LIST = arg("list")!;
const OUT = arg("out");

const WORD_SPLIT_REGEX = /([а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*)/gu;
const CYRILLIC_WORD_REGEX = /^[а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*$/u;

async function main(): Promise<number> {
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const db = new PrismaClient({
    adapter: new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  });

  const journal = readFileSync(JOURNAL, "utf-8").trim().split("\n").map((l) => JSON.parse(l) as {
    id: string; storyId: string; p: number; s: number; token: number; word: string; sentence: string;
    voice: string; url: string; taken: boolean; why?: string;
  });
  const left = journal.filter((r) => !r.taken);
  console.log(`журнал повторной вырезки 7.168: ${journal.length} мест, вышло чисто ${journal.length - left.length}, осталось ${left.length}`);

  const stories = new Map((await db.story.findMany({ select: { id: true, text: true } })).map((s) => [s.id, s.text]));
  const problems: string[] = [];
  const whitespaceOnly: string[] = [];
  const rows = left.map((r) => {
    const text = stories.get(r.storyId);
    const item = text
      ? buildStoryQueue(splitStoryParagraphs(text)).find((q) => q.paragraphIndex === r.p && q.sentenceIndex === r.s)
      : undefined;
    if (!item) { problems.push(`нет предложения ${r.storyId} ${r.p}-${r.s}`); return null; }
    const tokens = item.text.split(WORD_SPLIT_REGEX).filter((t) => t.length > 0);
    const wordPositions: number[] = [];
    tokens.forEach((t, i) => { if (CYRILLIC_WORD_REGEX.test(t)) wordPositions.push(i); });
    const tokenIndex = wordPositions[r.token];
    if (tokenIndex === undefined) { problems.push(`нет слова №${r.token}: ${r.id}`); return null; }
    const tokenText = tokens[tokenIndex];
    if (tokenText.toLowerCase() !== r.word.toLowerCase()) {
      problems.push(`токен «${tokenText}» ≠ слову «${r.word}»: ${r.id}`);
      return null;
    }
    // Сверка с журналом делается по СЛОВАМ: у 15 предложений текст в базе
    // отличается от журнала только пробельными знаками в хвосте, и это не
    // расхождение содержания. Любое другое расхождение — отказ.
    const squash = (t: string) => t.split(/\s+/u).filter(Boolean).join(" ");
    if (squash(item.text) !== squash(r.sentence)) problems.push(`предложение разошлось с журналом: ${r.id}`);
    else if (item.text !== r.sentence) whitespaceOnly.push(r.id);
    return {
      storyId: r.storyId, paragraphIndex: r.p, sentenceIndex: r.s,
      wordIndex: r.token, tokenIndex,
      itemKey: storyWordItemKey({ paragraphIndex: r.p, sentenceIndex: r.s, tokenIndex }),
      word: tokenText, sentence: item.text, voice: r.voice, url: r.url,
      homograph: isHomograph(tokenText), why168: r.why ?? "",
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  console.log(`утверждение «токен по пересчитанному номеру равен слову»: ${rows.length} из ${left.length}`);
  console.log(`все слова — омографы: ${rows.filter((r) => r.homograph).length} из ${rows.length}`);

  // Сверка с поимённым списком «без клипа» ЖИВОЙ боевой базы.
  const live = new Set(
    readFileSync(LIST, "utf-8").trim().split("\n")
      .filter((l) => l.startsWith("рассказы: тап по слову"))
      .map((l) => { const m = /^рассказы: тап по слову\t(\S+) (\S+) /u.exec(l)!; return `${m[1]}|${m[2]}`; }),
  );
  const mine = new Set(rows.map((r) => `${r.storyId}|${r.itemKey}`));
  const onlyLive = [...live].filter((k) => !mine.has(k));
  const onlyMine = [...mine].filter((k) => !live.has(k));
  console.log(`живой список «без клипа»: ${live.size}; мой: ${mine.size}; только у живого: ${onlyLive.length}; только у меня: ${onlyMine.length}`);
  for (const k of [...onlyLive, ...onlyMine].slice(0, 10)) console.log(`  расхождение: ${k}`);

  const stats = {
    мест: rows.length,
    словоформ: new Set(rows.map((r) => r.word.toLowerCase())).size,
    рассказов: new Set(rows.map((r) => r.storyId)).size,
    предложений: new Set(rows.map((r) => `${r.storyId}|${r.paragraphIndex}-${r.sentenceIndex}`)).size,
    знаков: [...new Set(rows.map((r) => `${r.storyId}|${r.paragraphIndex}-${r.sentenceIndex}|${r.sentence}`))]
      .reduce((a, k) => a + k.split("|").slice(2).join("|").length, 0),
  };
  console.log(JSON.stringify(stats, null, 1));
  console.log(`предложений, отличающихся от журнала ТОЛЬКО пробельными знаками: ${whitespaceOnly.length}`);
  if (problems.length) { console.log(`ПРОБЛЕМЫ (${problems.length}):`); for (const p of problems.slice(0, 20)) console.log(`  ${p}`); }
  if (OUT) { writeFileSync(OUT, JSON.stringify(rows, null, 1), "utf-8"); console.log(`список записан: ${OUT}`); }
  return problems.length === 0 && onlyLive.length === 0 && onlyMine.length === 0 ? 0 : 1;
}

main().then((c) => process.exit(c));
