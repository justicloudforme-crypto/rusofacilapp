/**
 * Static, offline quality audit for word-games clues (crossword +
 * Sopa de Letras) — sibling to check-grammar.ts and
 * check-lessons-grammar.ts (Window 3 extended to word games). CHECK ONLY —
 * never rewrites anything.
 *
 * Checks each UNIQUE (word, clue) pair once, not once per puzzle it
 * appears in — the same clue is reused across many puzzle instances/rungs,
 * so deduping first is a ~9x cost difference (5952 unique pairs vs 55062
 * placements measured against the current local catalog).
 *
 * Two things worth flagging, distinct from check-grammar.ts's scope:
 *  1. Grammar/typos in the clue text itself (same categories as usual).
 *  2. Clue-answer mismatch: does the clue actually, unambiguously point to
 *     this specific word? A wrong or ambiguous clue makes a puzzle
 *     unsolvable or misleading even if the clue text itself is
 *     grammatically perfect — worth catching separately.
 *
 * Reuses GrammarCheckResult: entityType "WordGameClue", entityId is a
 * stable hash of `${word}|${clue}` (not the puzzle id — the same pair can
 * appear in many puzzles, and re-checking it once covers all of them),
 * fieldName is always "clue".
 *
 * Usage:
 *   npm run check:wordgames-clues
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run check:wordgames-clues
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import type { GrammarFinding } from "../src/lib/grammar-check/types";

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";

const MAX_ITEMS_PER_BATCH = 20;
const MAX_CHARS_PER_BATCH = 6000;

interface Placement {
  word: string;
  clue?: string;
}

interface CheckItem {
  word: string;
  clue: string;
  entityId: string;
  hash: string;
  /** Which puzzle type(s) this exact (word, clue) pair is actually used
   * in. Matters for interpretation: crossword hides the word's letters,
   * so a clue that gives the answer away (directly, or via an obvious
   * cognate) defeats the puzzle. Word-search shows the letters already —
   * there's nothing to spoil — so a direct/cognate translation there is
   * a normal vocabulary aid, not a defect. A pair used in BOTH is judged
   * by the stricter (crossword) standard. */
  usedIn: "WORD_SEARCH" | "CROSSWORD" | "BOTH";
}

function hashText(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex");
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** i));
    }
  }
  throw new Error("unreachable");
}

async function collectUniqueItems(): Promise<CheckItem[]> {
  const puzzles = await db.wordGamePuzzle.findMany({ select: { type: true, words: true } });
  const unique = new Map<string, { word: string; clue: string; types: Set<string> }>();

  for (const p of puzzles) {
    const placements: Placement[] = JSON.parse(p.words);
    for (const placement of placements) {
      if (!placement.clue) continue;
      const key = `${placement.word}|${placement.clue}`;
      if (!unique.has(key)) unique.set(key, { word: placement.word, clue: placement.clue, types: new Set() });
      unique.get(key)!.types.add(p.type);
    }
  }

  return [...unique.entries()].map(([key, { word, clue, types }]) => ({
    word,
    clue,
    entityId: createHash("sha256").update(key, "utf-8").digest("hex").slice(0, 32),
    hash: hashText(clue),
    usedIn: types.size > 1 ? "BOTH" : (types.values().next().value as "WORD_SEARCH" | "CROSSWORD"),
  }));
}

function makeBatches(items: CheckItem[]): CheckItem[][] {
  const batches: CheckItem[][] = [];
  let current: CheckItem[] = [];
  let currentChars = 0;
  for (const item of items) {
    const itemChars = item.word.length + item.clue.length;
    const wouldExceed = current.length >= MAX_ITEMS_PER_BATCH || currentChars + itemChars > MAX_CHARS_PER_BATCH;
    if (wouldExceed && current.length > 0) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(item);
    currentChars += itemChars;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

const TOOL_SCHEMA = {
  name: "emit_clue_findings",
  description: "Report clue-quality findings for each numbered (word, clue) pair below.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        description: "One entry per input item, in the same order, even when findings is empty.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["index", "findings"],
          properties: {
            index: { type: "integer" },
            findings: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["errorType", "excerpt", "explanation", "suggestion"],
                properties: {
                  errorType: {
                    type: "string",
                    description: "e.g. 'grammar', 'typo', 'clue-answer mismatch', 'ambiguous clue', 'giveaway (reveals the answer word directly)'.",
                  },
                  excerpt: { type: "string" },
                  explanation: { type: "string" },
                  suggestion: { type: "string", description: "For reviewer reference only — never applied automatically." },
                },
              },
            },
          },
        },
      },
    },
  },
};

function puzzleContext(usedIn: CheckItem["usedIn"]): string {
  if (usedIn === "WORD_SEARCH") {
    return "word-search only (letters are already visible in the grid — the clue is just a vocabulary aid; direct translation, even of a cognate/loanword, is FINE and should NOT be flagged as a giveaway)";
  }
  return "used in a crossword (letters are hidden)";
}

function buildPrompt(batch: CheckItem[]): string {
  const numbered = batch
    .map(
      (item, i) =>
        `[${i}] answer word: "${item.word}" | clue (Spanish, shown to the student): "${item.clue}" | puzzle type: ${puzzleContext(item.usedIn)}`
    )
    .join("\n\n");

  return `You are reviewing clues for Russian-vocabulary word-search and crossword puzzles aimed at Spanish-speaking learners. For each numbered pair, the "clue" is what the student sees; they must guess the Russian "answer word" from it. Each item states which puzzle type it's used in.

Check for:
1. Grammar or spelling errors in the clue text itself.
2. Whether the clue clearly and correctly points to that specific answer word (not a different word, not multiple equally-valid words).
3. "giveaway" — ONLY report this for crossword items, and ONLY when the Spanish clue word (or, for a masked example-sentence clue, the word the blank obviously stands for given the surrounding sentence) is itself a near-cognate/loanword of the Russian answer — phonetically close enough ("караоке"/"karaoke", "майонез"/"mayonesa") that no real inference is needed. Do NOT report "giveaway" just because a crossword clue is a plain direct translation of an unrelated-looking word (e.g. "caro" for "дорого") — a direct-translation clue testing whether the student recognizes the word's meaning is this platform's deliberate, already-reviewed design for A1/A2 vocabulary, not a bug. The problem is specifically cognates defeating that design, not the design itself.

Do NOT flag a clue just for being short or a single word/phrase — that's normal for this format. Only report genuine problems.

${numbered}`;
}

async function callClaude(apiKey: string, batch: CheckItem[]): Promise<Map<number, GrammarFinding[]>> {
  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 8000,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "emit_clue_findings" },
      messages: [{ role: "user", content: buildPrompt(batch) }],
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) throw new Error(`anthropic_error_${response.status}`);

  const rawBody = await response.text();
  let data: { content?: { type: string }[] };
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error("claude_invalid_response");
  }

  const toolUse = (data.content ?? []).find((block: { type: string }) => block.type === "tool_use") as
    | { input?: { results?: { index: number; findings: GrammarFinding[] }[] } }
    | undefined;

  if (!toolUse?.input?.results) throw new Error("no_tool_output");

  return new Map(toolUse.input.results.map((r) => [r.index, r.findings]));
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set.");
    process.exitCode = 1;
    return;
  }

  const allItems = await collectUniqueItems();

  const existingResults = await db.grammarCheckResult.findMany({
    where: { entityType: "WordGameClue" },
    select: { entityId: true, contentHash: true, status: true },
  });
  const existingByKey = new Map(existingResults.map((r) => [r.entityId, r]));

  const toCheck = allItems.filter((item) => {
    const existing = existingByKey.get(item.entityId);
    return !(existing && existing.status === "CLEAN" && existing.contentHash === item.hash);
  });

  console.log(`${allItems.length} unique (word, clue) pair(s), ${allItems.length - toCheck.length} unchanged since last CLEAN check, ${toCheck.length} to check.`);

  if (toCheck.length === 0) {
    console.log("Nothing to check.");
    return;
  }

  const batches = makeBatches(toCheck);
  console.log(`Sending ${batches.length} batch(es) to Claude...\n`);

  let cleanCount = 0;
  let flaggedCount = 0;
  const flaggedSummaries: string[] = [];

  for (const [batchIndex, batch] of batches.entries()) {
    let resultsByIndex: Map<number, GrammarFinding[]>;
    try {
      resultsByIndex = await callClaude(apiKey, batch);
    } catch (err) {
      console.error(`Batch ${batchIndex + 1}/${batches.length} failed: ${(err as Error).message} — skipping, will retry next run.`);
      continue;
    }

    for (const [i, item] of batch.entries()) {
      const findings = resultsByIndex.get(i) ?? [];
      const status = findings.length > 0 ? "FLAGGED" : "CLEAN";

      try {
        await withRetry(() =>
          db.grammarCheckResult.upsert({
            where: {
              entityType_entityId_fieldName: { entityType: "WordGameClue", entityId: item.entityId, fieldName: "clue" },
            },
            create: {
              entityType: "WordGameClue",
              entityId: item.entityId,
              fieldName: "clue",
              contentHash: item.hash,
              status,
              findings: JSON.stringify(findings),
            },
            update: { contentHash: item.hash, status, findings: JSON.stringify(findings), checkedAt: new Date() },
          })
        );
      } catch (err) {
        console.error(`  Failed to save WordGameClue "${item.word}" after retries: ${(err as Error).message} — will retry next run.`);
        continue;
      }

      if (status === "CLEAN") {
        cleanCount++;
      } else {
        flaggedCount++;
        flaggedSummaries.push(`  "${item.word}" (clue: "${item.clue}"): ${findings.map((f) => f.errorType).join(", ")}`);
      }
    }

    console.log(`Batch ${batchIndex + 1}/${batches.length} done (${batch.length} items).`);
  }

  console.log(`\n${cleanCount} clean, ${flaggedCount} flagged.`);
  if (flaggedSummaries.length > 0) {
    console.log("\nFlagged clues:");
    for (const line of flaggedSummaries) console.log(line);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
