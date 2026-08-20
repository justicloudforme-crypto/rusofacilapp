/**
 * Static, offline grammar audit — Window 3 of
 * docs/plan-2026-08-19-three-windows.md. Distinct from
 * prisma/check-typos.ts: that script is a cheap deterministic heuristic
 * (mixed scripts, double spaces, repeated words), NOT grammar. This script
 * sends each field's Russian text to Claude and asks specifically about
 * grammatical correctness — case agreement, aspect/conjugation, word order
 * — nothing else.
 *
 * Content-hash gated: every (entityType, entityId, fieldName) whose text
 * still hashes to the same value as its last CLEAN check is skipped, so a
 * re-run only spends LLM calls on text that actually changed since the
 * last clean pass. This is the whole point of the GrammarCheckResult table
 * — never re-bill for unchanged content.
 *
 * The app NEVER calls this at request time — it only reads the stored
 * verdict (once an admin UI for that exists). This script is a gate you
 * run before shipping content, not a live service.
 *
 * Usage (against local dev.db, the default):
 *   npm run check:grammar
 *
 * Usage (against production — same Turso credentials src/lib/db.ts uses):
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run check:grammar
 *
 * Requires ANTHROPIC_API_KEY. Exits non-zero if anything is FLAGGED, so it
 * can gate CI/a pre-ship checklist without extra plumbing.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { GRAMMAR_CHECK_FIELDS, type GrammarFinding } from "../src/lib/grammar-check/types";

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";

// Keeps each request comfortably inside a normal response budget and a
// single failed/slow request from stalling the whole run for too long.
const MAX_ITEMS_PER_BATCH = 20;
const MAX_CHARS_PER_BATCH = 6000;

interface CheckItem {
  entityType: string;
  entityId: string;
  fieldName: string;
  text: string;
  hash: string;
}

function hashText(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex");
}

async function collectItems(): Promise<CheckItem[]> {
  const items: CheckItem[] = [];

  for (const [entityType, fields] of Object.entries(GRAMMAR_CHECK_FIELDS)) {
    // Not a generic ORM abstraction on purpose — four models, four shapes,
    // easier to read as an explicit switch than a "clever" generic fetcher.
    let rows: { id: string; [key: string]: unknown }[] = [];
    if (entityType === "FlashcardCard") {
      rows = await db.flashcardCard.findMany({ select: { id: true, russian: true, exampleRu: true } });
    } else if (entityType === "Idiom") {
      rows = await db.idiom.findMany({ select: { id: true, phrase: true, contextExampleRu: true } });
    } else if (entityType === "GlossaryTerm") {
      rows = await db.glossaryTerm.findMany({ select: { id: true, term: true, russianEquivalent: true } });
    } else if (entityType === "Story") {
      rows = await db.story.findMany({ select: { id: true, title: true, text: true } });
    }

    for (const row of rows) {
      for (const fieldName of fields) {
        const text = row[fieldName];
        if (typeof text !== "string" || !text.trim()) continue;
        items.push({ entityType, entityId: row.id, fieldName, text, hash: hashText(text) });
      }
    }
  }

  return items;
}

function makeBatches(items: CheckItem[]): CheckItem[][] {
  const batches: CheckItem[][] = [];
  let current: CheckItem[] = [];
  let currentChars = 0;

  for (const item of items) {
    const wouldExceed =
      current.length >= MAX_ITEMS_PER_BATCH || currentChars + item.text.length > MAX_CHARS_PER_BATCH;
    if (wouldExceed && current.length > 0) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(item);
    currentChars += item.text.length;
  }
  if (current.length > 0) batches.push(current);

  return batches;
}

const GRAMMAR_TOOL_SCHEMA = {
  name: "emit_grammar_findings",
  description: "Report grammar findings for each numbered Russian text below.",
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
            index: { type: "integer", description: "0-based position in the input list." },
            findings: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["errorType", "excerpt", "explanation", "suggestion"],
                properties: {
                  errorType: {
                    type: "string",
                    description: "Short category, e.g. 'case agreement', 'verb aspect', 'word order', 'conjugation'.",
                  },
                  excerpt: { type: "string", description: "The exact offending fragment, not the whole text." },
                  explanation: { type: "string", description: "Why it's wrong, in one sentence." },
                  suggestion: { type: "string", description: "The corrected fragment." },
                },
              },
            },
          },
        },
      },
    },
  },
};

function buildPrompt(batch: CheckItem[]): string {
  const numbered = batch
    .map((item, i) => `[${i}] (${item.entityType}.${item.fieldName}) ${item.text}`)
    .join("\n\n");

  return `You are a strict Russian grammar reviewer for a language-learning platform aimed at Spanish speakers. Every text below is meant to be grammatically correct, natural Russian.

Check ONLY grammar: case agreement (падежи), verb aspect and conjugation (вид, спряжение), noun/adjective/verb agreement (число, род), and word order. Do NOT flag spelling, style, register, punctuation, or anything already handled by a separate typo checker.

For each numbered item, report every genuine grammar error you find (there may be zero, one, or several). Do not invent problems in text that is correct — when in doubt, leave it out.

${numbered}`;
}

async function callClaude(
  apiKey: string,
  batch: CheckItem[]
): Promise<Map<number, GrammarFinding[]>> {
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
      tools: [GRAMMAR_TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "emit_grammar_findings" },
      messages: [{ role: "user", content: buildPrompt(batch) }],
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    throw new Error(`anthropic_error_${response.status}`);
  }

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

  if (!toolUse?.input?.results) {
    throw new Error("no_tool_output");
  }

  return new Map(toolUse.input.results.map((r) => [r.index, r.findings]));
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set.");
    process.exitCode = 1;
    return;
  }

  const allItems = await collectItems();

  const existingResults = await db.grammarCheckResult.findMany({
    select: { entityType: true, entityId: true, fieldName: true, contentHash: true, status: true },
  });
  const existingByKey = new Map(
    existingResults.map((r) => [`${r.entityType}:${r.entityId}:${r.fieldName}`, r])
  );

  const toCheck = allItems.filter((item) => {
    const existing = existingByKey.get(`${item.entityType}:${item.entityId}:${item.fieldName}`);
    return !(existing && existing.status === "CLEAN" && existing.contentHash === item.hash);
  });

  console.log(`${allItems.length} field(s) total, ${allItems.length - toCheck.length} unchanged since last CLEAN check, ${toCheck.length} to check.`);

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

      await db.grammarCheckResult.upsert({
        where: {
          entityType_entityId_fieldName: {
            entityType: item.entityType,
            entityId: item.entityId,
            fieldName: item.fieldName,
          },
        },
        create: {
          entityType: item.entityType,
          entityId: item.entityId,
          fieldName: item.fieldName,
          contentHash: item.hash,
          status,
          findings: JSON.stringify(findings),
        },
        update: {
          contentHash: item.hash,
          status,
          findings: JSON.stringify(findings),
          checkedAt: new Date(),
        },
      });

      if (status === "CLEAN") {
        cleanCount++;
      } else {
        flaggedCount++;
        flaggedSummaries.push(
          `  [${item.entityType}/${item.fieldName}] ${item.entityId}: ${findings.map((f) => f.errorType).join(", ")}`
        );
      }
    }

    console.log(`Batch ${batchIndex + 1}/${batches.length} done (${batch.length} items).`);
  }

  console.log(`\n${cleanCount} clean, ${flaggedCount} flagged.`);
  if (flaggedSummaries.length > 0) {
    console.log("\nFlagged fields:");
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
