#!/usr/bin/env node
// Two guards, run via `npm run check:tokens`:
//  1. Contrast: recomputes WCAG contrast for every documented text/bg pair
//     in tokens.json and fails if any drops below its required ratio.
//  2. Premium misuse: fails if --color-premium / bg-premium* / text-premium*
//     is applied on the same JSX opening tag as onClick=/href=, or wraps a
//     <Button — premium is a non-clickable value marker only (see CLAUDE.md).
//     Regex-based heuristic over source text, not a full AST — intentionally
//     simple per the "at least a script" fallback the design-system step
//     asked for; false positives are possible on multi-line tags, review
//     any hit by hand.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { pathToFileURL } from "node:url";

// Only when this file is the process entry point. This script has its
// effect at module scope, so importing it used to DO that work — see
// src/lib/entry-point.ts for the incident behind this rule. Inlined rather
// than imported because plain .mjs run by node cannot import the .ts helper.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;


const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tokens = JSON.parse(readFileSync(path.join(root, "tokens.json"), "utf8"));

// --- 1. Contrast guard -----------------------------------------------------

function srgbToLinear(c) {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}
function relLuminance(hex) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function contrast(hexA, hexB) {
  const L1 = relLuminance(hexA);
  const L2 = relLuminance(hexB);
  const [lighter, darker] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (lighter + 0.05) / (darker + 0.05);
}

// Pairs worth guarding automatically: fg/bg combos the design system
// declares as "safe for normal-size text" (>=4.5:1) or "safe for large
// text/UI only" (>=3:1). Extend this list as new tokens/usages are added.
const pairs = [
  { name: "neutral-900 text on neutral-50 bg", fg: tokens.color.neutral["900"], bg: tokens.color.neutral["50"], min: 4.5 },
  { name: "white text on primary-600 button (either theme, self-contained)", fg: "#FFFFFF", bg: tokens.color.primary["600"], min: 4.5 },
  { name: "primary-600 text/link on neutral-50 bg (light theme)", fg: tokens.color.primary["600"], bg: tokens.color.neutral["50"], min: 4.5 },
  { name: "primary-600 text/link on neutral-900 bg (dark theme, EXPECTED TO FAIL — proves the sink risk)", fg: tokens.color.primary["600"], bg: tokens.color.neutral["900"], min: 4.5, expectFail: true },
  { name: "primary-darkText on neutral-900 bg (dark theme link/text alias)", fg: tokens.color.primary.darkText, bg: tokens.color.neutral["900"], min: 4.5 },
  { name: "dark-theme foreground on dark-theme background", fg: tokens.color.neutral.dark.foreground, bg: tokens.color.neutral.dark.background, min: 4.5 },
  { name: "dark-theme foreground on dark-theme surface", fg: tokens.color.neutral.dark.foreground, bg: tokens.color.neutral.dark.surface, min: 4.5 },
  { name: "primary-darkText on dark-theme surface (cards, not just page bg)", fg: tokens.color.primary.darkText, bg: tokens.color.neutral.dark.surface, min: 4.5 },
  { name: "neutral-600 secondary text on neutral-50 bg", fg: tokens.color.neutral["600"], bg: tokens.color.neutral["50"], min: 4.5 },
  { name: "premium-700 text on neutral-50 bg", fg: tokens.color.premium["700"], bg: tokens.color.neutral["50"], min: 4.5 },
  { name: "danger-strong text on neutral-50 bg", fg: tokens.color.semantic.danger.strong, bg: tokens.color.neutral["50"], min: 4.5 },
  { name: "success-strong text on neutral-50 bg", fg: tokens.color.semantic.success.strong, bg: tokens.color.neutral["50"], min: 4.5 },
  { name: "warning-strong text on neutral-50 bg", fg: tokens.color.semantic.warning.strong, bg: tokens.color.neutral["50"], min: 4.5 },
  ...Object.entries(tokens.color.level)
    .filter(([k]) => !k.startsWith("_") && k !== "contrastNote")
    .map(([lvl, shades]) => ({
      name: `level-${lvl}-strong text on level-${lvl}-subtle bg`,
      fg: shades.strong,
      bg: shades.subtle,
      min: 4.5,
    })),
];

let contrastFailures = 0;
if (IS_ENTRY_POINT) {
  console.log("--- contrast check ---");
  for (const p of pairs) {
    const ratio = contrast(p.fg, p.bg);
    const passes = ratio >= p.min;
    const ok = p.expectFail ? !passes : passes;
    if (!ok) contrastFailures++;
    const label = p.expectFail ? (passes ? "FAIL" : "OK  ") : (passes ? "OK  " : "FAIL");
    console.log(`${label} ${p.name}: ${ratio.toFixed(2)}:1 (needs ${p.min}:1)`);
  }

  // --- 2. Premium-on-clickable guard -----------------------------------------

  function listFiles(dir, out = []) {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next" || entry === "generated") continue;
      const p = path.join(dir, entry);
      const s = statSync(p);
      if (s.isDirectory()) listFiles(p, out);
      else if (/\.tsx$/.test(entry)) out.push(p);
    }
    return out;
  }

  const premiumClassRe = /(bg-premium|text-premium|border-premium|var\(--color-premium)/;
  const clickableRe = /(onClick=|onPress=|href=|<Button\b)/;

  let premiumViolations = [];
  for (const file of listFiles(path.join(root, "src"))) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (premiumClassRe.test(line) && clickableRe.test(line)) {
        premiumViolations.push(`${path.relative(root, file)}:${i + 1}: ${line.trim()}`);
      }
    }
  }

  console.log("\n--- premium-on-clickable guard ---");
  if (premiumViolations.length === 0) {
    console.log("OK  no premium token found on a clickable element");
  } else {
    for (const v of premiumViolations) console.log(`FAIL ${v}`);
  }

  console.log("\n--- summary ---");
  console.log(`contrast: ${pairs.length - contrastFailures}/${pairs.length} pairs pass`);
  console.log(`premium misuse: ${premiumViolations.length} violation(s)`);

  if (contrastFailures > 0 || premiumViolations.length > 0) {
    process.exitCode = 1;
  }
}
