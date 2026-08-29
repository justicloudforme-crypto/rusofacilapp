/**
 * Dumps every WordGamePuzzle row to a JSON file OUTSIDE the repository,
 * plus the WordGameProgress row count and id set, so a puzzle
 * regeneration can be undone and so "did anything else move?" is a
 * question with an answer rather than an opinion.
 *
 * Written for the production rollout of the themed free puzzles
 * (PROGRESS.md section 7): the generator only ever UPDATEs, never deletes
 * and recreates, because WordGameProgress.puzzleId cascades — but "the
 * code should not lose progress" is a claim, and a dump taken before the
 * write is what makes it checkable afterwards.
 *
 * Usage:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... \
 *     npx tsx prisma/backup-word-games.ts /path/outside/repo/backup.json
 *
 * With no credentials it dumps the local dev.db, which is how the restore
 * script below was tested.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

const out = process.argv[2];
if (!out) {
  console.error("Usage: tsx prisma/backup-word-games.ts <output.json>");
  process.exit(1);
}
// A backup inside the working tree is one `git clean` away from being
// gone, and would also be a candidate for accidental commit.
if (resolve(out).startsWith(resolve(process.cwd()))) {
  console.error(`Refusing to write the backup inside the repository: ${resolve(out)}`);
  console.error("Pass a path outside the working tree.");
  process.exit(1);
}

async function main() {
  const puzzles = await db.wordGamePuzzle.findMany({
    select: {
      id: true, type: true, level: true, sequence: true,
      curved: true, premiumOnly: true, topic: true,
      gridData: true, words: true,
    },
    orderBy: [{ type: "asc" }, { level: "asc" }, { sequence: "asc" }],
  });
  const progress = await db.wordGameProgress.findMany({ select: { id: true, puzzleId: true } });

  const payload = {
    takenAt: new Date().toISOString(),
    database: process.env.TURSO_DATABASE_URL ? "turso (production)" : "local dev.db",
    puzzleCount: puzzles.length,
    progressCount: progress.length,
    progressIds: progress.map((p) => p.id).sort(),
    puzzles,
  };
  writeFileSync(out, JSON.stringify(payload, null, 1));

  const themed = puzzles.filter((p) => p.topic !== null).length;
  console.log(`wrote ${out}`);
  console.log(`  source            : ${payload.database}`);
  console.log(`  WordGamePuzzle    : ${puzzles.length} rows (${themed} with a topic)`);
  console.log(`  WordGameProgress  : ${progress.length} rows`);
  console.log(`  distinct puzzle ids: ${new Set(puzzles.map((p) => p.id)).size}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
