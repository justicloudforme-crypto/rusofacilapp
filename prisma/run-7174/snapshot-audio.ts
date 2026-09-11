/**
 * Заход 7.174: снимок всех строк `AudioAsset` + отпечаток пар
 * (id, audioUrl). Пункты 1 и 6 паспорта озвучки.
 *
 * Источник снимка — на выбор, и это не украшение, а бюджет чтений
 * (долг 135):
 *   * без флага — ЛОКАЛЬНЫЙ снимок прода (`prisma/snapshots/prod-latest.db`),
 *     снятый `npm run snapshot:prod`; боевых чтений 0;
 *   * `--against-prod` — боевая база; цена печатается заранее и равна
 *     числу строк `AudioAsset` (36 316 на 11.09.2026).
 *
 *   npx tsx prisma/run-7174/snapshot-audio.ts --out=<файл.json> [--against-prod]
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import Database from "better-sqlite3";
import path from "node:path";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const OUT = arg("out");
const SNAPSHOT = arg("snapshot") ?? "prisma/snapshots/prod-latest.db";
const AGAINST_PROD = process.argv.includes("--against-prod");

interface Row {
  id: string; contentType: string; contentId: string; itemKey: string;
  text: string; audioUrl: string; voice: string; model: string; durationSeconds: number | null;
}

async function fromProd(): Promise<Row[]> {
  console.log("ПРОТИВ БОЕВОЙ БАЗЫ. Ожидаемая цена — 36 316 просмотренных строк (вся таблица AudioAsset).");
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const url = process.env.TURSO_DATABASE_URL ?? "";
  if (!/^libsql:\/\//.test(url)) { throw new Error(`--against-prod задан, а TURSO_DATABASE_URL не боевой (${url})`); }
  const db = new PrismaClient({
    adapter: new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN }),
  });
  const rows = await db.audioAsset.findMany({
    select: { id: true, contentType: true, contentId: true, itemKey: true, text: true,
      audioUrl: true, voice: true, model: true, durationSeconds: true },
    orderBy: { id: "asc" },
  });
  await db.$disconnect();
  return rows as Row[];
}

function fromSnapshot(): Row[] {
  console.log(`по снимку прода: ${SNAPSHOT} (боевая база не читается, цена 0 строк)`);
  const db = new Database(path.resolve(SNAPSHOT), { readonly: true });
  const rows = db.prepare(
    "select id, contentType, contentId, itemKey, text, audioUrl, voice, model, durationSeconds from AudioAsset order by id asc",
  ).all() as unknown as Row[];
  db.close();
  return rows;
}

async function main() {
  const rows = AGAINST_PROD ? await fromProd() : fromSnapshot();
  const fp = createHash("sha256");
  for (const r of rows) fp.update(`${r.id} ${r.audioUrl}\n`);
  console.log(`строк AudioAsset: ${rows.length}`);
  console.log(`отпечаток sha256 по парам (id, audioUrl): ${fp.digest("hex")}`);
  const byType = new Map<string, number>();
  for (const r of rows) byType.set(r.contentType, (byType.get(r.contentType) ?? 0) + 1);
  for (const [k, v] of [...byType].sort()) console.log(`  ${k}: ${v}`);
  if (OUT) { writeFileSync(OUT, JSON.stringify(rows, null, 1), "utf-8"); console.log(`снимок записан: ${OUT}`); }
}

main();
