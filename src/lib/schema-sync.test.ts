import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSchema, modelBodies, CREATE_TABLE_STATEMENTS } from "../../prisma/ensure-schema-sync";

/**
 * The production outage of 29.08.2026, as a test.
 *
 * This project has no migrations folder: production columns are added by
 * prisma/ensure-schema-sync.ts at the start of `npm run build`, which
 * diffs schema.prisma against the live database and issues ADD COLUMN for
 * anything missing. That makes its schema PARSER load-bearing — a field it
 * cannot see is a column production never gets.
 *
 * Its model-body regex was /model\s+(\w+)\s*{([^}]*)}/, which ends a model
 * at the first "}" anywhere inside it, comments included. WordGamePuzzle
 * documents its JSON columns as `{ size: number, grid: string[][] }`, so
 * the parser stopped there and saw 7 of 11 scalar fields. `updatedAt`,
 * declared after that comment, was never added; sitemap.ts selects it; and
 * /sitemap.xml returned HTTP 500 in production — the entire sitemap
 * invisible to crawlers — until the column was added by hand.
 *
 * The assertions below are about the parser, not about that one column,
 * because the column was the symptom.
 */

const SCHEMA = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");

/** The old, broken implementation, kept verbatim so the controls can show
 * the two disagree on real input. */
function buggyModelBodies(schemaText: string): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = [];
  for (const m of schemaText.matchAll(/model\s+(\w+)\s*{([^}]*)}/g)) {
    out.push({ name: m[1], body: m[2] });
  }
  return out;
}

describe("ensure-schema-sync parses the whole model", () => {
  it("reads every field of a model whose comments contain braces", () => {
    const models = parseSchema(SCHEMA);
    const wordGame = models.find((m) => m.name === "WordGamePuzzle");
    expect(wordGame, "WordGamePuzzle not parsed").toBeDefined();
    const names = wordGame!.fields.map((f) => f.name);
    // Everything declared after the brace-bearing comments must be here.
    expect(names).toContain("topic");
    expect(names).toContain("gridData");
    expect(names).toContain("words");
    expect(names).toContain("createdAt");
    expect(names).toContain("updatedAt");
  });

  it("positive control: the old parser really did miss those fields", () => {
    // Without this, the test above could pass on the broken version too
    // and would be proving nothing.
    const buggy = buggyModelBodies(SCHEMA).find((m) => m.name === "WordGamePuzzle");
    expect(buggy, "the old regex should still match something").toBeDefined();
    expect(buggy!.body).not.toContain("updatedAt");
    const fixed = modelBodies(SCHEMA).find((m) => m.name === "WordGamePuzzle");
    expect(fixed!.body).toContain("updatedAt");
    expect(fixed!.body.length).toBeGreaterThan(buggy!.body.length);
  });

  it("finds every model in the schema, not just the ones without braces", () => {
    const declared = [...SCHEMA.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
    const parsed = parseSchema(SCHEMA).map((m) => m.name);
    expect(parsed.sort()).toEqual(declared.sort());
    expect(declared.length).toBeGreaterThan(15);
  });

  it("positive control: the old parser also lost whole models", () => {
    // A model body truncated early leaves the regex resuming mid-file, so
    // the damage is not limited to the model that contained the brace.
    const buggyNames = buggyModelBodies(SCHEMA).map((m) => m.name);
    const goodNames = modelBodies(SCHEMA).map((m) => m.name);
    expect(goodNames.length).toBeGreaterThanOrEqual(buggyNames.length);
    // At minimum, the two must disagree somewhere — otherwise this whole
    // file is describing a bug that does not exist in this schema.
    const sameBodies = modelBodies(SCHEMA).every(
      (g) => buggyModelBodies(SCHEMA).find((b) => b.name === g.name)?.body === g.body,
    );
    expect(sameBodies, "parsers agree everywhere — the control is vacuous").toBe(false);
  });

  it("still ignores relations and unmappable types", () => {
    const models = parseSchema(SCHEMA);
    const wordGame = models.find((m) => m.name === "WordGamePuzzle")!;
    // `progress WordGameProgress[]` is a relation, never a column.
    expect(wordGame.fields.map((f) => f.name)).not.toContain("progress");
    // and the types it does map are the SQLite ones
    expect(wordGame.fields.find((f) => f.name === "updatedAt")?.sqlType).toBe("TEXT");
    expect(wordGame.fields.find((f) => f.name === "sequence")?.sqlType).toBe("INTEGER");
  });
});

/**
 * The second half of the migrator, added 31.08.2026 with the StudyDay
 * table.
 *
 * The column diff above cannot create a table: it reads PRAGMA table_info,
 * gets nothing back for a model production has never seen, and skips. So a
 * brand-new Prisma model reaches production as "no such table" on every
 * query that touches it — the 27.08.2026 outage one level up. The fix is a
 * short, hand-written list of CREATE TABLE statements, and the risk it
 * carries is drift: a column added to schema.prisma later, and not to the
 * DDL, would exist for everyone whose database was migrated but not for
 * anyone whose table this statement built.
 *
 * These cases close that by comparing the two texts to each other, with no
 * database involved (`npm run test` opens no connections — see
 * check:no-db-in-tests).
 */
describe("ensure-schema-sync can create a table it has never seen", () => {
  /** Column names out of a hand-written CREATE TABLE, ignoring the table
   * constraints at the end. */
  function ddlColumns(statement: string): string[] {
    const body = statement.slice(statement.indexOf("(") + 1, statement.lastIndexOf(")"));
    return body
      .split("\n")
      .map((line) => line.trim())
      .map((line) => /^"(\w+)"/.exec(line)?.[1])
      .filter((name): name is string => Boolean(name));
  }

  it("every table it may create matches its model in schema.prisma, column for column", () => {
    const models = new Map(parseSchema(SCHEMA).map((model) => [model.name, model]));
    expect(CREATE_TABLE_STATEMENTS.length).toBeGreaterThan(0);

    for (const { table, statements } of CREATE_TABLE_STATEMENTS) {
      const model = models.get(table);
      expect(model, `${table} has a CREATE TABLE but no model in schema.prisma`).toBeDefined();
      const inSchema = model!.fields.map((f) => f.name).sort();
      const inDdl = ddlColumns(statements[0]).sort();
      expect(inDdl, `${table}: the DDL and schema.prisma disagree about columns`).toEqual(inSchema);
    }
  });

  it("control: the comparison notices a column the DDL is missing", () => {
    // Rule 4.1. The case above answers "they agree"; this shows it can say
    // otherwise, using the exact shape of the drift it guards against.
    const truncated = `CREATE TABLE IF NOT EXISTS "StudyDay" (
         "id" TEXT NOT NULL PRIMARY KEY,
         "userId" TEXT NOT NULL,
         "dateKey" TEXT NOT NULL
       )`;
    const model = parseSchema(SCHEMA).find((m) => m.name === "StudyDay");
    expect(model).toBeDefined();
    expect(ddlColumns(truncated).sort()).not.toEqual(model!.fields.map((f) => f.name).sort());
  });

  it("every statement is re-runnable: a second build must not fail on an existing table", () => {
    // The migrator runs at the start of EVERY build, and the guard in front
    // of it (PRAGMA table_info) is a check, not a lock. IF NOT EXISTS is
    // what makes a re-run a no-op instead of an error that fails the deploy.
    for (const { table, statements } of CREATE_TABLE_STATEMENTS) {
      for (const statement of statements) {
        expect(statement, `${table}: "${statement.slice(0, 40)}…" is not re-runnable`).toMatch(/IF NOT EXISTS/);
      }
    }
  });

  it("a created table carries its own indexes, not just its columns", () => {
    // A unique index is not decoration here: StudyDay's whole idempotency
    // guarantee — one row per learner per day, whatever renders twice — is
    // that index. A table created without it would accept a row per page
    // view and nobody would notice until a streak read six copies of one
    // day.
    const studyDay = CREATE_TABLE_STATEMENTS.find((t) => t.table === "StudyDay");
    expect(studyDay).toBeDefined();
    const joined = studyDay!.statements.join("\n");
    expect(joined).toMatch(/CREATE UNIQUE INDEX[^\n]*"StudyDay"\("userId", "dateKey"\)/);
    expect(joined).toMatch(/FOREIGN KEY \("userId"\) REFERENCES "User"[^\n]*ON DELETE CASCADE/);
  });
});
