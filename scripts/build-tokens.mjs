#!/usr/bin/env node
// Generates src/app/tokens.generated.css from tokens.json (the platform-
// independent source of truth). Never hand-edit the generated file — edit
// tokens.json and re-run `npm run build:tokens`.
//
// Tailwind v4 has no tailwind.config.ts in this project — its config lives
// entirely in CSS via `@theme`. The "@theme inline" block emitted below IS
// the Tailwind config for this project; that's a deliberate choice to match
// the existing globals.css architecture rather than introduce a second,
// competing config format.

import { readFileSync, writeFileSync } from "node:fs";
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

const scaleSteps = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];

function scaleVars(prefix, family) {
  return scaleSteps
    .filter((step) => step in family)
    .map((step) => `  --color-${prefix}-${step}: ${family[step]};`)
    .join("\n");
}

function semanticTriad(prefix, obj) {
  return ["subtle", "default", "strong"]
    .filter((k) => k in obj)
    .map((k) => `  --color-${prefix}-${k}: ${obj[k]};`)
    .join("\n");
}

const { primary, neutral, premium, semantic, level } = tokens.color;

const rootBlock = `:root {
  /* --- primitive scales, generated from tokens.json, do not hand-edit --- */
${scaleVars("primary", primary)}
${scaleVars("neutral", neutral)}
${scaleVars("premium", premium)}
${semanticTriad("success", semantic.success)}
${semanticTriad("warning", semantic.warning)}
${semanticTriad("danger", semantic.danger)}
  --color-folk-red: ${tokens.color.decorativeRed.default};
${Object.entries(level)
  .filter(([k]) => !k.startsWith("_") && k !== "contrastNote")
  .map(([lvl, shades]) => `  --color-level-${lvl}-subtle: ${shades.subtle};\n  --color-level-${lvl}-default: ${shades.default};\n  --color-level-${lvl}-strong: ${shades.strong};`)
  .join("\n")}

  /* --- semantic aliases: components should reference THESE, never the raw
     scale steps above, so a single rule ("primary is the only clickable
     accent") stays enforceable --- */
  --color-primary: var(--color-primary-600);
  --color-primary-hover: var(--color-primary-700);
  --color-on-primary: #ffffff;
  /* Text/link/icon usages that render the primary color directly against the
     page background (not inside a filled button) need a different value per
     theme — primary-600 itself is unreadable as plain text on the dark
     background (1.74:1). Buttons don't use this alias: their fill is
     self-contained (white-on-primary-600 stays 10.47:1 in either theme). */
  --color-primary-text: var(--color-primary-600);
  --color-premium: var(--color-premium-500);
  --color-premium-text: var(--color-premium-700);
  --color-danger: var(--color-danger-default);
  --color-success: var(--color-success-default);
  --color-warning: var(--color-warning-default);
  --color-background: var(--color-neutral-50);
  --color-surface: var(--color-neutral-100);
  --color-foreground: #241c15;

  /* --- typography --- */
  --font-sans: ${tokens.typography.fontFamily.sans};
  --font-serif: ${tokens.typography.fontFamily.serif};
  --font-mono: ${tokens.typography.fontFamily.mono};
${Object.entries(tokens.typography.fontSize)
  .filter(([name]) => !name.startsWith("_"))
  .map(([name, def]) => `  --text-${name.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${def.clamp};`)
  .join("\n")}
  --leading-tight: ${tokens.typography.lineHeight.tight};
  --leading-normal: ${tokens.typography.lineHeight.normal};
  --leading-relaxed: ${tokens.typography.lineHeight.relaxed};

  /* --- spacing (4px multiples, matches Tailwind's own default 0.25rem unit;
     listed here for cross-platform reuse, does not override Tailwind) --- */
${Object.entries(tokens.spacing)
  .map(([step, val]) => `  --space-${step}: ${val};`)
  .join("\n")}

  /* --- radius / shadow / motion --- */
${Object.entries(tokens.radius).map(([k, v]) => `  --radius-${k}: ${v};`).join("\n")}
${Object.entries(tokens.shadow).map(([k, v]) => `  --shadow-${k}: ${v};`).join("\n")}
${Object.entries(tokens.duration).map(([k, v]) => `  --duration-${k}: ${v};`).join("\n")}
${Object.entries(tokens.easing).map(([k, v]) => `  --ease-${k}: ${v};`).join("\n")}
}`;

const darkBlock = `:root[data-theme="dark"] {
  /* Same semantic aliases, repointed at brighter/legacy-preserved dark
     values — data-theme swap, zero duplicated component classes. */
  --color-primary-text: ${primary.darkText};
  --color-premium: ${premium.dark["500"]};
  --color-folk-red: ${tokens.color.decorativeRed.dark};
  --color-background: ${neutral.dark.background};
  --color-surface: ${neutral.dark.surface};
  --color-foreground: ${neutral.dark.foreground};
}`;

const themeBlock = `@theme inline {
  --color-background: var(--color-background);
  --color-foreground: var(--color-foreground);
  --color-surface: var(--color-surface);
  --color-primary: var(--color-primary);
  --color-primary-hover: var(--color-primary-hover);
  --color-primary-text: var(--color-primary-text);
  --color-on-primary: var(--color-on-primary);
  --color-premium: var(--color-premium);
  --color-premium-text: var(--color-premium-text);
  --color-danger: var(--color-danger);
  --color-success: var(--color-success);
  --color-warning: var(--color-warning);
  --color-folk-red: var(--color-folk-red);
${scaleSteps.map((s) => `  --color-primary-${s}: var(--color-primary-${s});`).join("\n")}
${scaleSteps.map((s) => `  --color-neutral-${s}: var(--color-neutral-${s});`).join("\n")}
${scaleSteps.map((s) => `  --color-premium-${s}: var(--color-premium-${s});`).join("\n")}
  --color-success-subtle: var(--color-success-subtle);
  --color-success-default: var(--color-success-default);
  --color-success-strong: var(--color-success-strong);
  --color-warning-subtle: var(--color-warning-subtle);
  --color-warning-default: var(--color-warning-default);
  --color-warning-strong: var(--color-warning-strong);
  --color-danger-subtle: var(--color-danger-subtle);
  --color-danger-default: var(--color-danger-default);
  --color-danger-strong: var(--color-danger-strong);
${Object.keys(level).filter((k) => !k.startsWith("_") && k !== "contrastNote").map((lvl) => `  --color-level-${lvl}-subtle: var(--color-level-${lvl}-subtle);\n  --color-level-${lvl}-default: var(--color-level-${lvl}-default);\n  --color-level-${lvl}-strong: var(--color-level-${lvl}-strong);`).join("\n")}
  --font-sans: var(--font-sans);
  --font-serif: var(--font-serif);
  --font-mono: var(--font-mono);
${Object.keys(tokens.typography.fontSize)
  .filter((name) => !name.startsWith("_"))
  .map((name) => { const k = name.replace(/([A-Z])/g, "-$1").toLowerCase(); return `  --text-${k}: var(--text-${k});`; })
  .join("\n")}
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-xl: var(--radius-xl);
  --radius-2xl: var(--radius-2xl);
  --radius-full: var(--radius-full);
  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-sheet: var(--shadow-sheet);
}`;

const output = `/* AUTO-GENERATED by scripts/build-tokens.mjs from tokens.json.
   Do not hand-edit — edit tokens.json and run \`npm run build:tokens\`.
   NOT YET IMPORTED into globals.css — staged for review (see AUDIT.md /
   design-system step 2). Importing this file + wiring components to the
   new classes is a separate, explicit next step. */

${rootBlock}

${darkBlock}

${themeBlock}
`;

if (IS_ENTRY_POINT) {
  writeFileSync(path.join(root, "src/app/tokens.generated.css"), output);
  console.log("Wrote src/app/tokens.generated.css");
}
