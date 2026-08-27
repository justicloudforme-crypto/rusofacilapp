import { readFileSync } from "node:fs";
import { join } from "node:path";
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

function parseSchema(schemaText: string): ModelDef[] {
  const models: ModelDef[] = [];
  const modelBlockRe = /model\s+(\w+)\s*{([^}]*)}/g;
  let modelMatch: RegExpExecArray | null;

  while ((modelMatch = modelBlockRe.exec(schemaText))) {
    const [, modelName, body] = modelMatch;
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

main().catch((error) => {
  console.error("[ensure-schema-sync] Failed:", error);
  process.exit(1);
});
