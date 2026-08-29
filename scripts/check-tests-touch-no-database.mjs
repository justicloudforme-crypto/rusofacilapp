// Prove that `npm run test` opens no database connection, no matter which
// environment variable happens to be set in the shell that runs it.
//
// Why this exists. On 29.08.2026 prisma/ensure-schema-sync.ts ran its
// migrator merely by being imported, and src/lib/schema-sync.test.ts imports
// it — so a test run in a shell carrying production credentials pointed the
// schema migrator at production. Every script in prisma/ and scripts/ now
// carries an entry-point guard (src/lib/entry-point.ts). The verification of
// that fix did not match its scope: it set TURSO_DATABASE_URL only, while
// prisma/glossary-coverage-report.ts builds its client from DATABASE_URL, so
// "58 of 58 clean" really meant "58 of 58 with TURSO_* substituted".
//
// There are five variables that can point code here at a remote database:
//   TURSO_DATABASE_URL / TURSO_AUTH_TOKEN      — src/lib/db.ts and most of prisma/
//   DATABASE_URL                               — the fallback in db.ts, and the
//                                                only one glossary-coverage-report reads
//   PROD_TURSO_DATABASE_URL / PROD_TURSO_AUTH_TOKEN
//                                              — sync-to-production.ts and
//                                                seed-ty-uydyosh-override.ts, kept
//                                                deliberately distinct from TURSO_*
// All five are set below, all pointing at a local socket this script owns.
//
// The socket is the measurement. Anything that tries to reach a "remote"
// database connects to it, and it records that and hangs up. Using an
// unreachable host instead would only prove that a connection FAILED; this
// proves none was attempted. Real credentials are deliberately not used —
// the check is stronger without them and cannot leak anything.
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PORT = 45789;
const PROBE = "connection-probe.generated.mts";

/** Written next to package.json only for the length of the control run, so
 * tsx and the generated Prisma client resolve exactly as they do in a test. */
const PROBE_SOURCE = `import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "./src/generated/prisma/client.ts";
const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });
try { await db.glossaryTerm.count(); console.log("query returned"); }
catch (e) { console.log("query threw: " + String(e).slice(0, 60)); }
`;

function listener() {
  const hits = [];
  const server = createServer((socket) => {
    hits.push(`${socket.remoteAddress}:${socket.remotePort}`);
    socket.destroy();
  });
  return new Promise((resolve) => {
    server.listen(PORT, "127.0.0.1", () => resolve({ hits, close: () => server.close() }));
  });
}

/** spawnSync blocks this process's event loop, so incoming connections sit
 * in the OS accept backlog and the server's callback has not run yet when
 * spawnSync returns. Reading the count without draining first reports 0 for
 * a connection that plainly happened — which is exactly what this check
 * would then have claimed about the whole test suite. */
async function drain() {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

function envPointingAtTheSocket() {
  const url = `http://127.0.0.1:${PORT}`;
  return {
    ...process.env,
    TURSO_DATABASE_URL: url,
    TURSO_AUTH_TOKEN: "not-a-real-token",
    DATABASE_URL: url,
    PROD_TURSO_DATABASE_URL: url,
    PROD_TURSO_AUTH_TOKEN: "not-a-real-token",
  };
}

async function main() {
  const { hits, close } = await listener();

  console.log(`connection detector listening on 127.0.0.1:${PORT}`);
  console.log("all five database variables point at it\n");

  console.log("--- positive control: something that DOES connect must be seen ---");
  // Takes the same path src/lib/db.ts takes, so a connection here is exactly
  // the connection a test could make. Run twice: once via TURSO_DATABASE_URL
  // (the variable the original verification used) and once via DATABASE_URL
  // alone with TURSO_* unset — the gap debt 12 named. Both must be detected,
  // or a zero from the suite proves nothing about that variable.
  writeFileSync(PROBE, PROBE_SOURCE);
  let controlHits = 0;
  for (const [label, only] of [
    ["TURSO_DATABASE_URL", { TURSO_DATABASE_URL: `libsql://127.0.0.1:${PORT}`, TURSO_AUTH_TOKEN: "x", DATABASE_URL: "" }],
    ["DATABASE_URL alone ", { TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", DATABASE_URL: `libsql://127.0.0.1:${PORT}` }],
  ]) {
    const before = hits.length;
    const control = spawnSync("npx", ["tsx", PROBE], {
      env: { ...process.env, ...only },
      encoding: "utf8",
      timeout: 120_000,
    });
    await drain();
    const seen = hits.length - before;
    controlHits += seen;
    console.log(`  probe via ${label}: ${seen} connection(s)  ${seen ? "caught" : "MISSED"}  (${(control.stdout ?? "").trim().slice(0, 60)})`);
  }
  rmSync(PROBE, { force: true });
  console.log(controlHits >= 2
    ? "  both variables are detectable — a zero below is therefore a real zero"
    : "  MISSED — the detector cannot see one of the paths, so a zero below would mean nothing");

  console.log("\n--- the whole test suite, same environment ---");
  const at = hits.length;
  const run = spawnSync("npm", ["run", "test"], {
    env: envPointingAtTheSocket(),
    encoding: "utf8",
    timeout: 900_000,
  });
  await drain();
  const testHits = hits.length - at;
  const summary = (run.stdout ?? "").split("\n").filter((l) => /Test Files|Tests\s+\d|Tests\s+\d+ passed/.test(l));
  summary.forEach((l) => console.log("  " + l.trim()));
  console.log(`  exit ${run.status}`);
  console.log(`\n  database connections opened by the test suite: ${testHits}`);

  close();
  const ok = controlHits >= 2 && testHits === 0 && run.status === 0;
  console.log(ok ? "\nPASS" : "\nFAIL");
  process.exitCode = ok ? 0 : 1;
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
