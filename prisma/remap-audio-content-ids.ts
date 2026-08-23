/**
 * ONE-TIME FIX — corrects AudioAsset.contentId for "story" and "glossary"
 * rows in PRODUCTION Turso.
 *
 * Root cause: local dev.db and production Turso were seeded independently
 * for Story/GlossaryTerm (see prisma/sync-to-production.ts's own docstring,
 * which documents this as an existing, pre-dating-this-session fact of the
 * project) — the SAME logical story/term ends up with a DIFFERENT
 * database-generated `id` in each database. prisma/sync-audio-assets-to-turso.ts
 * copied AudioAsset rows straight from local, so their `contentId` (which
 * mirrors Story.id / GlossaryTerm.id) pointed at LOCAL ids that don't exist
 * in production's own Story/GlossaryTerm tables, making that narration
 * unreachable there even though the row (and the real Blob file) exists.
 *
 * This script does NOT generate or move any audio — the clips are already
 * paid for, generated, and sitting in Blob. It only corrects the pointer:
 * for every local Story/GlossaryTerm row, finds the matching production
 * row by content key (title+author for Story, slug for GlossaryTerm — the
 * same keys prisma/sync-to-production.ts already uses) and, where the ids
 * differ, UPDATEs the matching AudioAsset row(s) in Turso to the correct
 * production contentId. Never inserts or deletes rows.
 *
 * Usage:
 *   npm run remap-audio-content-ids -- --dry-run
 *   npm run remap-audio-content-ids
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { createClient, type InStatement } from "@libsql/client";

const BATCH_SIZE = 200;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in the environment.");
    process.exit(1);
  }

  const dbPath = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
  const local = new Database(dbPath, { readonly: true });
  const turso = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

  const updates: { contentType: "story" | "glossary"; oldId: string; newId: string; label: string }[] = [];

  // --- Story: match by (title, author) ---
  const localStories = local.prepare("SELECT id, title, author FROM Story").all() as {
    id: string;
    title: string;
    author: string;
  }[];
  const prodStories = await turso.execute("SELECT id, title, author FROM Story");
  const prodStoryByKey = new Map<string, string>();
  for (const r of prodStories.rows as unknown as { id: string; title: string; author: string }[]) {
    prodStoryByKey.set(`${r.title}|${r.author}`, r.id);
  }
  let storyOrphans = 0;
  for (const s of localStories) {
    const prodId = prodStoryByKey.get(`${s.title}|${s.author}`);
    if (!prodId) {
      storyOrphans++;
      continue;
    }
    if (prodId !== s.id) updates.push({ contentType: "story", oldId: s.id, newId: prodId, label: s.title });
  }

  // --- GlossaryTerm: match by slug ---
  const localTerms = local.prepare("SELECT id, slug, term FROM GlossaryTerm").all() as {
    id: string;
    slug: string;
    term: string;
  }[];
  const prodTerms = await turso.execute("SELECT id, slug FROM GlossaryTerm");
  const prodTermBySlug = new Map<string, string>();
  for (const r of prodTerms.rows as unknown as { id: string; slug: string }[]) {
    prodTermBySlug.set(r.slug, r.id);
  }
  let termOrphans = 0;
  for (const t of localTerms) {
    const prodId = prodTermBySlug.get(t.slug);
    if (!prodId) {
      termOrphans++;
      continue;
    }
    if (prodId !== t.id) updates.push({ contentType: "glossary", oldId: t.id, newId: prodId, label: t.term });
  }

  console.log(`Story remaps: ${updates.filter((u) => u.contentType === "story").length} (orphaned, skipped: ${storyOrphans})`);
  console.log(`Glossary remaps: ${updates.filter((u) => u.contentType === "glossary").length} (orphaned, skipped: ${termOrphans})`);

  if (updates.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (dryRun) {
    console.log(`[dry-run] Would issue UPDATEs for ${updates.length} content item(s). No writes made.`);
    return;
  }

  let rowsUpdated = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    const statements: InStatement[] = batch.map((u) => ({
      sql: `UPDATE AudioAsset SET contentId = ? WHERE contentType = ? AND contentId = ?`,
      args: [u.newId, u.contentType, u.oldId],
    }));
    const results = await turso.batch(statements, "write");
    for (const r of results) rowsUpdated += r.rowsAffected;
    console.log(`... processed ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length} content items`);
  }

  console.log(`\nDone. ${rowsUpdated} AudioAsset row(s) updated across ${updates.length} content item(s).`);
}

main();
