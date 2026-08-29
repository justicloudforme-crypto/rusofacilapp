/**
 * Heuristic QA sweep over every user-facing text field in the content
 * tables (FlashcardCard, Idiom, GlossaryTerm, Story) — looking for the
 * mechanical typo classes that are cheap to detect deterministically and
 * common in copy-pasted/mixed-source content, NOT a semantic spellchecker
 * (that would need per-word dictionaries for two languages and wouldn't
 * scale to thousands of rows here). Specifically flags:
 *
 *  - Mixed-script words: a single "word" containing BOTH Cyrillic and Latin
 *    letters (e.g. a Latin "a"/"e"/"o"/"p"/"x"/"y" typed by mistake in the
 *    middle of an otherwise-Cyrillic word, or vice versa) — this is the
 *    single highest-value check: it's invisible to the eye at normal
 *    reading size but breaks search/matching (see the flashcard search fix
 *    earlier this project), and is a very common real bug source from
 *    keyboard-layout slips or copy-paste between sources.
 *  - Double/multiple spaces, and leading/trailing whitespace.
 *  - A word immediately repeated ("что что", "el el").
 *  - Empty text in a field the schema treats as required content.
 *
 * Usage (against local dev.db, the default):
 *   npm run db:check-typos
 *
 * Usage (against production — export the same Turso credentials src/lib/db.ts
 * uses, then run the same command):
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run db:check-typos
 *
 * Prints a table-by-table report; exits non-zero if anything was flagged so
 * it can be wired into CI later without extra plumbing.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

import { isEntryPoint } from "../src/lib/entry-point";
const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = new PrismaClient({ adapter });

interface Finding {
  table: string;
  id: string;
  field: string;
  issue: string;
  excerpt: string;
}

const CYRILLIC = "\\p{Script=Cyrillic}";
const LATIN = "\\p{Script=Latin}";
// A "word" for these purposes is a maximal run of letters from either
// script plus combining marks — punctuation/digits/spaces are boundaries.
const WORD_RE = new RegExp(`[${CYRILLIC}${LATIN}]+`, "gu");
const HAS_CYRILLIC = new RegExp(CYRILLIC, "u");
const HAS_LATIN = new RegExp(LATIN, "u");
// IMPORTANT: JavaScript's \b is ASCII-only — it does NOT treat accented
// Unicode letters (á, í, ó, ñ, ü...) as "word" characters for boundary
// purposes, even with the /u flag. \b(\p{L}+)\s+\1\b on Spanish text
// fractures a word like "recibía" at the accent (\b sees a boundary right
// after "í" since "í" isn't in \b's ASCII definition), then can spuriously
// match the trailing fragment against an unrelated short word elsewhere —
// confirmed empirically: it produced 116 false "repeated word" hits, every
// one an artifact of this exact bug, not a real typo. Using explicit
// \p{L}-aware lookaround instead of \b sidesteps it entirely. Also
// restricted to a literal space run (not \s, which includes newlines) so a
// paragraph-end word can't spuriously "repeat" against a coincidentally
// identical paragraph-start word.
const REPEATED_WORD_RE = /(?<![\p{L}\p{N}])(\p{L}+) \1(?![\p{L}\p{N}])/giu;
// Single/double-letter function words (a, y, o, u, de, и, а, но...) recur
// constantly in normal Spanish/Russian text without being typos — only
// flag repeats of words long enough that accidental adjacency is unlikely.
const MIN_REPEATED_WORD_LENGTH = 3;

function excerpt(text: string, index: number, matchLength: number, radius = 40): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + matchLength + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function checkField(table: string, id: string, field: string, value: string | null | undefined): Finding[] {
  if (value == null) return [];
  const findings: Finding[] = [];

  if (value.trim().length === 0 && value.length > 0) {
    findings.push({ table, id, field, issue: "whitespace-only", excerpt: JSON.stringify(value) });
  }
  if (value !== value.trim() && value.trim().length > 0) {
    findings.push({ table, id, field, issue: "leading/trailing whitespace", excerpt: JSON.stringify(value.slice(0, 60)) });
  }
  {
    const m = / {2,}|\t/.exec(value);
    if (m) {
      findings.push({ table, id, field, issue: "double space / tab", excerpt: excerpt(value, m.index, m[0].length) });
    }
  }

  for (const m of value.matchAll(WORD_RE)) {
    const word = m[0];
    if (word.length < 2) continue;
    if (HAS_CYRILLIC.test(word) && HAS_LATIN.test(word)) {
      findings.push({ table, id, field, issue: "mixed Cyrillic/Latin word", excerpt: excerpt(value, m.index!, word.length) });
    }
  }

  for (const m of value.matchAll(REPEATED_WORD_RE)) {
    if (m[1].length < MIN_REPEATED_WORD_LENGTH) continue;
    findings.push({ table, id, field, issue: "repeated word", excerpt: excerpt(value, m.index!, m[0].length) });
  }

  return findings;
}

async function main() {
  const findings: Finding[] = [];

  const flashcards = await db.flashcardCard.findMany({
    select: { id: true, russian: true, transcription: true, translationEs: true, exampleRu: true, exampleEs: true },
  });
  for (const c of flashcards) {
    findings.push(...checkField("FlashcardCard", c.id, "russian", c.russian));
    findings.push(...checkField("FlashcardCard", c.id, "translationEs", c.translationEs));
    findings.push(...checkField("FlashcardCard", c.id, "exampleRu", c.exampleRu));
    findings.push(...checkField("FlashcardCard", c.id, "exampleEs", c.exampleEs));
    // transcription is a Latin-alphabet phonetic rendering of the Russian
    // word — Cyrillic showing up here (not "mixed", literally ANY
    // Cyrillic) is its own distinct bug class, checked separately below
    // rather than via checkField's mixed-word logic (a whole-Cyrillic
    // transcription would have zero Latin letters to trigger that check).
    const cyrillicInTranscription = new RegExp(CYRILLIC, "u").exec(c.transcription);
    if (cyrillicInTranscription) {
      findings.push({
        table: "FlashcardCard",
        id: c.id,
        field: "transcription",
        issue: "Cyrillic character in transcription (should be Latin phonetic)",
        excerpt: excerpt(c.transcription, cyrillicInTranscription.index, cyrillicInTranscription[0].length),
      });
    }
  }
  console.log(`FlashcardCard: scanned ${flashcards.length} rows`);

  const idioms = await db.idiom.findMany({
    select: {
      id: true,
      phrase: true,
      literalTranslation: true,
      spanishEquivalent: true,
      explanation: true,
      contextExampleRu: true,
      contextExampleEs: true,
    },
  });
  for (const i of idioms) {
    findings.push(...checkField("Idiom", i.id, "phrase", i.phrase));
    findings.push(...checkField("Idiom", i.id, "literalTranslation", i.literalTranslation));
    findings.push(...checkField("Idiom", i.id, "spanishEquivalent", i.spanishEquivalent));
    findings.push(...checkField("Idiom", i.id, "explanation", i.explanation));
    findings.push(...checkField("Idiom", i.id, "contextExampleRu", i.contextExampleRu));
    findings.push(...checkField("Idiom", i.id, "contextExampleEs", i.contextExampleEs));
  }
  console.log(`Idiom: scanned ${idioms.length} rows`);

  const glossary = await db.glossaryTerm.findMany({
    select: {
      id: true,
      term: true,
      definition: true,
      russianEquivalent: true,
      transcription: true,
      russianComparison: true,
      examples: true,
    },
  });
  for (const g of glossary) {
    findings.push(...checkField("GlossaryTerm", g.id, "term", g.term));
    findings.push(...checkField("GlossaryTerm", g.id, "definition", g.definition));
    findings.push(...checkField("GlossaryTerm", g.id, "russianEquivalent", g.russianEquivalent));
    findings.push(...checkField("GlossaryTerm", g.id, "transcription", g.transcription));
    findings.push(...checkField("GlossaryTerm", g.id, "russianComparison", g.russianComparison));
    try {
      const examples = JSON.parse(g.examples) as { es?: string; ru?: string }[];
      examples.forEach((ex, i) => {
        findings.push(...checkField("GlossaryTerm", g.id, `examples[${i}].es`, ex.es));
        findings.push(...checkField("GlossaryTerm", g.id, `examples[${i}].ru`, ex.ru));
      });
    } catch {
      findings.push({ table: "GlossaryTerm", id: g.id, field: "examples", issue: "malformed JSON", excerpt: g.examples.slice(0, 60) });
    }
  }
  console.log(`GlossaryTerm: scanned ${glossary.length} rows`);

  const stories = await db.story.findMany({
    select: { id: true, title: true, text: true, description: true, translationEs: true },
  });
  for (const s of stories) {
    findings.push(...checkField("Story", s.id, "title", s.title));
    findings.push(...checkField("Story", s.id, "text", s.text));
    findings.push(...checkField("Story", s.id, "description", s.description));
    findings.push(...checkField("Story", s.id, "translationEs", s.translationEs));
  }
  console.log(`Story: scanned ${stories.length} rows`);

  console.log(`\n${findings.length} finding(s):\n`);
  const byIssue = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byIssue.get(f.issue) ?? [];
    list.push(f);
    byIssue.set(f.issue, list);
  }
  for (const [issue, list] of byIssue) {
    console.log(`\n=== ${issue} (${list.length}) ===`);
    for (const f of list.slice(0, 200)) {
      console.log(`  [${f.table}/${f.field}] ${f.id}: ${f.excerpt}`);
    }
    if (list.length > 200) console.log(`  ... and ${list.length - 200} more`);
  }

  if (findings.length > 0) process.exitCode = 1;
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
