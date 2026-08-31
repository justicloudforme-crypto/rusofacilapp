#!/usr/bin/env node
/**
 * Builds the glossary auto-linking pattern out of the terms that are
 * ACTUALLY IN THE DATABASE, the way GlossaryText.tsx builds it, and reports
 * every term that cannot be compiled.
 *
 * Why this exists next to src/lib/glossary-pattern.test.ts. That test reads
 * prisma/seed-glossary.ts, which is the terms we MEANT to have. The rows a
 * student's browser compiles are the ones in Turso, and they are editable
 * from the admin screen without touching the seed file. Incident №1
 * (29.08.2026) was caused by exactly that gap: nothing in the repository
 * changed, a row did — `verbo reflexivo (con -ся)` was written on
 * 19.08.2026 and every lesson page in both locales stopped rendering.
 *
 * Reads the live term list over HTTP (/api/glossary is public and is the
 * same endpoint the component fetches), so it needs no database credentials
 * and measures the same bytes the browser receives.
 *
 *   node scripts/check-glossary-pattern.mjs                     # production
 *   node scripts/check-glossary-pattern.mjs --base=http://localhost:3000
 *   node scripts/check-glossary-pattern.mjs --plant             # see below
 *
 * `--plant` is the positive control required by PROGRESS.md 4.1: it adds
 * two terms escaped the way round one of this bug escaped them, and the
 * run must FAIL. A green run without a red control run proves nothing.
 */

import { pathToFileURL } from "node:url";

import { escapeRegExp } from "../src/lib/regex.ts";

/** GlossaryText.tsx getMatcher(), character for character. If that changes,
 * this must change with it — src/lib/glossary-pattern.test.ts asserts the
 * component still builds the shape both of these mirror. */
function buildPattern(terms, escape = escapeRegExp) {
  const surfaces = [...new Set(terms.map((t) => t.toLowerCase()))].sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![\\p{L}])(${surfaces.map(escape).join("|")})(?![\\p{L}])`, "giu");
}

async function main() {
  const args = process.argv.slice(2);
  const base = (args.find((a) => a.startsWith("--base=")) ?? "--base=https://rusofacilapp.com").slice(7);
  const plant = args.includes("--plant");

  const response = await fetch(`${base}/api/glossary`);
  if (!response.ok) {
    console.error(`GET ${base}/api/glossary -> ${response.status}`);
    process.exit(2);
  }
  const terms = ((await response.json()).terms ?? []).map((t) => t.term);

  if (terms.length === 0) {
    // An empty list compiles trivially and would make every check below
    // vacuous — the same trap PROGRESS.md 4.1 describes for empty crawls.
    console.error(`${base}/api/glossary returned no terms — nothing was measured.`);
    process.exit(2);
  }

  // The control: round one's escaping, which emitted `\-`. Under `u` that is
  // an invalid escape, so the three live hyphen terms must fail below.
  const brokenEscape = (v) => v.replace(/[.*+?^${}()|[\]\\\-]/g, "\\$&");
  const escape = plant ? brokenEscape : escapeRegExp;
  const subject = plant ? [...terms, "чем..., тем...", "по-русски"] : terms;

  const failures = [];
  for (const term of subject) {
    try {
      const single = buildPattern([term], escape);
      if (!single.test(term.toLowerCase())) failures.push(`${term} — compiles but does not match itself`);
    } catch (error) {
      failures.push(`${term} — ${error.message.split(":").slice(0, 2).join(":")}`);
    }
  }

  let combined = null;
  try {
    combined = buildPattern(subject, escape);
  } catch (error) {
    failures.push(`ALL ${subject.length} TERMS AS ONE ALTERNATION — ${error.message.slice(0, 160)}`);
  }

  console.log(`base           ${base}`);
  console.log(`terms          ${terms.length}${plant ? ` (+2 planted, escaped the pre-fix way)` : ""}`);
  console.log(`with a hyphen  ${terms.filter((t) => t.includes("-")).length}`);
  console.log(`with a comma   ${terms.filter((t) => t.includes(",")).length}`);
  console.log(`punctuation    ${JSON.stringify([...new Set(terms.join("").split("").filter((c) => !/[\p{L}\p{N}\s]/u.test(c)))].join(""))}`);
  console.log(`one alternation ${combined ? "compiles" : "DOES NOT COMPILE"}`);
  console.log(`failing terms  ${failures.length}`);
  for (const line of failures) console.log(`  - ${line}`);

  if (plant) {
    if (failures.length === 0) {
      console.error("\nPOSITIVE CONTROL DID NOT FIRE — the check cannot see the defect it exists for.");
      process.exit(1);
    }
    console.log("\nPositive control fired as required; this run is expected to be red.");
    process.exit(0);
  }

  process.exit(failures.length === 0 ? 0 : 1);
}

// Only when this file is the process entry point — importing it must not
// reach the network or exit the process. See src/lib/entry-point.ts.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
