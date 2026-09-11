/**
 * Заход 7.170, часть 4 (долг 128): 40 пар «Синонимов и антонимов»,
 * подтверждённых владельцем, вписываются в поля `synonyms`/`antonyms`.
 *
 * НОВЫХ КАРТОЧЕК 0, НОВОЙ ОЗВУЧКИ 0. Все пары уже лежат в банке, а сама
 * пара выводится обычным текстом и своей кнопки «слушать» не имеет
 * (паспорт озвучки, раздел 4) — поэтому `check:listen-buttons` от этой
 * записи не обязан сдвинуться ни на единицу.
 *
 * ЧТО ПРОВЕРЯЕТСЯ ДО ЗАПИСИ, а не после:
 *   * карточка-хозяйка существует, лежит в теме `synonymsAntonyms` и
 *     сейчас пуста по ОБОИМ полям (иначе это не «дописать пару», а
 *     переписать чужую работу — отказ);
 *   * карточка-пара существует по своему id И её `russian` совпадает с
 *     названным словом. Id из таблицы 7.169 переписан руками, и опечатка
 *     в нём дала бы пару на чужое слово молча;
 *   * пара не ссылается сама на себя.
 *
 *   npx tsx prisma/run-7170/apply-antonym-pairs.ts --data=<файл.json> [--dry-run]
 */
import { readFileSync } from "node:fs";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const DATA = arg("data")!;
const DRY = process.argv.includes("--dry-run");

interface Pair { n: number; word: string; kind: "synonyms" | "antonyms"; pairWord: string; pairId: string; translation: string }

async function main(): Promise<number> {
  const file = JSON.parse(readFileSync(DATA, "utf-8")) as { pairs: Pair[]; left_empty: { word: string }[] };
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const db = new PrismaClient({
    adapter: new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  });

  const topic = await db.flashcardCard.findMany({
    where: { category: "synonymsAntonyms" },
    select: { id: true, russian: true, level: true, translationEs: true, synonyms: true, antonyms: true },
  });
  const publicCards = topic.filter((c) => c.level !== "C1");
  const emptyBefore = publicCards.filter((c) => c.synonyms === "[]" && c.antonyms === "[]");
  console.log(`карточек темы: ${topic.length}, на публичных уровнях: ${publicCards.length}, без пары ДО: ${emptyBefore.length}`);

  const plan: { id: string; word: string; kind: string; value: string; pairWord: string }[] = [];
  const refused: string[] = [];

  for (const p of file.pairs) {
    const owner = publicCards.filter((c) => c.russian === p.word);
    if (owner.length !== 1) { refused.push(`${p.n} «${p.word}»: карточек-хозяек ${owner.length}`); continue; }
    const o = owner[0];
    if (o.synonyms !== "[]" || o.antonyms !== "[]") { refused.push(`${p.n} «${p.word}»: пара уже вписана (syn ${o.synonyms}, ant ${o.antonyms})`); continue; }
    const pairCard = await db.flashcardCard.findUnique({ where: { id: p.pairId }, select: { id: true, russian: true, translationEs: true, category: true, level: true } });
    if (!pairCard) { refused.push(`${p.n} «${p.word}»: карточки-пары ${p.pairId} в банке нет`); continue; }
    if (pairCard.russian !== p.pairWord) { refused.push(`${p.n} «${p.word}»: id ${p.pairId} — это «${pairCard.russian}», а не «${p.pairWord}»`); continue; }
    if (pairCard.id === o.id) { refused.push(`${p.n} «${p.word}»: пара ссылается сама на себя`); continue; }
    plan.push({ id: o.id, word: p.word, kind: p.kind, pairWord: p.pairWord, value: JSON.stringify([{ word: p.pairWord, translation: p.translation }]) });
  }

  console.log(`ПЛАН: строк к правке ${plan.length} из ${file.pairs.length}; отказов ${refused.length}`);
  for (const r of refused) console.log(`  ОТКАЗ ${r}`);
  console.log(`оставлено пустым сознательно: ${file.left_empty.map((x) => `«${x.word}»`).join(", ")}`);
  console.log(`ожидается «без пары» ПОСЛЕ: ${emptyBefore.length - plan.length}`);
  if (DRY) { await db.$disconnect(); return refused.length === 0 ? 0 : 1; }

  let done = 0;
  for (const row of plan) {
    await db.flashcardCard.update({ where: { id: row.id }, data: { [row.kind]: row.value } });
    done++;
  }
  const after = await db.flashcardCard.findMany({ where: { category: "synonymsAntonyms" }, select: { russian: true, level: true, synonyms: true, antonyms: true } });
  const emptyAfter = after.filter((c) => c.level !== "C1" && c.synonyms === "[]" && c.antonyms === "[]");
  console.log(`ЗАПИСАНО: ${done}; «без пары» ${emptyBefore.length} → ${emptyAfter.length} (${emptyAfter.map((c) => `«${c.russian}»`).join(", ")})`);
  await db.$disconnect();
  return refused.length === 0 ? 0 : 1;
}

main().then((c) => process.exit(c));
