/**
 * Заход 7.171, часть 4: план папки «на слух».
 *
 * Сводит три источника (долг 134, метод Б, метод А) в один список, и
 * ДОБАВЛЯЕТ к каждому месту то, чего в звуковых журналах нет: русское
 * название рассказа и `itemKey` строки `AudioAsset`.
 *
 * ЛОВУШКА ТА ЖЕ, ЧТО В 7.170 (класс долга 104): в звуковых журналах
 * `wordIndex` — номер СЛОВА в предложении, а `itemKey` называется номером
 * ТОКЕНА (пробелы и знаки препинания — тоже токены). Пересчёт делается
 * здесь, и КАЖДОЕ место проверяется утверждением «токен по пересчитанному
 * номеру равен нужному слову». Ни одна строка без этого утверждения в
 * план не попадает.
 *
 *   npx tsx prisma/run-7171/listen-plan.ts --work=<папка работы> --out=<файл.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { splitStoryParagraphs, buildStoryQueue } from "@/lib/stories";
import { isHomograph, storyWordItemKey } from "@/lib/story-word-pick";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const WORK = arg("work")!;
const OUT = arg("out")!;
/** Источник текстов рассказов. Боевая база в этот момент ОТДАЁТ ОТКАЗ
 *  («SQL read operations are forbidden» — исчерпана квота чтений, см. отчёт
 *  7.171), поэтому названия и тексты берутся из локальной копии, а связь с
 *  продом держится сверкой: каждый пересчитанный `tokenIndex` обязан совпасть
 *  с тем, который снят с ЖИВОЙ базы шагом `places.ts`. Расхождение — отказ. */
const STORIES = arg("stories");
const CROSS = arg("cross");

const WORD_SPLIT_REGEX = /([а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*)/gu;
const CYRILLIC_WORD_REGEX = /^[а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*$/u;

interface Src {
  storyId: string; paragraphIndex: number; sentenceIndex: number; wordIndex: number;
  word: string; sentence: string; voice?: string; wav?: string; taken?: boolean;
  auditRejected?: boolean; vowelN?: number; vowelWhy?: string; why?: string; sha256?: string;
}

const jsonl = (p: string): Src[] => readFileSync(p, "utf-8").trim().split("\n").map((l) => JSON.parse(l));

async function main(): Promise<number> {
  const db = STORIES
    ? (null as unknown as { story: { findMany: (a: unknown) => Promise<{ id: string; title: string; text: string }[]> } })
    : await (async () => {
        const { PrismaClient } = await import("@/generated/prisma/client");
        const { PrismaLibSql } = await import("@prisma/adapter-libsql");
        return new PrismaClient({
          adapter: new PrismaLibSql({
            url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
            authToken: process.env.TURSO_AUTH_TOKEN,
          }),
        });
      })();

  const stressBQ = JSON.parse(readFileSync(join(WORK, "stress-BQ.json"), "utf-8")) as
    Record<string, { vowelN: number; why: string }>;

  const groups: { folder: "134" | "Б" | "А"; rows: Src[] }[] = [
    // У журнала долга 134 абзац и предложение названы короткими `p`/`s` —
    // приводим к общим именам, а не читаем два формата по всему файлу.
    { folder: "134", rows: (JSON.parse(readFileSync(join(WORK, "134.json"), "utf-8")) as (Src & { p: number; s: number })[])
        .filter((r) => r.taken)
        .map((r) => ({ ...r, paragraphIndex: r.p, sentenceIndex: r.s })) },
    { folder: "Б", rows: jsonl(join(WORK, "B-work.jsonl")).filter((r) => r.taken) },
    { folder: "А", rows: jsonl(join(WORK, "A.jsonl")).filter((r) => r.wav) },
  ];

  const stories = new Map<string, { id: string; title: string; text: string }>(
    (STORIES
      ? (JSON.parse(readFileSync(STORIES, "utf-8")) as { id: string; title: string; text: string }[])
      : await db.story.findMany({ select: { id: true, title: true, text: true } })
    ).map((s) => [s.id, s]),
  );
  const cross = new Map<string, number>(
    CROSS
      ? (JSON.parse(readFileSync(CROSS, "utf-8")) as { storyId: string; paragraphIndex: number; sentenceIndex: number; wordIndex: number; tokenIndex: number }[])
          .map((r) => [`${r.storyId}|${r.paragraphIndex}-${r.sentenceIndex}-${r.wordIndex}`, r.tokenIndex])
      : [],
  );
  let crossed = 0;

  const problems: string[] = [];
  const out: Record<string, unknown>[] = [];
  let n = 0;
  for (const { folder, rows } of groups) {
    for (const r of rows) {
      const story = stories.get(r.storyId);
      if (!story) { problems.push(`нет рассказа ${r.storyId}`); continue; }
      const item = buildStoryQueue(splitStoryParagraphs(story.text))
        .find((q) => q.paragraphIndex === r.paragraphIndex && q.sentenceIndex === r.sentenceIndex);
      if (!item) { problems.push(`нет предложения ${r.storyId} ${r.paragraphIndex}-${r.sentenceIndex}`); continue; }
      const tokens = item.text.split(WORD_SPLIT_REGEX).filter((t) => t.length > 0);
      const wordPositions: number[] = [];
      tokens.forEach((t, i) => { if (CYRILLIC_WORD_REGEX.test(t)) wordPositions.push(i); });
      const tokenIndex = wordPositions[r.wordIndex];
      if (tokenIndex === undefined) { problems.push(`нет слова №${r.wordIndex}: ${r.storyId}`); continue; }
      const tokenText = tokens[tokenIndex];
      if (tokenText.toLowerCase() !== r.word.toLowerCase()) {
        problems.push(`токен «${tokenText}» ≠ слову «${r.word}»: ${r.storyId} ${r.paragraphIndex}-${r.sentenceIndex}`);
        continue;
      }
      const key = `${r.storyId}|${r.paragraphIndex}-${r.sentenceIndex}-${r.wordIndex}`;
      const fromProd = cross.get(key);
      if (fromProd !== undefined) {
        if (fromProd !== tokenIndex) { problems.push(`tokenIndex ${tokenIndex} ≠ снятому с прода ${fromProd}: ${key}`); continue; }
        crossed += 1;
      }
      const st = folder === "А" ? { vowelN: r.vowelN!, why: r.vowelWhy ?? "" } : stressBQ[key];
      if (!st) { problems.push(`нет ожидаемого ударения: ${key}`); continue; }
      out.push({
        n: ++n, folder, storyId: r.storyId, title: story.title,
        paragraphIndex: r.paragraphIndex, sentenceIndex: r.sentenceIndex,
        wordIndex: r.wordIndex, tokenIndex,
        itemKey: storyWordItemKey({ paragraphIndex: r.paragraphIndex, sentenceIndex: r.sentenceIndex, tokenIndex }),
        word: tokenText, sentence: item.text, voice: r.voice ?? "",
        wav: r.wav, vowelN: st.vowelN, vowelWhy: st.why,
        method: folder === "134" ? "134 (перевырезка своего вхождения)" : folder === "Б" ? "Б (перевырезка из оплаченной озвучки)" : "А (новая запись со знаком ударения)",
        auditRejected: Boolean(r.auditRejected),
        auditWhy: r.auditRejected ? (r.why ?? "") : "",
        homograph: isHomograph(tokenText),
      });
    }
  }

  console.log(`строк в плане: ${out.length}`);
  for (const f of ["134", "Б", "А"]) console.log(`  ${f}: ${out.filter((r) => r.folder === f).length}`);
  console.log(`из них отклонено аудитом: ${out.filter((r) => r.auditRejected).length}`);
  console.log(`утверждение «токен по пересчитанному номеру равен слову»: ${out.length} из ${out.length + problems.length}`);
  console.log(`сверено с номерами, снятыми с ЖИВОЙ боевой базы: ${crossed} из ${out.length}`);
  console.log(`все слова — омографы: ${out.filter((r) => r.homograph).length} из ${out.length}`);
  const keys = new Set(out.map((r) => `${r.storyId}|${r.itemKey}`));
  console.log(`различных мест: ${keys.size} (повторов ${out.length - keys.size})`);
  console.log(`различных рассказов: ${new Set(out.map((r) => r.storyId)).size}, словоформ: ${new Set(out.map((r) => String(r.word).toLowerCase())).size}`);
  if (problems.length) { console.log(`ПРОБЛЕМЫ (${problems.length}):`); for (const p of problems.slice(0, 20)) console.log(`  ${p}`); }
  writeFileSync(OUT, JSON.stringify(out, null, 1), "utf-8");
  console.log(`план записан: ${OUT}`);
  return problems.length === 0 && keys.size === out.length ? 0 : 1;
}

main().then((c) => process.exit(c));
