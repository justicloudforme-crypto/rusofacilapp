/**
 * Puts WordGamePuzzle rows back the way backup-word-games.ts found them.
 *
 * Restores by `id` with UPDATE only — it never creates and never deletes,
 * for the same reason the generator does not: WordGameProgress.puzzleId
 * cascades on delete, so recreating a row would erase every player's
 * record of having solved that puzzle. A row in the backup that is no
 * longer in the database is therefore REPORTED, not resurrected; deciding
 * what to do about it is a judgement call, not something a rollback script
 * should make on its own at 2am.
 *
 * Usage:
 *   # see what would change, write nothing
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... \
 *     npx tsx prisma/restore-word-games.ts backup.json --dry-run
 *
 *   # restore everything that differs
 *   ... npx tsx prisma/restore-word-games.ts backup.json
 *
 *   # restore a single row, e.g. to test the script itself
 *   ... npx tsx prisma/restore-word-games.ts backup.json --only-id=<id>
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

const file = process.argv[2];
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY_ID = process.argv.find((a) => a.startsWith("--only-id="))?.slice("--only-id=".length) ?? null;
if (!file) {
  console.error("Usage: tsx prisma/restore-word-games.ts <backup.json> [--dry-run] [--only-id=<id>]");
  process.exit(1);
}

interface BackupPuzzle {
  id: string; type: string; level: string; sequence: number;
  curved: boolean; premiumOnly: boolean; topic: string | null;
  gridData: string; words: string;
}

async function main() {
  const backup = JSON.parse(readFileSync(file, "utf8")) as {
    takenAt: string; database: string; puzzleCount: number; progressCount: number; puzzles: BackupPuzzle[];
  };
  console.log(`backup taken ${backup.takenAt} from ${backup.database}: ${backup.puzzles.length} rows`);
  if (DRY_RUN) console.log("--dry-run: nothing will be written.");
  if (ONLY_ID) console.log(`--only-id=${ONLY_ID}`);

  const wanted = ONLY_ID ? backup.puzzles.filter((p) => p.id === ONLY_ID) : backup.puzzles;
  if (ONLY_ID && wanted.length === 0) {
    console.error(`No row with id ${ONLY_ID} in the backup.`);
    process.exit(1);
  }

  const live = new Map(
    (await db.wordGamePuzzle.findMany({
      select: { id: true, curved: true, premiumOnly: true, topic: true, gridData: true, words: true },
    })).map((r) => [r.id, r]),
  );

  let restored = 0;
  let alreadyMatching = 0;
  const missing: string[] = [];

  for (const p of wanted) {
    const current = live.get(p.id);
    if (!current) { missing.push(p.id); continue; }
    const same =
      current.curved === p.curved &&
      current.premiumOnly === p.premiumOnly &&
      current.topic === p.topic &&
      current.gridData === p.gridData &&
      current.words === p.words;
    if (same) { alreadyMatching++; continue; }

    console.log(
      `  ${p.type}/${p.level}/${p.sequence} (${p.id}): topic ${current.topic ?? "—"} -> ${p.topic ?? "—"}` +
        `${current.words === p.words ? "" : ", words differ"}${current.gridData === p.gridData ? "" : ", grid differs"}`,
    );
    if (!DRY_RUN) {
      await db.wordGamePuzzle.update({
        where: { id: p.id },
        data: { curved: p.curved, premiumOnly: p.premiumOnly, topic: p.topic, gridData: p.gridData, words: p.words },
      });
    }
    restored++;
  }

  const progressNow = await db.wordGameProgress.count();
  console.log(`\n${DRY_RUN ? "would restore" : "restored"}: ${restored}`);
  console.log(`already matching the backup: ${alreadyMatching}`);
  console.log(`in the backup but no longer in the database: ${missing.length}${missing.length ? ` — ${missing.join(", ")}` : ""}`);
  console.log(`WordGameProgress rows: ${progressNow} (backup recorded ${backup.progressCount})`);
  if (progressNow !== backup.progressCount) {
    console.log("  NOTE: progress row count differs from the backup. Players can legitimately");
    console.log("  solve puzzles between the backup and the restore, so this is not by itself");
    console.log("  a fault — but a DROP is, and it is what this line exists to make visible.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
