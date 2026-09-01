// The content the Playwright suite needs, for a database that has none.
//
// Why this exists. Two whole spec files — e2e/word-games.spec.ts and
// e2e/glossary.spec.ts, 16 of the suite's tests once both engines are
// counted — used to open with `test.skip(!!process.env.CI, ...)`. The
// reason given was true: WordGamePuzzle and GlossaryTerm are DB-backed
// only, CI's database is created by `prisma db push` and is empty, and
// re-running the puzzle generator there writes zero rows because the
// FlashcardCard bank it reads is empty too. So CI ran the suite and
// reported green while a third of it never executed.
//
// The way out is NOT to reconstruct the card bank and re-run the
// generator: that is thousands of rows to commit in order to derive four
// puzzles. Commit the four puzzles instead. e2e/fixtures/*.json holds real
// production rows, exported byte-for-byte from the content database — a
// real grid, real words, real clues — so the tests exercise the same
// shapes they do locally.
//
// What this is NOT. It is not seed data and it is not a content source:
// nothing outside the e2e suite may read it, and it must not grow to make
// some other check pass. That is the mistake debt 21 warns about for
// scripts/seed-ci-render-fixture.mjs, and it applies here word for word.
//
//   node scripts/seed-e2e-fixture.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "e2e", "fixtures");

const readFixture = (name) => JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));

/** Every row this script writes carries this prefix in its id. It is what
 * makes "is this database already ours to write to?" answerable below. */
const FIXTURE_ID_PREFIX = "e2e-fixture-";

/**
 * Refuses to touch a database that holds real content.
 *
 * This matters more than it looks. dev.db in the repository root is the
 * full content bank — 5678 flashcards, 3000 puzzles — and
 * WordGameProgress rows point at WordGamePuzzle ids with
 * onDelete: Cascade (PROGRESS.md 7.4). An upsert keyed on
 * (type, level, sequence) would rewrite a real puzzle's grid under a
 * player's saved progress. So: seed only into a table that is empty, or
 * one that contains nothing but this script's own earlier output (so a CI
 * job can re-run).
 */
function assertSafeToSeed(label, rows, idOf) {
  const foreign = rows.filter((row) => !idOf(row).startsWith(FIXTURE_ID_PREFIX));
  if (foreign.length > 0) {
    throw new Error(
      `${label} already holds ${foreign.length} row(s) that this fixture did not write ` +
        `(e.g. ${idOf(foreign[0])}). Refusing to overwrite real content — this script is ` +
        `only ever for an empty CI database.`,
    );
  }
}

async function main() {
  const adapter = new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./dev.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const db = new PrismaClient({ adapter });
  try {
    const puzzles = readFixture("word-games.json");
    const terms = readFixture("glossary.json");
    // Eight real A1 "greetings" cards. e2e/match-result-panel.spec.ts plays
    // a Match round to the end, and a round needs at least MIN_PLAYABLE (4)
    // cards in one category; CI's FlashcardCard table is empty, so without
    // these the spec would only ever see "not enough words in this
    // category" and could never reach the result panel it exists to count.
    // Same rule as the puzzles above: real exported rows, e2e-only, and it
    // must not grow to make some other check pass.
    const cards = readFixture("flashcards.json");

    assertSafeToSeed(
      "WordGamePuzzle",
      await db.wordGamePuzzle.findMany({ select: { id: true } }),
      (r) => r.id,
    );
    assertSafeToSeed(
      "GlossaryTerm",
      await db.glossaryTerm.findMany({ select: { id: true, slug: true } }),
      (r) => r.id,
    );

    assertSafeToSeed(
      "FlashcardCard",
      await db.flashcardCard.findMany({ select: { id: true } }),
      (r) => r.id,
    );

    for (const c of cards) {
      await db.flashcardCard.upsert({ where: { id: c.id }, update: { ...c }, create: { ...c } });
    }

    for (const p of puzzles) {
      const { id, type, level, sequence, ...rest } = p;
      await db.wordGamePuzzle.upsert({
        where: { type_level_sequence: { type, level, sequence } },
        update: { ...rest },
        create: { id, type, level, sequence, ...rest },
      });
    }

    for (const t of terms) {
      await db.glossaryTerm.upsert({
        where: { slug: t.slug },
        update: { ...t },
        create: { id: `${FIXTURE_ID_PREFIX}glossary-${t.slug}`, ...t },
      });
    }

    // Report what the suite actually depends on, not just a row count — a
    // fixture that loaded but lost its ★ puzzle would leave one test
    // failing for a reason nobody would look for here.
    const curved = puzzles.filter((p) => p.curved).length;
    const withRelatedLessons = terms.filter((t) => JSON.parse(t.relatedLessons).length > 0).length;
    const cardCategories = new Set(cards.map((c) => c.category));
    console.log(
      `e2e fixture: ${puzzles.length} puzzles (${curved} curved/★), ` +
        `${terms.length} glossary terms (${withRelatedLessons} with a related lesson), ` +
        `${cards.length} flashcards in ${cardCategories.size} category/-ies`,
    );
    if (curved === 0 || withRelatedLessons === 0 || cards.length < 4) {
      console.error("the fixture lost a shape the suite asserts on — see e2e/fixtures/");
      process.exitCode = 1;
    }
  } finally {
    await db.$disconnect();
  }
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
