/**
 * Seeds a small starter set of linguistic-terms glossary entries — the
 * course's own metalanguage, in Spanish, with its Russian equivalent (see
 * src/lib/glossary.ts). This is a foundation seed proving the pipeline
 * end-to-end, not a complete glossary: each entry mirrors a concept
 * already taught somewhere in the course (see relatedLessons).
 *
 * Safe to re-run: upserts by slug.
 *
 * SAFE BY DEFAULT: a term a staff member has hand-edited through /admin
 * (GlossaryTerm.reviewedAt set — see src/app/api/admin/glossary/save) is
 * skipped, not overwritten, even if this file's own data disagrees. Pass
 * --force to overwrite reviewed rows anyway. See CONTENT_INTEGRITY.md.
 *
 *   npm run db:seed-glossary
 *   npm run db:seed-glossary -- --force
 *
 * Two flags exist for running this against the PRODUCTION database, where
 * "re-run the whole seed" is a much bigger promise than it is locally:
 *
 *   --dry-run          Touches nothing. Reads each row and prints a
 *                      field-by-field diff of what a real run would
 *                      change, so the change can be reviewed before it
 *                      happens rather than reconstructed afterwards.
 *   --only=a,b,c       Restricts the run to those slugs. Without it,
 *                      --force means "overwrite EVERY hand-reviewed row",
 *                      which is almost never what's intended when the
 *                      goal is to push one corrected entry; with it,
 *                      --force is scoped to the slugs actually named.
 *
 *   npm run db:seed-glossary -- --dry-run
 *   npm run db:seed-glossary -- --only=arcaismo --force
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { validateGlossaryInput, type GlossaryCategory, type GlossaryExample } from "../src/lib/glossary";

import { isEntryPoint } from "../src/lib/entry-point";
import { invalidateSearchIndex } from "../src/lib/search/index-server";
const FORCE = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = (() => {
  const arg = process.argv.find((a) => a.startsWith("--only="));
  if (!arg) return null;
  const slugs = arg
    .slice("--only=".length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return slugs.length > 0 ? new Set(slugs) : null;
})();

import { terms, type SeedTerm } from "./glossary-terms-data";

export { terms };


/** Fields compared in --dry-run. Deliberately the exact key set written
 * below, so a new column can't silently drop out of the preview and land
 * as an unannounced change in production. */
function diffFields(existing: Record<string, unknown>, data: Record<string, unknown>): string[] {
  return Object.keys(data).filter((key) => String(existing[key] ?? "") !== String(data[key] ?? ""));
}

async function main() {
  let skipped = 0;
  let changed = 0;
  let identical = 0;
  let created = 0;
  let filteredOut = 0;

  for (const term of terms) {
    if (ONLY && !ONLY.has(term.slug)) {
      filteredOut++;
      continue;
    }
    const result = validateGlossaryInput(term);
    if (!result.valid) {
      console.error(`Skipping "${term.term}": ${result.error}`);
      continue;
    }
    const data = {
      ...result.value,
      relatedLessons: JSON.stringify(result.value.relatedLessons),
      examples: JSON.stringify(result.value.examples),
    };

    const existing = await db.glossaryTerm.findUnique({ where: { slug: result.value.slug } });
    if (existing) {
      if (existing.reviewedAt && !FORCE) {
        console.warn(`⚠ Skipping "${term.term}" — hand-reviewed on ${existing.reviewedAt.toISOString()}, re-run with --force to overwrite anyway.`);
        skipped++;
        continue;
      }
      const changedFields = diffFields(existing as unknown as Record<string, unknown>, data);
      if (changedFields.length === 0) {
        identical++;
        continue;
      }
      changed++;
      if (DRY_RUN) {
        console.log(`~ ${result.value.slug} — would UPDATE ${changedFields.length} field(s)${existing.reviewedAt ? " (reviewed, needs --force)" : ""}`);
        for (const key of changedFields) {
          console.log(`    ${key}:\n      before: ${String((existing as unknown as Record<string, unknown>)[key] ?? "")}\n      after:  ${String(data[key as keyof typeof data] ?? "")}`);
        }
        continue;
      }
      await db.glossaryTerm.update({ where: { slug: result.value.slug }, data });
    } else {
      created++;
      if (DRY_RUN) {
        console.log(`+ ${result.value.slug} — would CREATE`);
        continue;
      }
      await db.glossaryTerm.create({ data });
    }
  }

  const scope = ONLY ? `${ONLY.size} slug(s) selected, ${filteredOut} not selected` : `all ${terms.length} term(s)`;
  if (DRY_RUN) {
    console.log(`\n— DRY RUN, nothing written. Scope: ${scope}.`);
    console.log(`  would update ${changed}, would create ${created}, identical ${identical}, skipped as reviewed ${skipped}.`);
    return;
  }
  console.log(`✔ Scope: ${scope}. Updated ${changed}, created ${created}, identical ${identical}, skipped (reviewed) ${skipped}.`);
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    // Индекс поиска печатает названия того, что этот скрипт пишет
    // (термины глоссария). Скрипт работает СВОИМ процессом, поэтому
    // сбросить он может только общий кеш — и должен, иначе поиск до пяти
    // минут находит прежние названия и не находит новые.
    .then(() => invalidateSearchIndex())
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
