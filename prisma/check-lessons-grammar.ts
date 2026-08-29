/**
 * Static, offline grammar audit for the 120-lesson curriculum
 * (src/lib/lessons/content.json) — sibling to check-grammar.ts (Window 3
 * of docs/plan-2026-08-19-three-windows.md), extended to lessons after the
 * first full run there. CHECK ONLY — never rewrites anything. Findings are
 * for manual review; see [[rusofasil]] session notes on why lessons in
 * particular must not be auto-fixed blindly: many Russian strings here are
 * also autograder answer keys (FillBlankExercise.answers,
 * ListeningTranscriptionExercise.acceptedAnswers, WordReorderExercise's
 * target order, MatchingExercise pairs) — rewriting the text without
 * touching the paired grading logic would silently mark a correct student
 * answer wrong. Every finding is tagged with its risk tier (see
 * src/lib/grammar-check/lessonFields.ts) so the report makes that
 * distinction impossible to miss.
 *
 * Reuses the GrammarCheckResult table: entityType "Lesson", entityId is
 * the lesson slug (e.g. "a1-1"), fieldName is the exact JSON path within
 * that lesson's content (e.g. "exercises[3].answers[0]") — same
 * content-hash gating as check-grammar.ts, so a re-run only re-checks
 * strings that actually changed since their last CLEAN check.
 *
 * Reads content.json directly (not src/lib/lessons/content.ts, which is
 * tagged `import "server-only"` and won't resolve under plain tsx — see
 * check-media-embeds.ts's file header for the same issue elsewhere). This
 * also means it checks the static baseline, not per-lesson DB admin
 * overrides — the right source for a content audit; overrides are rare,
 * reviewed-by-hand admin edits.
 *
 * Usage:
 *   npm run check:lessons
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run check:lessons
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { collectLessonItems, type LessonFieldRisk } from "../src/lib/grammar-check/lessonFields";
import type { LessonContent } from "../src/lib/lessons/types";
import type { GrammarFinding } from "../src/lib/grammar-check/types";

import { isEntryPoint } from "../src/lib/entry-point";
const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";

// Lessons are mostly many SHORT strings (vocab words, single examples), so
// batching by a flat item count (like check-grammar.ts) would fragment
// into hundreds of tiny, overhead-dominated batches. Batching by LESSON
// instead keeps each batch coherent (one lesson's worth of context) and
// stays well under the char cap for all but the longest lessons — a
// per-lesson char cap still splits the rare outlier.
const MAX_CHARS_PER_BATCH = 6000;

interface CheckItem {
  lessonId: string;
  path: string;
  text: string;
  risk: LessonFieldRisk;
  hash: string;
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

function collectAllItems(): CheckItem[] {
  const data = JSON.parse(readFileSync("src/lib/lessons/content.json", "utf-8")) as Record<string, LessonContent>;
  const items: CheckItem[] = [];
  for (const [lessonId, content] of Object.entries(data)) {
    for (const item of collectLessonItems(content)) {
      items.push({ lessonId, path: item.path, text: item.text, risk: item.risk, hash: hashText(item.text) });
    }
  }
  return items;
}

/** Groups items lesson-by-lesson into batches, splitting a single lesson
 * across multiple batches only if it alone exceeds the char cap. */
function makeBatches(items: CheckItem[]): CheckItem[][] {
  const byLesson = new Map<string, CheckItem[]>();
  for (const item of items) {
    if (!byLesson.has(item.lessonId)) byLesson.set(item.lessonId, []);
    byLesson.get(item.lessonId)!.push(item);
  }

  const batches: CheckItem[][] = [];
  for (const lessonItems of byLesson.values()) {
    let current: CheckItem[] = [];
    let currentChars = 0;
    for (const item of lessonItems) {
      if (currentChars + item.text.length > MAX_CHARS_PER_BATCH && current.length > 0) {
        batches.push(current);
        current = [];
        currentChars = 0;
      }
      current.push(item);
      currentChars += item.text.length;
    }
    if (current.length > 0) batches.push(current);
  }
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
                  errorType: { type: "string" },
                  excerpt: { type: "string", description: "The exact offending fragment, not the whole text." },
                  explanation: { type: "string" },
                  suggestion: { type: "string", description: "The corrected fragment (for reviewer reference only — never applied automatically here)." },
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
  const numbered = batch.map((item, i) => `[${i}] (Lesson ${item.lessonId}, ${item.path}) ${item.text}`).join("\n\n");

  return `You are a strict Russian grammar reviewer for a language-learning platform aimed at Spanish speakers. Every text below is meant to be grammatically correct, natural Russian, appropriate for its role in a lesson (vocabulary word, example sentence, dialogue line, exercise text, etc.).

Check ONLY grammar: case agreement (падежи), verb aspect and conjugation (вид, спряжение), noun/adjective/verb agreement (число, род), and word order. Do NOT flag spelling, style, register, punctuation, or short single-word/short-phrase items that are correct as standalone vocabulary (e.g. an infinitive or a bare noun is not an error just because it's not a full sentence).

For each numbered item, report every genuine grammar error you find (there may be zero, one, or several). Do not invent problems in text that is correct — when in doubt, leave it out.

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
      tools: [GRAMMAR_TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "emit_grammar_findings" },
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

/** Deletes any Lesson GrammarCheckResult row whose (lessonId, path) no
 * longer appears in the current collectAllItems() output — same stale-row
 * problem as word-games' cleanupStaleClues: upsert never deletes, and a
 * walker change (like fill-blank/word-reorder now checking reconstructed
 * sentences under new paths instead of the old before/after/answers[N]/
 * words[N] fragments) retires a batch of paths at once. Without this,
 * stale FLAGGED rows for paths that don't exist anymore would keep
 * showing up in every report forever. */
async function cleanupStaleLessonFields(currentKeys: Set<string>): Promise<number> {
  const rows = await db.grammarCheckResult.findMany({
    where: { entityType: "Lesson" },
    select: { entityId: true, fieldName: true },
  });
  const staleRows = rows.filter((r) => !currentKeys.has(`${r.entityId}:${r.fieldName}`));
  if (staleRows.length === 0) return 0;
  let deleted = 0;
  for (const r of staleRows) {
    await db.grammarCheckResult.deleteMany({
      where: { entityType: "Lesson", entityId: r.entityId, fieldName: r.fieldName },
    });
    deleted++;
  }
  return deleted;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set.");
    process.exitCode = 1;
    return;
  }

  const allItems = collectAllItems();

  const deleted = await cleanupStaleLessonFields(new Set(allItems.map((i) => `${i.lessonId}:${i.path}`)));
  if (deleted > 0) console.log(`Deleted ${deleted} stale Lesson result(s) for fields no longer in content.json.`);

  const existingResults = await db.grammarCheckResult.findMany({
    where: { entityType: "Lesson" },
    select: { entityId: true, fieldName: true, contentHash: true, status: true },
  });
  const existingByKey = new Map(existingResults.map((r) => [`${r.entityId}:${r.fieldName}`, r]));

  const toCheck = allItems.filter((item) => {
    const existing = existingByKey.get(`${item.lessonId}:${item.path}`);
    return !(existing && existing.status === "CLEAN" && existing.contentHash === item.hash);
  });

  console.log(
    `${allItems.length} field(s) total across ${new Set(allItems.map((i) => i.lessonId)).size} lessons, ${allItems.length - toCheck.length} unchanged since last CLEAN check, ${toCheck.length} to check.`
  );
  const riskCounts = toCheck.reduce<Record<string, number>>((acc, i) => {
    acc[i.risk] = (acc[i.risk] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`By risk tier: ${JSON.stringify(riskCounts)}`);

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
              entityType_entityId_fieldName: { entityType: "Lesson", entityId: item.lessonId, fieldName: item.path },
            },
            create: {
              entityType: "Lesson",
              entityId: item.lessonId,
              fieldName: item.path,
              contentHash: item.hash,
              status,
              findings: JSON.stringify(findings),
            },
            update: { contentHash: item.hash, status, findings: JSON.stringify(findings), checkedAt: new Date() },
          })
        );
      } catch (err) {
        console.error(`  Failed to save Lesson ${item.lessonId}/${item.path} after retries: ${(err as Error).message} — will retry next run.`);
        continue;
      }

      if (status === "CLEAN") {
        cleanCount++;
      } else {
        flaggedCount++;
        flaggedSummaries.push(
          `  [${item.risk}] Lesson ${item.lessonId}/${item.path}: ${findings.map((f) => f.errorType).join(", ")}`
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

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
