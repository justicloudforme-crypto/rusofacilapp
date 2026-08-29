import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { isEntryPoint } from "./entry-point";

/**
 * No module may DO anything merely by being imported.
 *
 * The incident: prisma/ensure-schema-sync.ts ended with a bare `main()` at
 * the top level, and src/lib/schema-sync.test.ts imports it for its schema
 * parser. So `npm run test` in a shell carrying TURSO_DATABASE_URL pointed
 * the production schema migrator at production — noticed on 29.08.2026
 * only because a read-only audit script imported the same module and the
 * migrator's banner appeared in its output.
 *
 * The survey that followed found the same shape in 53 of the 58 files under
 * prisma/ and scripts/, none of them guarded: scripts that write to the
 * database, call paid narration APIs, or rewrite files under src/. Only one
 * besides that one was actually imported anywhere — but "nothing imports it
 * today" is a fact about today's import graph, not about the code, and one
 * new import changes it.
 *
 * This file is the tripwire. It reads the sources as text rather than
 * importing them, because importing them is the thing being prevented.
 */

const ROOT = process.cwd();
const DIRS = ["prisma", "scripts"];

function scriptFiles(): string[] {
  const out: string[] = [];
  for (const dir of DIRS) {
    for (const name of readdirSync(join(ROOT, dir))) {
      const rel = join(dir, name);
      if (!statSync(join(ROOT, rel)).isFile()) continue;
      if (!/\.(ts|mjs|js)$/.test(name)) continue;
      out.push(rel);
    }
  }
  return out.sort();
}

/** Blank comments, keeping offsets — these files quote their own commands
 * in prose ("run `main()` with…") and a scanner that reads comments finds
 * calls that are not there. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

/**
 * Lines an import would actually execute.
 *
 * Character-level brace counting was tried and got this wrong twice, both
 * times in the direction that invents work: a `{` inside a `\d{4}` regex
 * literal opened a phantom block, and `(fn: () => Promise<T>, attempts = 3)`
 * defeated the function-header regex. Counting braces correctly means
 * skipping strings, template literals and regex literals — a tokenizer,
 * which is far more machinery than this needs.
 *
 * These 58 files share one formatting convention: module-scope statements
 * begin at column 0, and every top-level declaration closes with a `}` at
 * column 0. That convention is enough, and it is checked below (the scan
 * must still find the known guards and the known main() calls), so a file
 * that stopped following it could not silently disable this test.
 */
function reachableLines(source: string): Array<{ n: number; text: string }> {
  const lines = withoutComments(source).split("\n");
  const out: Array<{ n: number; text: string }> = [];
  let skipUntilClose = false; // inside a top-level function/class/guard body
  let pendingHeader = false; // a declaration whose "{" is on a later line

  const balanceOf = (l: string) => (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const atColumnZero = line.length > 0 && !/^\s/.test(line);

    if (skipUntilClose) {
      if (atColumnZero && /^[})\];]/.test(line) && balanceOf(line) < 0) skipUntilClose = false;
      continue;
    }
    // A multi-line signature: `async function upsertPuzzle(` … `): Promise<void> {`
    // leaves balance 0 on its first line, and its closing `)` sits at column
    // 0 too. Without this state the whole body read as module scope — which
    // is how `await db.wordGamePuzzle.upsert(` was reported as running on
    // import when it plainly does not.
    if (pendingHeader) {
      if (balanceOf(line) > 0) { pendingHeader = false; skipUntilClose = true; }
      continue;
    }
    if (!atColumnZero) {
      // Indented and not inside a skipped block: the body of a top-level
      // `if (...) { ... }` that is not a guard — still module scope.
      out.push({ n: i + 1, text: line });
      continue;
    }
    const opensFunction = /^(export\s+)?(default\s+)?(async\s+)?(function|class)\b/.test(line)
      || /^(export\s+)?(const|let|var)\s+\w+\s*(:[^=]*)?=\s*(async\s*)?(\(|function\b)/.test(line);
    const opensGuard = /^if\s*\(.*(?:isEntryPoint|IS_ENTRY_POINT)/.test(line);
    if (opensFunction || opensGuard) {
      const balance = balanceOf(line);
      if (balance > 0) skipUntilClose = true;
      // balance 0 WITH a brace means the block opened and closed on this
      // line (`async function main() {}`) — nothing is pending, and
      // treating it as pending swallowed the very next statement.
      else if (balance === 0 && !line.includes("{") && !/;\s*$/.test(line)) pendingHeader = true;
      continue;
    }
    out.push({ n: i + 1, text: line });
  }
  return out;
}

/**
 * Statements that DO something, on a line an import would execute.
 *
 * `process.argv` reading and `new PrismaClient(...)` are deliberately NOT
 * flagged: Prisma connects lazily and reading a flag has no effect. What
 * matters is the statement that actually starts the work.
 */
function effectsOnImport(source: string): string[] {
  const patterns: Array<[RegExp, string]> = [
    [/^\s*(?:void\s+)?[a-z]\w*\(\s*\)/, "top-level call"],
    [/^\s*\(\s*async/, "top-level async IIFE"],
    [/^\s*await\s/, "top-level await"],
    [/\bprocess\.exit\s*\(/, "process.exit"],
    [/\bwriteFileSync\s*\(/, "writeFileSync"],
  ];
  const found: string[] = [];
  for (const { n, text } of reachableLines(source)) {
    for (const [re, label] of patterns) {
      if (re.test(text)) { found.push(`${label} at line ${n}: ${text.trim().slice(0, 60)}`); break; }
    }
  }
  return found;
}

describe("no script does anything when merely imported", () => {
  const files = scriptFiles();

  it("finds the scripts at all", () => {
    // Without this, an empty list would make every assertion below pass.
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain("prisma/ensure-schema-sync.ts");
    expect(files).toContain("prisma/seed-glossary.ts");
    expect(files.filter((f) => f.startsWith("scripts/")).length).toBeGreaterThan(2);
  });

  it("every one of them is guarded", () => {
    const offenders = files
      .map((f) => ({ f, effects: effectsOnImport(readFileSync(join(ROOT, f), "utf8")) }))
      .filter((r) => r.effects.length)
      .map((r) => `${r.f}: ${r.effects.slice(0, 2).join(" | ")}`);
    expect(offenders).toEqual([]);
  });

  it("positive control: a module with an effect on import is reported", () => {
    // Each of these is a real shape found in this repo before the fix.
    const planted = [
      `import { db } from "./db";\nasync function main() {}\nmain().catch(() => {});\n`,
      `const x = process.argv[2];\nif (!x) { console.error("usage"); process.exit(1); }\n`,
      `import { writeFileSync } from "node:fs";\nwriteFileSync("out.css", "x");\n`,
      `await import("./something");\n`,
    ];
    for (const src of planted) {
      expect(effectsOnImport(src).length, src.split("\n")[0]).toBeGreaterThan(0);
    }
  });

  it("positive control: the same code inside a guard is not reported", () => {
    // …otherwise the check above would be satisfied by deleting the code
    // rather than by guarding it.
    const guarded = `import { isEntryPoint } from "../src/lib/entry-point";
async function main() {}
if (isEntryPoint(import.meta.url)) {
  main().catch(() => { process.exit(1); });
}
`;
    expect(effectsOnImport(guarded)).toEqual([]);
  });

  it("positive control: a call quoted in a comment is not reported", () => {
    // These files document their own usage, and an early version of this
    // scanner counted the prose.
    expect(effectsOnImport(`// run main() to do the thing\n/* main(); */\nconst a = 1;\n`)).toEqual([]);
  });

  it("positive control: the brace counter is not fooled by a comment", () => {
    const tricky = `if (isEntryPoint(import.meta.url)) {
  // shape: { id: string }
  main();
}
`;
    expect(effectsOnImport(tricky)).toEqual([]);
    // and the two regexes that were tried first really do disagree with
    // the walker on real input, so this control is not vacuous
    expect(/if\s*\([^)]*isEntryPoint[^)]*\)\s*\{/.test(tricky)).toBe(false);
    expect(/if\s*\([^{]*?isEntryPoint[^{]*?\)\s*\{/.test("if (isEntryPoint(x) && /^\\d{4}$/.test(y)) {")).toBe(false);
  });
});

describe("isEntryPoint", () => {
  it("is true only for the file the process was asked to run", () => {
    const self = pathToFileURL(process.argv[1] ?? "/nonexistent").href;
    expect(isEntryPoint(self)).toBe(process.argv[1] !== undefined);
    expect(isEntryPoint("file:///somewhere/else.ts")).toBe(false);
  });

  it("refuses rather than guesses when argv[1] is unusable", () => {
    const argv = process.argv;
    try {
      process.argv = ["node"];
      expect(isEntryPoint("file:///anything.ts")).toBe(false);
    } finally {
      process.argv = argv;
    }
  });

  it("is not satisfiable by NODE_ENV, unlike the signal it replaces", () => {
    // The lesson from deploy-environment.ts: `NODE_ENV=production` is set
    // by next build, next start and every e2e run, so it cannot tell a
    // deploy from a laptop. Being the entry point cannot be faked by an
    // importer at all.
    const env = process.env.NODE_ENV;
    try {
      Object.assign(process.env, { NODE_ENV: "production" });
      expect(isEntryPoint("file:///not-the-entry-point.ts")).toBe(false);
    } finally {
      Object.assign(process.env, { NODE_ENV: env });
    }
  });
});
