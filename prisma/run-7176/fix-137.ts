/**
 * Заход 7.176, часть 3: долг 137 — один `UPDATE` одной колонки.
 *
 * У строки `story-word` «писать» (рассказ «Ванька», `2-0-32`) в колонке
 * `voice` стоит `echo`, а предложение читает `onyx`. Звук при этом
 * ВЕРНЫЙ: строка сделана методом `cut-from-story-audio`, то есть вырезана
 * из оплаченной озвучки самого предложения. Это доказано не ссылкой на
 * журнал, а звуком: декодированная вырезка найдена ВНУТРИ декодированной
 * записи предложения с нормированной взаимной корреляцией 0,9999, тогда
 * как у трёх чужих предложений того же рассказа максимум 0,24…0,35
 * (`prisma/run-7176/ncc.mjs`). Врёт только подпись.
 *
 * Скрипт правит РОВНО одну колонку РОВНО одной строки, и только если
 * строка на проде всё ещё та самая: тип, рассказ, ключ места, текст,
 * модель и нынешний голос сверяются ДО записи. Любое расхождение —
 * отказ. `audioUrl` не трогается вовсе.
 *
 *   npx tsx prisma/run-7176/fix-137.ts --dry-run
 *   npx tsx prisma/run-7176/fix-137.ts
 */
import { isEntryPoint } from "@/lib/entry-point";

const DRY = process.argv.includes("--dry-run");

const ROW = {
  id: "cmtw35rpo00jw7yncaw8kguh3",
  contentType: "story-word",
  contentId: "cmsxtq0gh0005qwncjblja933",
  itemKey: "2-0-32",
  text: "писать",
  model: "cut-from-story-audio",
  from: "echo",
  to: "onyx",
} as const;

async function main(): Promise<number> {
  const url = process.env.TURSO_DATABASE_URL ?? "";
  if (!/^libsql:\/\//.test(url)) { console.error(`ОТКАЗ: TURSO_DATABASE_URL не боевой (${url})`); return 2; }
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const db = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN }) });

  const before = await db.audioAsset.findUnique({
    where: { id: ROW.id },
    select: { id: true, contentType: true, contentId: true, itemKey: true, text: true, voice: true, model: true, audioUrl: true, durationSeconds: true },
  });
  console.log("СНИМОК СТРОКИ ДО:");
  console.log(`  ${JSON.stringify(before)}`);
  if (!before) { console.error("ОТКАЗ: строки нет на проде"); await db.$disconnect(); return 1; }

  const mismatch: string[] = [];
  for (const k of ["contentType", "contentId", "itemKey", "text", "model"] as const) {
    if (before[k] !== ROW[k]) mismatch.push(`${k}: «${before[k]}» ≠ «${ROW[k]}»`);
  }
  if (before.voice !== ROW.from) mismatch.push(`voice: «${before.voice}» ≠ ожидаемому «${ROW.from}»`);
  console.log(`строк к правке: 1; расхождений со снимком: ${mismatch.length}`);
  for (const m of mismatch) console.log(`  ${m}`);
  console.log(`правка: voice «${ROW.from}» → «${ROW.to}»; audioUrl НЕ трогается`);

  if (DRY) {
    console.log("--dry-run: на прод не отправлено ничего.");
    const again = await db.audioAsset.findUnique({ where: { id: ROW.id }, select: { voice: true } });
    console.log(`перечитывание после сухого прогона: voice = «${again?.voice}» (обязано остаться «${ROW.from}»)`);
    await db.$disconnect();
    return mismatch.length === 0 && again?.voice === ROW.from ? 0 : 1;
  }
  if (mismatch.length > 0) { console.error("ОТКАЗ: строка не та, запись не начиналась."); await db.$disconnect(); return 1; }

  const n = await db.audioAsset.updateMany({
    where: { id: ROW.id, contentType: ROW.contentType, contentId: ROW.contentId, itemKey: ROW.itemKey, voice: ROW.from },
    data: { voice: ROW.to },
  });
  console.log(`UPDATE: затронуто строк ${n.count}`);

  const after = await db.audioAsset.findUnique({
    where: { id: ROW.id },
    select: { id: true, voice: true, model: true, audioUrl: true, durationSeconds: true },
  });
  console.log("ПЕРЕЧИТЫВАНИЕ ПОСЛЕ:");
  console.log(`  ${JSON.stringify(after)}`);
  const ok = n.count === 1 && after?.voice === ROW.to && after?.audioUrl === before.audioUrl && after?.durationSeconds === before.durationSeconds;
  console.log(ok ? "PASS — голос исправлен, адрес и длительность не сдвинулись" : "FAIL");
  console.log(`ОТКАТ: npx tsx -e "…update AudioAsset set voice='${ROW.from}' where id='${ROW.id}'"`);
  await db.$disconnect();
  return ok ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) main().then((c) => process.exit(c));
