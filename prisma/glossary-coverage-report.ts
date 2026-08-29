/**
 * Coverage audit: how many lessons actually discuss a grammar topic vs.
 * whether that topic has a dedicated glossary entry. Formalizes the manual
 * process used to find the "6 cases only 2 covered" and "modo
 * imperativo/condicional missing" gaps — grep every lesson's grammar text
 * for a topic's keyword cluster, report the lesson count, and print it next
 * to the glossary's current term list per category so a human/AI can spot
 * a topic with many lessons but no matching term.
 *
 * This deliberately does NOT try to auto-match "keyword cluster X is
 * covered by term Y" — that matching is exactly the judgment call that
 * caused this list to need periodic re-review in the first place, and a
 * fuzzy auto-match would just hide new gaps instead of surfacing them.
 * Read the two halves of the report side by side.
 *
 * Safe, read-only. Run after adding new lessons or glossary terms:
 *   npm run db:glossary-coverage-report
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { glossaryCategories } from "../src/lib/glossary";
import content from "../src/lib/lessons/content.json";

import { isEntryPoint } from "../src/lib/entry-point";
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

const LEVEL_ORDER: Record<string, number> = { a1: 0, a2: 1, b1: 2, b2: 3 };
function sortSlug(slug: string): number {
  const [level, num] = slug.split("-");
  return (LEVEL_ORDER[level] ?? 99) * 1000 + Number(num);
}

/** Add a cluster here whenever a new grammar topic seems worth checking —
 * this list only grows, it's not meant to be exhaustive from day one. */
const TOPICS: { label: string; keywords: string[] }[] = [
  { label: "caso nominativo", keywords: ["nominativo"] },
  { label: "caso genitivo", keywords: ["genitivo"] },
  { label: "caso dativo", keywords: ["dativo"] },
  { label: "caso acusativo", keywords: ["acusativo"] },
  { label: "caso instrumental", keywords: ["instrumental"] },
  { label: "caso preposicional", keywords: ["preposicional", "prepositivo"] },
  { label: "aspecto perfectivo/imperfectivo", keywords: ["perfectivo", "imperfectivo"] },
  { label: "par aspectual", keywords: ["par aspectual", "pareja aspectual", "verbo par"] },
  { label: "participio activo/pasivo", keywords: ["participio activo", "participio pasivo"] },
  { label: "gerundio", keywords: ["gerundio"] },
  { label: "gerundio de pasado", keywords: ["gerundio pasado", "gerundio de pasado", "gerundio perfectivo"] },
  { label: "conjunción subordinante", keywords: ["conjunción", "conjuncion"] },
  { label: "verbos de movimiento uni/multi", keywords: ["unidireccional", "multidireccional"] },
  { label: "registro formal/informal", keywords: ["tú/usted", "formal e informal", "tratamiento formal", "registro formal"] },
  { label: "modo imperativo", keywords: ["imperativo"] },
  { label: "modo condicional", keywords: ["condicional"] },
  { label: "discurso indirecto", keywords: ["discurso indirecto", "estilo indirecto"] },
  { label: "numerales", keywords: ["numeral", "número cardinal", "número ordinal"] },
  { label: "comparativo/superlativo", keywords: ["comparativo", "superlativo"] },
  { label: "pronombres posesivos", keywords: ["posesivo"] },
  { label: "pronombres reflexivos", keywords: ["reflexivo"] },
];

function countLessonsMentioning(keywords: string[]): string[] {
  const hits: string[] = [];
  for (const [slug, lesson] of Object.entries(content as Record<string, { grammar?: { title?: string; paragraphs?: string[] } }>)) {
    const g = lesson.grammar;
    if (!g) continue;
    const text = [g.title ?? "", ...(g.paragraphs ?? [])].join(" ").toLowerCase();
    if (keywords.some((k) => text.includes(k.toLowerCase()))) hits.push(slug);
  }
  return hits.sort((a, b) => sortSlug(a) - sortSlug(b));
}

async function main() {
  const terms = await db.glossaryTerm.findMany({ orderBy: { term: "asc" } });
  console.log(`\nGlossary: ${terms.length} terms total\n`);

  console.log("=== Current terms by category ===");
  for (const category of glossaryCategories) {
    const inCategory = terms.filter((t) => t.category === category);
    console.log(`\n[${category}] (${inCategory.length})`);
    for (const t of inCategory) console.log(`  - ${t.term}`);
  }

  console.log("\n\n=== Lesson-text topic scan (independent of what's already in the glossary) ===");
  console.log("Cross-reference a high lesson count here against the category list above.\n");
  for (const { label, keywords } of TOPICS) {
    const slugs = countLessonsMentioning(keywords);
    const sample = slugs.slice(0, 4).join(", ");
    console.log(`${label.padEnd(34)} ${String(slugs.length).padStart(3)} lessons   e.g. ${sample}`);
  }
  console.log("");
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
