// Makes "CI is green and half the suite never ran" impossible to happen
// quietly.
//
// It happened. On 30.08.2026 CI executed 25 of the suite's 49 tests and
// reported success: two spec files self-skipped under `process.env.CI` for
// want of database content, and four more tests skipped WebKit over a cookie
// attribute (PROGRESS.md 7.52). Nothing in the output said so. A skipped
// test in a Playwright report is a line nobody reads, and the exit code is
// the same either way — which is precisely what makes this class of failure
// survive: the gate keeps saying yes while the thing it gates shrinks.
//
// Two questions, because neither one alone is enough:
//
//   1. Does the source contain a skip at all? Catches the intent at review
//      time, before a run, and catches a skip that is conditional on
//      something CI does not happen to set today but might tomorrow.
//   2. Did the run actually execute at least as many tests as it used to,
//      and skip none? Catches everything the source scan cannot see — a
//      project filter, a testMatch that stopped matching, a spec file that
//      silently failed to load.
//
//   node scripts/check-e2e-coverage.mjs                       # source only
//   node scripts/check-e2e-coverage.mjs --report=<results.json>
//   node scripts/check-e2e-coverage.mjs --self-test           # positive control
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const E2E_DIR = join(repoRoot, "e2e");

/**
 * How many tests the suite is known to execute, counting one test per
 * project (79 = 38 in chromium + 38 in mobile-iphone + 3 in
 * voice-ios-shape). Raised from 49 to 53 on 30.08.2026 by
 * e2e/page-width.spec.ts — one test per locale — and from 53 to 57 when
 * that spec gained its second viewport width (320 alongside 360), which
 * doubles it to one test per locale per width. Raised from 57 to 61 on
 * 31.08.2026 by e2e/navbar-signed-in.spec.ts (one test per locale), which
 * measures the header of a SIGNED-IN learner at 640–660 — the surface debt
 * 37 existed for, and the one check:layout cannot reach because it browses
 * anonymously. Raised from 79 to 81 on 02.09.2026, when word-games.spec.ts
 * gained the crossword board-width test (PROGRESS.md 7.92) — one test in
 * each of the two projects it runs in. Raised from 77 to 79 on 01.09.2026, when
 * word-games.spec.ts gained the mobile-column test (PROGRESS.md 7.77);
 * from 73 to 77, when
 * match-result-panel.spec.ts added one test per locale; from 61 to 73, when
 * e2e/page-width.spec.ts went from two viewport widths to five — 1024, 834
 * and 820 join 360 and 320 — and each of those tests also began asserting
 * the new fill rule (scripts/layout-fill.mjs) on the same loaded pages.
 * Twelve of the twelve new executions are that spec: 6 more tests, in each
 * of the two projects it runs in. Raise it when tests are
 * added; it must never be
 * lowered to make a run pass. Lowering it is the exact move this file
 * exists to prevent, so if you are here to do that, the thing to fix is
 * the run.
 */
const MIN_EXECUTED_TESTS = 81;

/**
 * Skips that are allowed to exist, each with the reason it is allowed.
 * Empty, deliberately, and that is the point: there is currently no test in
 * this suite that may skip. Adding an entry is a visible decision in a diff
 * with a sentence attached, which is the opposite of how the 24 skipped
 * tests got there.
 */
const ALLOWED_SKIPS = new Map();

/** Every form of "do not run this" Playwright offers, plus `.only`, which
 * does the same damage from the other end — it runs one test and silently
 * drops the rest. `forbidOnly` already fails a CI run on it, but that only
 * covers CI; this covers a local `npm run verify` too. */
const SKIP_PATTERNS = [
  /\btest\.skip\s*\(/,
  /\btest\.fixme\s*\(/,
  /\btest\.describe\.skip\s*\(/,
  /\btest\.describe\.fixme\s*\(/,
  /\btest\.only\s*\(/,
  /\btest\.describe\.only\s*\(/,
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mjs|js)$/.test(entry)) out.push(full);
  }
  return out;
}

/** @returns {string[]} one human-readable problem per offending line */
export function scanSource(files) {
  const problems = [];
  for (const file of files) {
    const rel = relative(repoRoot, file);
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      // A mention inside a comment is documentation, not a skip. Checked
      // crudely on purpose: a false positive here costs one comment reword,
      // a false negative costs a third of the suite.
      const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, "");
      if (!SKIP_PATTERNS.some((p) => p.test(code))) return;
      const key = `${rel}:${i + 1}`;
      if (ALLOWED_SKIPS.has(key)) return;
      problems.push(`${key}: ${line.trim()}`);
    });
  }
  return problems;
}

/** @returns {{ executed: number, skipped: string[] }} */
export function readReport(reportPath) {
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  let executed = 0;
  const skipped = [];
  const visitSuite = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        // Playwright reports a test's own `status` as "skipped" whether it
        // never ran or bailed out mid-way via test.skip(condition).
        if (test.status === "skipped") skipped.push(`[${test.projectName}] ${spec.title}`);
        else executed += 1;
      }
    }
    for (const child of suite.suites ?? []) visitSuite(child);
  };
  for (const suite of report.suites ?? []) visitSuite(suite);
  return { executed, skipped };
}

function main(argv) {
  const reportArg = argv.find((a) => a.startsWith("--report="));
  const problems = scanSource(walk(E2E_DIR));

  if (problems.length) {
    console.error(`e2e coverage: ${problems.length} skip(s) in e2e/ — every test in this suite must run:`);
    for (const p of problems) console.error(`  ${p}`);
    console.error(
      "\nIf one genuinely has to skip, add it to ALLOWED_SKIPS in this file with the reason.\n" +
        "A skip that nobody had to write down is how CI came to run 25 of 49 tests (PROGRESS.md 7.52).",
    );
    return 1;
  }
  console.log(`e2e coverage: no skips in e2e/ (${walk(E2E_DIR).length} files scanned)`);

  if (!reportArg) {
    console.log("e2e coverage: no --report given, source check only");
    return 0;
  }

  const reportPath = join(repoRoot, reportArg.slice("--report=".length));
  let result;
  try {
    result = readReport(reportPath);
  } catch (error) {
    console.error(`e2e coverage: could not read the run report at ${reportPath} — ${error.message}`);
    console.error("A missing report is not a pass: it means nobody knows what ran.");
    return 1;
  }

  let failed = false;
  if (result.skipped.length) {
    console.error(`e2e coverage: ${result.skipped.length} test(s) skipped in the run itself:`);
    for (const s of result.skipped) console.error(`  ${s}`);
    failed = true;
  }
  if (result.executed < MIN_EXECUTED_TESTS) {
    console.error(
      `e2e coverage: the run executed ${result.executed} tests, fewer than the ${MIN_EXECUTED_TESTS} this suite is known to have.`,
    );
    console.error("Something stopped running. Do not lower the floor to make this pass.");
    failed = true;
  }
  if (failed) return 1;

  console.log(`e2e coverage: ${result.executed} tests executed, 0 skipped (floor ${MIN_EXECUTED_TESTS})`);
  return 0;
}

/**
 * The check has to be able to fail, or it is decoration — the rule this
 * project measures everything else by (PROGRESS.md 4.1). Feeds itself a
 * source file that skips and a report that skips, and reports whether both
 * were caught.
 */
function selfTest() {
  const fixtureDir = join(repoRoot, "scripts", "__e2e-coverage-selftest__");
  let ok = true;

  const planted = scanSource([join(fixtureDir, "skipping.spec.ts")]);
  console.log(`self-test: planted skip in source -> ${planted.length} problem(s) ${planted.length ? "CAUGHT" : "MISSED"}`);
  if (planted.length === 0) ok = false;

  const clean = scanSource([join(fixtureDir, "clean.spec.ts")]);
  console.log(`self-test: clean source -> ${clean.length} problem(s) ${clean.length === 0 ? "OK" : "FALSE POSITIVE"}`);
  if (clean.length !== 0) ok = false;

  const report = readReport(join(fixtureDir, "report-with-a-skip.json"));
  console.log(
    `self-test: report with a skipped test -> executed=${report.executed} skipped=${report.skipped.length} ` +
      `${report.skipped.length ? "CAUGHT" : "MISSED"}`,
  );
  if (report.skipped.length === 0) ok = false;

  console.log(ok ? "self-test: the check can fail on every input it claims to check" : "self-test: FAILED");
  return ok ? 0 : 1;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  const argv = process.argv.slice(2);
  process.exit(argv.includes("--self-test") ? selfTest() : main(argv));
}
