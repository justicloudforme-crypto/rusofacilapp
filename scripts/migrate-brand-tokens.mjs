#!/usr/bin/env node
// One-time migration: legacy --brand/--brand-light/--brand-accent/
// --brand-accent-light CSS var + Tailwind class names -> the new token
// names in tokens.generated.css. String substitution only — does not touch
// layout, spacing, JSX structure, or any className content besides the
// token name itself. Run once, review the diff, then this file can stay as
// a record of the exact mapping used.
//
// --brand-accent (red) is NOT blanket-mapped to danger: 19 of 21 real uses
// are decorative/positive (confetti, streak flame, celebration labels, the
// "Popular" plan badge, the audio-player active-speed pill) and go to the
// new --color-folk-red alias instead, which is pixel-identical but not
// labeled as an error. Only the two files below are genuine error-message
// rendering and get --color-danger.
const DANGER_FILES = new Set([
  "src/app/[lang]/login/page.tsx",
  "src/app/[lang]/register/page.tsx",
]);

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { pathToFileURL } from "node:url";

// Only when this file is the process entry point. This script has its
// effect at module scope, so importing it used to DO that work — see
// src/lib/entry-point.ts for the incident behind this rule. Inlined rather
// than imported because plain .mjs run by node cannot import the .ts helper.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;


const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function listFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "generated") continue;
    const p = path.join(dir, entry);
    const s = statSync(p);
    const excluded = new Set([
      path.join(root, "src/app/tokens.generated.css"),
      path.join(root, "src/app/globals.css"), // hand-migrated separately — it DEFINES the old vars, mechanical rename would corrupt it
    ]);
    if (s.isDirectory()) listFiles(p, out);
    else if (/\.(tsx|ts)$/.test(entry) && !excluded.has(p)) out.push(p);
  }
  return out;
}

function migrateLine(line, dangerTarget, dangerVarTarget) {
  let out = line;
  // var(--brand...) forms first (longest/most-specific first)
  out = out.replaceAll("var(--brand-accent-light)", "var(--color-premium-400)");
  out = out.replaceAll("var(--brand-accent)", dangerVarTarget);
  out = out.replaceAll("var(--brand-light)", "var(--color-primary-400)");
  out = out.replaceAll("var(--brand)", "var(--color-primary)");
  // Tailwind utility-class token forms — requires a literal "-" immediately
  // before the token (bg-brand, border-l-brand, dark:border-brand-light/20,
  // etc. all qualify). This is what excludes false positives found in a
  // dry run: English prose ("a brand-new row", "brand guidelines", "the
  // brand's red/gold") is never hyphen-prefixed, and neither is the
  // unrelated local `brand: "#3730a3"` SVG-illustration palette key in
  // IntroIllustration.tsx/SlideIllustration.tsx (deliberately NOT tied to
  // the CSS var per that file's own comment) or slideIcons.ts's `fill:
  // "brand"` lookup into it — none of those are preceded by "-".
  out = out.replace(/(?<=-)brand-accent-light\b/g, "premium-400");
  out = out.replace(/(?<=-)brand-accent\b/g, dangerTarget);
  out = out.replace(/(?<=-)brand-light\b/g, "primary-400");
  out = out.replace(/(?<=-)brand\b/g, "primary");
  return out;
}

function migrate(src, relPath) {
  const dangerTarget = DANGER_FILES.has(relPath) ? "danger" : "folk-red";
  const dangerVarTarget = DANGER_FILES.has(relPath) ? "var(--color-danger-default)" : "var(--color-folk-red)";

  // Comment lines are left untouched — this migration is code-token-only,
  // not a prose/doc pass. A handful of comments describing the old
  // --brand/--brand-accent names (e.g. src/lib/lessons/pdf.tsx) will go
  // stale; that's a deliberate, visible trade-off for keeping this diff to
  // exactly the runtime-affecting tokens, reviewed by hand if it matters.
  return src
    .split("\n")
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return line;
      return migrateLine(line, dangerTarget, dangerVarTarget);
    })
    .join("\n");
}

const dryRun = process.argv.includes("--dry-run");

if (IS_ENTRY_POINT) {
  const files = listFiles(path.join(root, "src"));
  let changedFiles = [];
  for (const file of files) {
    const relPath = path.relative(root, file);
    const src = readFileSync(file, "utf8");
    const out = migrate(src, relPath);
    if (out !== src) {
      if (!dryRun) writeFileSync(file, out);
      changedFiles.push(relPath);
    }
  }

  console.log(`${dryRun ? "[dry run] Would migrate" : "Migrated"} ${changedFiles.length} files:`);
  for (const f of changedFiles) console.log(`  ${f}`);
}
