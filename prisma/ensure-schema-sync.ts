import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";

// Guards against the outage from 2026-08-27: this project has no
// prisma/migrations folder (push-based workflow — `prisma db push`
// against dev.db only). At least two recent commits (47a7847 for
// Story.descriptionRu, and an earlier one for Story.readingMinutes) added
// nullable columns to schema.prisma that were only ever pushed to local
// dev.db, never to production Turso — so `/[lang]` and `/[lang]/stories`
// 500'd site-wide (both locales; Prisma selects all scalar columns by
// default) the moment that code deployed.
//
// Rather than hand-list individual columns (which just repeats this
// outage the next time someone adds a field and forgets to push), this
// parses schema.prisma directly, diffs each model's scalar fields against
// the real columns in production Turso (via PRAGMA table_info), and adds
// whatever is missing. It never drops/renames/alters an existing column —
// only ADD COLUMN for a field that's in the schema but not the DB — so it
// can't cause data loss; at worst it's a no-op.
//
// Runs at the start of `npm run build` / vercel.json's buildCommand,
// which is the only place a real TURSO_AUTH_TOKEN is available to
// non-runtime code (see PROGRESS.md — local tooling can't hold that
// secret in this environment). No-ops locally (no TURSO_DATABASE_URL).

const SCALAR_TYPE_TO_SQLITE: Record<string, string> = {
  String: "TEXT",
  Int: "INTEGER",
  Float: "REAL",
  Boolean: "INTEGER",
  DateTime: "TEXT",
  Json: "TEXT",
  BigInt: "INTEGER",
};

interface FieldDef {
  name: string;
  sqlType: string;
}

interface ModelDef {
  name: string;
  fields: FieldDef[];
}

/** Reads one model body by COUNTING BRACES rather than by matching up to
 * the next "}".
 *
 * The previous version used /model\s+(\w+)\s*{([^}]*)}/ and truncated a
 * model at the first closing brace that appeared anywhere inside it —
 * including inside a doc comment. WordGamePuzzle documents its JSON
 * columns as `{ size: number, grid: string[][] }` and `{ word, clue, row,
 * col, ... }`, so this script could only ever see 7 of that model's 11
 * scalar fields. Every field declared after those comments was invisible,
 * which meant a new column there was silently never added to production.
 *
 * That is not hypothetical: `updatedAt` was added to WordGamePuzzle at the
 * end of the model on 02.09.2026, this script skipped it, and sitemap.ts —
 * which selects it — returned HTTP 500 for the whole file on production
 * until the column was added by hand. A sitemap that 500s is invisible to
 * a crawler, so the fix for THAT outage is this parser, not the one
 * column. */
function modelBodies(schemaText: string): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = [];
  const header = /model\s+(\w+)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = header.exec(schemaText))) {
    let depth = 1;
    let i = header.lastIndex;
    while (i < schemaText.length && depth > 0) {
      if (schemaText[i] === "{") depth++;
      else if (schemaText[i] === "}") depth--;
      i++;
    }
    out.push({ name: match[1], body: schemaText.slice(header.lastIndex, i - 1) });
    header.lastIndex = i;
  }
  return out;
}

function parseSchema(schemaText: string): ModelDef[] {
  const models: ModelDef[] = [];

  for (const { name: modelName, body } of modelBodies(schemaText)) {
    const fields: FieldDef[] = [];

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;

      // e.g. "descriptionRu String?" / "readingMinutes Int?" / "id String @id @default(cuid())"
      const fieldMatch = line.match(/^(\w+)\s+(\w+)(\?|\[\])?/);
      if (!fieldMatch) continue;
      const [, fieldName, prismaType, modifier] = fieldMatch;

      // Relation fields reference another model (capitalized custom type not
      // in our scalar map) or are lists — both are relations, not columns.
      if (modifier === "[]") continue;
      const sqlType = SCALAR_TYPE_TO_SQLITE[prismaType];
      if (!sqlType) continue;

      fields.push({ name: fieldName, sqlType });
    }

    models.push({ name: modelName, fields });
  }

  return models;
}

export { parseSchema, modelBodies };

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.log("[ensure-schema-sync] No TURSO_DATABASE_URL — skipping (local/dev build).");
    return;
  }

  const schemaText = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf-8");
  const models = parseSchema(schemaText);

  const client = createClient({ url, authToken });
  let addedCount = 0;

  for (const model of models) {
    let existingColumns: Set<string>;
    try {
      const info = await client.execute(`PRAGMA table_info("${model.name}")`);
      existingColumns = new Set(info.rows.map((row) => String(row.name)));
    } catch (error) {
      console.log(`[ensure-schema-sync] Could not read ${model.name} (table may not exist yet) — skipping.`, error);
      continue;
    }
    if (existingColumns.size === 0) {
      console.log(`[ensure-schema-sync] ${model.name} has no columns (table may not exist yet) — skipping.`);
      continue;
    }

    for (const field of model.fields) {
      if (existingColumns.has(field.name)) continue;
      console.log(`[ensure-schema-sync] Adding missing column ${model.name}.${field.name} ${field.sqlType}...`);
      await client.execute(`ALTER TABLE "${model.name}" ADD COLUMN "${field.name}" ${field.sqlType}`);
      addedCount++;
    }
  }

  console.log(
    addedCount > 0
      ? `[ensure-schema-sync] Added ${addedCount} missing column(s).`
      : "[ensure-schema-sync] Schema already in sync — no columns added."
  );
  client.close();
}

// Only when this file is the process entry point.
//
// It used to run on import, and src/lib/schema-sync.test.ts imports it for
// parseSchema/modelBodies — so `npm run test` in a shell that happened to
// carry TURSO_DATABASE_URL would have pointed the production schema
// migrator at production. Idempotent and ADD-COLUMN-only, so the damage
// would have been bounded, but "the unit suite writes DDL to prod" is not
// a property to leave to luck. Caught 29.08.2026 when a read-only audit
// script imported this module and the connection banner appeared in its
// output.
//
// This is the same rule as VERCEL_ENV vs NODE_ENV in
// src/lib/deploy-environment.ts: the signal has to be something a
// bystander cannot accidentally satisfy.
const isEntryPoint = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main().catch((error) => {
    console.error("[ensure-schema-sync] Failed:", error);
    process.exit(1);
  });
}
