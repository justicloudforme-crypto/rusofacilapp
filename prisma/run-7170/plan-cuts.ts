/**
 * Заход 7.170, часть 1 и часть 3: план записи 420 одобренных владельцем
 * вырезок омографов на прод.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ШАГ «ПЛАН». Имя файла в папке владельца называет место
 * словами `<слово>_<хвост id рассказа>_<абзац>-<предложение>-<НОМЕР СЛОВА>`,
 * а `AudioAsset.itemKey` вырезки называется `<абзац>-<предложение>-<НОМЕР
 * ТОКЕНА>`: продукт (`StoryText.tsx`) нумерует токены СПЛОШЬ — пробелы и
 * знаки препинания тоже токены. Две нумерации нельзя смешивать молча
 * (класс долга 104), поэтому номер пересчитывается здесь и каждое место
 * проверяется утверждением «токен по новому номеру равен нужному слову».
 *
 * Запускать из корня репозитория:
 *   npx tsx prisma/run-7170/plan-cuts.ts --out=<файл.json>
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { splitStoryParagraphs, buildStoryQueue } from "@/lib/stories";
import { isHomograph, storyWordItemKey } from "@/lib/story-word-pick";

const DIR = join(homedir(), "rusofacil-listen", "7.168", "на-слух");
const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6);

/** Те же два выражения, что у `StoryText.tsx` и `check-listen-buttons.ts`. */
const WORD_SPLIT_REGEX = /([а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*)/gu;
const CYRILLIC_WORD_REGEX = /^[а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*$/u;

export interface PlanRow {
  file: string;
  part: "C" | "N";
  ordinal: number;
  word: string;
  storySuffix: string;
  storyId: string;
  paragraphIndex: number;
  sentenceIndex: number;
  /** номер СЛОВА в предложении — так назван файл */
  wordIndex: number;
  /** номер ТОКЕНА в предложении — так называется itemKey */
  tokenIndex: number;
  itemKey: string;
  /** токен из текста рассказа по пересчитанному номеру */
  tokenText: string;
  sha256: string;
  bytes: number;
  homograph: boolean;
}

async function main(): Promise<number> {
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const db = new PrismaClient({
    adapter: new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  });

  const files = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".wav")).sort();
  const stories = await db.story.findMany({ select: { id: true, text: true } });
  const bySuffix = new Map<string, { id: string; text: string }[]>();
  for (const s of stories) {
    const k = s.id.slice(-6);
    if (!bySuffix.has(k)) bySuffix.set(k, []);
    bySuffix.get(k)!.push(s);
  }

  const rows: PlanRow[] = [];
  const problems: string[] = [];

  for (const file of files) {
    const m = /^([CN])(\d+)_(.+)_([0-9a-z]{6})_(\d+)-(\d+)-(\d+)\.wav$/u.exec(file);
    if (!m) { problems.push(`имя не разобрано: ${file}`); continue; }
    const [, part, ordinal, word, suffix, p, s, w] = m;
    const cand = bySuffix.get(suffix);
    if (!cand || cand.length !== 1) {
      problems.push(`хвост id «${suffix}» даёт ${cand?.length ?? 0} рассказов: ${file}`);
      continue;
    }
    const story = cand[0];
    const item = buildStoryQueue(splitStoryParagraphs(story.text)).find(
      (q) => q.paragraphIndex === Number(p) && q.sentenceIndex === Number(s),
    );
    if (!item) { problems.push(`нет предложения ${p}-${s}: ${file}`); continue; }
    const tokens = item.text.split(WORD_SPLIT_REGEX).filter((t) => t.length > 0);
    const wordPositions: number[] = [];
    tokens.forEach((t, i) => { if (CYRILLIC_WORD_REGEX.test(t)) wordPositions.push(i); });
    const tokenIndex = wordPositions[Number(w)];
    if (tokenIndex === undefined) { problems.push(`нет слова №${w}: ${file}`); continue; }
    const tokenText = tokens[tokenIndex];
    if (tokenText.toLowerCase() !== word.toLowerCase()) {
      problems.push(`токен «${tokenText}» ≠ слову «${word}»: ${file}`);
      continue;
    }
    const buf = readFileSync(join(DIR, file));
    rows.push({
      file, part: part as "C" | "N", ordinal: Number(ordinal), word,
      storySuffix: suffix, storyId: story.id,
      paragraphIndex: Number(p), sentenceIndex: Number(s), wordIndex: Number(w),
      tokenIndex, itemKey: storyWordItemKey({ paragraphIndex: Number(p), sentenceIndex: Number(s), tokenIndex }),
      tokenText, sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.byteLength,
      homograph: isHomograph(tokenText),
    });
  }

  console.log(`файлов в папке: ${files.length}`);
  console.log(`  часть C: ${rows.filter((r) => r.part === "C").length}, часть N: ${rows.filter((r) => r.part === "N").length}`);
  console.log(`мест разобрано: ${rows.length}`);
  console.log(`утверждение «токен по новому номеру равен слову»: ${rows.length} из ${files.length}`);
  console.log(`все слова — омографы: ${rows.filter((r) => r.homograph).length} из ${rows.length}`);
  console.log(`различных рассказов: ${new Set(rows.map((r) => r.storyId)).size}`);
  console.log(`различных словоформ: ${new Set(rows.map((r) => r.word.toLowerCase())).size}`);
  const keys = new Set(rows.map((r) => `${r.storyId}|${r.itemKey}`));
  console.log(`различных мест (storyId|itemKey): ${keys.size}`);
  const hashes = new Map<string, string[]>();
  for (const r of rows) {
    if (!hashes.has(r.sha256)) hashes.set(r.sha256, []);
    hashes.get(r.sha256)!.push(r.file);
  }
  const dupes = [...hashes.values()].filter((v) => v.length > 1);
  console.log(`различных sha256: ${hashes.size}; групп одинаковых байт в байт: ${dupes.length}`);
  for (const g of dupes) console.log(`  одинаковы: ${g.join(" · ")}`);
  if (problems.length) {
    console.log(`ПРОБЛЕМЫ (${problems.length}):`);
    for (const p of problems) console.log(`  ${p}`);
  }

  // Повтор слова в одном предложении: одно слово несколько раз в одном
  // (рассказ, абзац, предложение).
  const groups = new Map<string, PlanRow[]>();
  for (const r of rows) {
    const k = `${r.storyId}|${r.paragraphIndex}-${r.sentenceIndex}|${r.word.toLowerCase()}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const repeats = [...groups.entries()].filter(([, v]) => v.length > 1);
  console.log(`групп «одно слово несколько раз в одном предложении»: ${repeats.length}, мест в них: ${repeats.reduce((a, [, v]) => a + v.length, 0)}`);
  for (const [k, v] of repeats) {
    console.log(`  ${k} → ${v.map((r) => `${r.file} (токен ${r.tokenIndex}, sha ${r.sha256.slice(0, 8)})`).join(" · ")}`);
  }

  if (OUT) {
    writeFileSync(OUT, JSON.stringify({ dir: DIR, files: files.length, rows }, null, 2), "utf-8");
    console.log(`план записан: ${OUT}`);
  }
  return problems.length === 0 ? 0 : 1;
}

main().then((c) => process.exit(c));
