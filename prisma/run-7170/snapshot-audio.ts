/**
 * Снимок всех строк `AudioAsset` боевой базы + отпечаток пар (id, audioUrl).
 * Порядок 7 паспорта озвучки: снимок до записи, отпечаток после — знак в знак.
 *
 *   npx tsx prisma/run-7170/snapshot-audio.ts --out=<файл.json>
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6);

async function main() {
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const db = new PrismaClient({
    adapter: new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  });
  const rows = await db.audioAsset.findMany({
    select: {
      id: true,
      contentType: true,
      contentId: true,
      itemKey: true,
      text: true,
      audioUrl: true,
      voice: true,
      model: true,
    },
    orderBy: { id: "asc" },
  });
  const fp = createHash("sha256");
  for (const r of rows) fp.update(`${r.id} ${r.audioUrl}\n`);
  console.log(`строк AudioAsset: ${rows.length}`);
  console.log(`отпечаток sha256 по парам (id, audioUrl): ${fp.digest("hex")}`);
  const byType = new Map<string, number>();
  for (const r of rows) byType.set(r.contentType, (byType.get(r.contentType) ?? 0) + 1);
  for (const [k, v] of [...byType].sort()) console.log(`  ${k}: ${v}`);
  if (OUT) {
    writeFileSync(OUT, JSON.stringify(rows, null, 2), "utf-8");
    console.log(`снимок записан: ${OUT} (${rows.length} строк)`);
  }
}

main();
