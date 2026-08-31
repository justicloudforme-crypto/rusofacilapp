#!/usr/bin/env node
/**
 * Vercel "Ignored Build Step": decides whether a commit is worth building.
 *
 * Wire it up in Vercel → Project → Settings → Git → Ignored Build Step:
 *
 *     node scripts/vercel-ignore-build.mjs
 *
 * Exit codes are Vercel's, and they are backwards from the usual convention:
 *   exit 0 → SKIP the build   (Vercel: "the build can be ignored")
 *   exit 1 → BUILD            (Vercel: "proceed")
 *
 * WHY THIS EXISTS. Measured over 2026-08-23 → 2026-08-31: 311 deployments,
 * 597 build-minutes, $13.59 of the $20 included Pro credit — 82% of everything
 * spent. Of those 311, **52 built nothing but Markdown** (100.8 minutes,
 * ≈$2.29): PROGRESS.md is edited at the end of nearly every round, and every
 * such edit currently recompiles 413 pages to ship a file the site does not
 * serve. This script is the cheapest of the levers because it costs no change
 * in how anybody works.
 *
 * THE RULE, and it is deliberately timid. A build is skipped only when EVERY
 * changed path in the range is on the allowlist below. Anything unrecognised,
 * any error, any inability to work out the range — build. A wrongly skipped
 * build leaves production one commit stale with a green checkmark on it,
 * which is a far worse failure than a wasted two minutes, so every uncertain
 * case resolves towards spending the money.
 *
 * CONSEQUENCE WORTH KNOWING BEFORE TURNING THIS ON. A skipped deployment shows
 * as "Canceled" in Vercel and the previous deployment stays live. That means
 * `sentry-release` on the live site will legitimately lag `git rev-parse HEAD`
 * by however many docs-only commits came last — and PROGRESS.md's standing
 * instruction ("if they diverge, you are measuring someone else's deploy") is
 * written on the assumption that they never legitimately diverge. After this
 * is enabled, the check becomes: the live release must match the most recent
 * commit that touched something OUTSIDE the allowlist.
 *
 *   node scripts/vercel-ignore-build.mjs --self-test   # positive control
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * Paths whose contents cannot change a single byte the site serves.
 *
 * Everything here is prose about the project. Notably NOT here, and not
 * eligible to be: `public/**` (served verbatim), `prisma/**` (the seed and
 * generation scripts, plus schema.prisma, which ensure-schema-sync reads at
 * build time), `e2e/**` and `**\/*.test.ts` (they do not change the site, but
 * they do change what CI checks, and a deployment that skipped its own test
 * evidence is not a saving), and `.github/**` (CI config).
 */
const DOC_PATTERNS = [
  /^PROGRESS\.md$/,
  /^AUDIT\.md$/,
  /^MOBILE\.md$/,
  /^FREEMIUM\.md$/,
  /^CLAUDE\.md$/,
  /^AGENTS\.md$/,
  /^README\.md$/,
  /^LICENSE$/,
  /^docs\/.*$/,
];

export function isDocOnlyPath(path) {
  return DOC_PATTERNS.some((pattern) => pattern.test(path));
}

/** true → nothing in this list can affect the built site. */
export function isSkippable(paths) {
  // An empty list means "we could not tell what changed", never "nothing
  // changed". Refusing to skip is the only safe reading.
  if (!Array.isArray(paths) || paths.length === 0) return false;
  return paths.every(isDocOnlyPath);
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function changedPaths() {
  // VERCEL_GIT_PREVIOUS_SHA is set on every Git-triggered deployment and is
  // the commit the last deployment of this branch was built from — the right
  // base, because it makes the decision about everything that has happened
  // since something was actually built, not just since the previous commit.
  const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
  const current = process.env.VERCEL_GIT_COMMIT_SHA ?? "HEAD";
  const range = previous ? `${previous}..${current}` : `${current}^..${current}`;

  // Vercel clones shallow; the base may simply not be in the local history.
  // Try to deepen, and treat failure as "cannot tell" rather than as "empty".
  try {
    git(["diff", "--name-only", range]);
  } catch {
    try {
      git(["fetch", "--unshallow", "--quiet"]);
    } catch {
      /* already complete, or no network — the diff below decides */
    }
  }

  return git(["diff", "--name-only", range])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function selfTest() {
  const cases = [
    { label: "PROGRESS.md alone", paths: ["PROGRESS.md"], skip: true },
    { label: "two docs files", paths: ["PROGRESS.md", "docs/experiment-readout-2026-09-25.md"], skip: true },
    { label: "a source file alone", paths: ["src/lib/plans.ts"], skip: false },
    { label: "docs plus one source file", paths: ["PROGRESS.md", "src/lib/plans.ts"], skip: false },
    { label: "a public/ asset (served verbatim)", paths: ["public/offline.html"], skip: false },
    { label: "a seed script", paths: ["prisma/seed-glossary.ts"], skip: false },
    { label: "a CI workflow", paths: [".github/workflows/ci.yml"], skip: false },
    { label: "an e2e spec", paths: ["e2e/checkout.spec.ts"], skip: false },
    { label: "package.json", paths: ["package.json"], skip: false },
    { label: "a .md file inside src/", paths: ["src/content/note.md"], skip: false },
    { label: "an empty diff (cannot tell what changed)", paths: [], skip: false },
  ];

  let bad = 0;
  console.log("vercel-ignore-build --self-test");
  console.log("");
  for (const { label, paths, skip } of cases) {
    const got = isSkippable(paths);
    const ok = got === skip;
    if (!ok) bad++;
    console.log(`  ${ok ? "✓" : "✗"} ${skip ? "SKIP" : "BUILD"}: ${label}${ok ? "" : `  ← got ${got ? "SKIP" : "BUILD"}`}`);
  }
  console.log("");
  if (bad > 0) {
    console.error(`✗ ${bad} case(s) decided the wrong way. Do not enable this until they pass.`);
    process.exit(1);
  }
  // The control that matters is the negative direction: a rule that never
  // says BUILD would silently freeze production at whatever is deployed now.
  console.log(`Control passed: ${cases.length} cases, ${cases.filter((c) => !c.skip).length} of them required to BUILD.`);
  process.exit(0);
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();

  let paths;
  try {
    paths = changedPaths();
  } catch (error) {
    console.log(`[ignore-build] Could not determine what changed (${error.message.split("\n")[0]}) — building.`);
    process.exit(1); // build
  }

  if (isSkippable(paths)) {
    console.log(`[ignore-build] Skipping: ${paths.length} changed path(s), all documentation — ${paths.join(", ")}`);
    process.exit(0); // skip
  }

  console.log(`[ignore-build] Building: ${paths.length} changed path(s), including ${paths.filter((p) => !isDocOnlyPath(p))[0] ?? "(unknown)"}`);
  process.exit(1); // build
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main();
}
