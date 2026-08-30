// A minimum of database content so the rendered-surface check in CI can
// actually exercise the class it exists for.
//
// CI's database is created by `prisma db push` and has no rows in it: there
// is no committed source of content in this repository (see the comment in
// .github/workflows/ci.yml). With an empty GlossaryTerm table, GlossaryText
// builds no pattern at all, and incident №1 — a glossary term whose hyphen
// made the alternation uncompilable under the `u` flag — would not
// reproduce in CI even with the bug fully present. A gate that cannot fail
// on the defect it was created for is decoration.
//
// So this inserts a handful of glossary rows, one of which carries the exact
// character that caused the outage. It is a regression fixture, not seed
// data: it must stay small, and it must keep the hyphen.
//
//   node scripts/seed-ci-render-fixture.mjs
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { pathToFileURL } from "node:url";

/** The three live production terms whose hyphen caused the outage, plus two
 * ordinary ones so the alternation has something to match. */
const TERMS = [
  { slug: "ci-verbo-reflexivo-sya", term: "verbo reflexivo (con -ся)", category: "partes-de-la-oracion" },
  { slug: "ci-contraste-to-nibud", term: "«-то» frente a «-нибудь»", category: "otros" },
  { slug: "ci-oracion-indefinido-personal", term: "oración indefinido-personal", category: "otros" },
  { slug: "ci-sustantivo", term: "sustantivo", category: "partes-de-la-oracion" },
  { slug: "ci-aspecto-verbal", term: "aspecto verbal", category: "aspecto" },
];

async function main() {
  const adapter = new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./dev.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const db = new PrismaClient({ adapter });
  try {
    for (const t of TERMS) {
      await db.glossaryTerm.upsert({
        where: { slug: t.slug },
        update: { term: t.term, category: t.category },
        create: {
          slug: t.slug,
          term: t.term,
          category: t.category,
          definition: "CI render fixture — not real content.",
          russianEquivalent: "фикстура",
          examples: "[]",
          relatedLessons: "[]",
        },
      });
    }
    const total = await db.glossaryTerm.count();
    const withHyphen = TERMS.filter((t) => t.term.includes("-")).length;
    console.log(`glossary fixture: ${TERMS.length} rows upserted, ${withHyphen} of them carry a hyphen`);
    console.log(`GlossaryTerm rows now: ${total}`);
    if (withHyphen === 0) {
      console.error("the fixture lost its hyphen — the regression it guards would no longer reproduce");
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
