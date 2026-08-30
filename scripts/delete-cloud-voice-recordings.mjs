// Remove the voice recordings that were uploaded BEFORE recordings stopped
// leaving the device (30.08.2026). Prepared, not run: how much of this to
// delete is the owner's decision, and the numbers it is decided on are in
// PROGRESS.md 7.49.
//
// What it can touch, and nothing else:
//   - objects under `submissions/` in the Vercel Blob store the
//     BLOB_READ_WRITE_TOKEN in the environment points at;
//   - the matching VoiceSubmission rows, but ONLY with --rows and only for
//     the users named by --only.
//
// The safety rules are the same three that the glossary seed run used
// (PROGRESS.md 7.27), because they worked:
//
//   1. **--dry-run is the default.** Without --apply nothing is deleted,
//      and the run prints exactly what it would have removed.
//   2. **--only=<userId>[,<userId>] is mandatory.** There is no "all".
//      A prefix has to be named for anything to be in scope, so a mistyped
//      flag deletes nothing rather than everything.
//   3. **There is no --force.** Every guard has to pass on its own.
//
//   node scripts/delete-cloud-voice-recordings.mjs --list
//   node scripts/delete-cloud-voice-recordings.mjs --only=<userId>
//   node scripts/delete-cloud-voice-recordings.mjs --only=<userId> --apply
//   node scripts/delete-cloud-voice-recordings.mjs --only=<userId> --apply --rows
//
// --rows needs a database the script can reach (DATABASE_URL, or the
// TURSO_* pair for production) and is deliberately a separate opt-in:
// deleting the object leaves a row pointing at nothing, which reads as a
// missing file rather than as data loss; deleting the row without the
// object leaves a paid-for orphan nobody can find. In that order, the
// less-bad half is the default.
import "dotenv/config";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const arg = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : "";
};

const APPLY = flag("apply");
const LIST = flag("list");
const ROWS = flag("rows");
const ONLY = arg("only")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const PREFIX = "submissions/";

async function listAll() {
  const { list } = await import("@vercel/blob");
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.cursor;
  } while (cursor);
  return blobs;
}

/** `submissions/<userId>/<level>-<lesson>/<file>` — the layout the deleted
 * upload route wrote. Anything that does not match is reported and never
 * touched: an unexpected shape is a reason to stop, not to guess. */
function userIdOf(pathname) {
  const parts = pathname.split("/");
  return parts.length >= 3 && parts[0] === "submissions" ? parts[1] : null;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is not set — nothing to talk to.");
    return 1;
  }

  const blobs = await listAll();
  const byUser = new Map();
  const unexpected = [];
  for (const blob of blobs) {
    const userId = userIdOf(blob.pathname);
    if (!userId) {
      unexpected.push(blob.pathname);
      continue;
    }
    const bucket = byUser.get(userId) ?? { count: 0, bytes: 0, blobs: [] };
    bucket.count += 1;
    bucket.bytes += blob.size ?? 0;
    bucket.blobs.push(blob);
    byUser.set(userId, bucket);
  }

  const totalBytes = blobs.reduce((sum, b) => sum + (b.size ?? 0), 0);
  console.log(`store: ${blobs.length} objects under ${PREFIX}, ${totalBytes} bytes, ${byUser.size} users`);
  for (const [userId, bucket] of [...byUser].sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`  ${userId}  ${String(bucket.count).padStart(4)} objects  ${String(bucket.bytes).padStart(10)} B`);
  }
  if (unexpected.length) {
    console.log(`\n  ${unexpected.length} object(s) not shaped like submissions/<userId>/… — never in scope:`);
    unexpected.slice(0, 10).forEach((p) => console.log(`    ${p}`));
  }

  if (LIST) return 0;

  if (ONLY.length === 0) {
    console.error(
      "\n--only=<userId>[,<userId>] is required. There is no 'delete everything' here on purpose;" +
        " run with --list to get the ids above."
    );
    return 1;
  }

  const missing = ONLY.filter((id) => !byUser.has(id));
  if (missing.length) {
    console.error(`\nno objects for: ${missing.join(", ")} — check the id, nothing was deleted`);
    return 1;
  }

  const targets = ONLY.flatMap((id) => byUser.get(id).blobs);
  const targetBytes = targets.reduce((sum, b) => sum + (b.size ?? 0), 0);
  console.log(`\nin scope: ${targets.length} objects, ${targetBytes} bytes, users ${ONLY.join(", ")}`);
  targets.slice(0, 20).forEach((b) => console.log(`  ${b.pathname}  ${b.size} B  ${b.uploadedAt}`));
  if (targets.length > 20) console.log(`  … and ${targets.length - 20} more`);

  if (!APPLY) {
    console.log("\n--dry-run (default): nothing was deleted. Add --apply to do it for real.");
    return 0;
  }

  const { del } = await import("@vercel/blob");
  // In batches: `del` takes an array, and one 3000-item call is one
  // request that either works or leaves no record of how far it got.
  for (let i = 0; i < targets.length; i += 100) {
    const batch = targets.slice(i, i + 100);
    await del(batch.map((b) => b.url));
    console.log(`  deleted ${Math.min(i + batch.length, targets.length)} / ${targets.length}`);
  }

  if (ROWS) {
    const { PrismaClient } = await import("../src/generated/prisma/client.js");
    const db = new PrismaClient();
    const removed = await db.voiceSubmission.deleteMany({ where: { userId: { in: ONLY } } });
    console.log(`  deleted ${removed.count} VoiceSubmission rows for the same users`);
    await db.$disconnect();
  } else {
    console.log("  rows left alone (no --rows): they now point at objects that are gone");
  }
  return 0;
}

// Only when this file is the process entry point — see src/lib/entry-point.ts.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
