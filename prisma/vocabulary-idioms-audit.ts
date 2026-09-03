/**
 * Duplicate/coverage audit for the two content banks — flashcard
 * vocabulary (FlashcardCard) and idioms/proverbs (Idiom). Same spirit as
 * prisma/glossary-coverage-report.ts. Run BEFORE and AFTER adding any batch
 * to guarantee no duplicate id and no duplicate Russian word/phrase slipped
 * in, and to see the current per-level/per-category distribution before
 * deciding what a new batch should focus on.
 *
 * Previously read straight from the static TS banks in src/lib/flashcards/
 * and src/lib/idioms/ (pure imports, no DB needed) — both content types
 * moved to the DB (see FlashcardCard/Idiom models in schema.prisma) so this
 * now reads via Prisma instead. Exits non-zero if any duplicate is found,
 * so it can gate a batch-adding session:
 *   npm run db:vocabulary-audit
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";

import { isEntryPoint } from "../src/lib/entry-point";
import {
  KNOWN_HOMONYM_ID_PAIRS,
  KNOWN_YO_PAIRS,
  exactCollisions,
  yoCollisions,
} from "../src/lib/flashcards/duplicate-key";

// Вопрос «нет ли дублей» задают банку прода, а не копии на ноутбуке:
// пары, ради которых эта проверка и правилась, живут именно там. С ключом
// читается прод (только чтение), без ключа — локальная база, как раньше.
const adapter = process.env.TURSO_DATABASE_URL
  ? new PrismaLibSql({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  : new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

const SELF_TEST = process.argv.includes("--self-test");

/**
 * Позитивный контроль к новому правилу: подсаженная пара «ёлка / елка»
 * обязана быть поймана, известная пара «все / всё» — пропущена, и список
 * исключений обязан не проглатывать всё подряд.
 */
function selfTest(): boolean {
  // Подсадка к списку узаконенных пар: обе законные строки «карта» лежат
  // рядом с ТРЕТЬЕЙ, только что появившейся. Настоящий дубль обязан быть
  // пойман, а сама узаконенная пара — пропущена.
  const legitPair = [
    { id: "shop-card", russian: "карта" },
    { id: "city-map", russian: "карта" },
  ];
  const sanctionedOnly = exactCollisions(legitPair, (x) => x.russian, (x) => x.id).map((c) => c.key);
  const withThird = exactCollisions(
    [...legitPair, { id: "cmt-new-fake-card", russian: "Карта" }],
    (x) => x.russian,
    (x) => x.id,
  );
  const otherWord = exactCollisions(
    [
      { id: "x1", russian: "стол" },
      { id: "x2", russian: "стол" },
    ],
    (x) => x.russian,
    (x) => x.id,
  ).map((c) => c.key);

  const planted = yoCollisions(
    [
      { id: "a", russian: "ёлка" },
      { id: "b", russian: "елка" },
      { id: "c", russian: "все" },
      { id: "d", russian: "всё" },
      { id: "e", russian: "Стол" },
      { id: "f", russian: "стол" },
    ],
    (x) => x.russian,
  );
  const keys = planted.map((c) => c.key);
  const checks: [string, boolean][] = [
    ["подсаженная пара «ёлка / елка» поймана", keys.includes("елка")],
    ["известная пара «все / всё» пропущена", !keys.includes("все")],
    ["пара, различающаяся только регистром, ловится прежним правилом, не этим", !keys.includes("стол")],
    ["список исключений не пуст и не бесконечен", KNOWN_YO_PAIRS.length > 0 && KNOWN_YO_PAIRS.length < 20],
    ["узаконенная пара «карта» (shop-card / city-map) пропущена", sanctionedOnly.length === 0],
    ["ТРЕТЬЯ строка «карта» ловится — исключение по паре id, а не по слову", withThird.length === 1 && withThird[0].count === 3],
    ["слово вне списка («стол» ×2) ловится по-прежнему", otherWord.includes("стол")],
    [
      "список узаконенных пар не пуст, не бесконечен и состоит ровно из пар",
      KNOWN_HOMONYM_ID_PAIRS.length > 0 &&
        KNOWN_HOMONYM_ID_PAIRS.length < 30 &&
        KNOWN_HOMONYM_ID_PAIRS.every((p) => new Set(p.ids).size === 2),
    ],
  ];
  let ok = true;
  console.log("ПОЗИТИВНЫЙ КОНТРОЛЬ (--self-test)");
  for (const [name, passed] of checks) {
    ok &&= passed;
    console.log(`  ${passed ? "ok  " : "ПРОВАЛ"} ${name}`);
  }
  return ok;
}

function reportDuplicates<T>(
  items: T[],
  keyFn: (item: T) => string,
  label: string,
): boolean {
  const seen = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item).trim().toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicates = [...seen.entries()].filter(([, count]) => count > 1);
  if (duplicates.length === 0) {
    console.log(`  OK — no duplicate ${label} (${items.length} total).`);
    return false;
  }
  console.log(`  ⚠ ${duplicates.length} duplicate ${label} found:`);
  for (const [key, count] of duplicates) console.log(`    - "${key}" ×${count}`);
  return true;
}

/**
 * То же, что reportDuplicates, но с поимённым списком узаконенных пар —
 * по паре id, не по слову (см. KNOWN_HOMONYM_ID_PAIRS и PROGRESS.md 7.89).
 * Отдельная функция, а не флаг у предыдущей: у дублей id и у дублей фраз
 * идиом исключений нет и быть не должно.
 */
function reportSanctionedDuplicates<T>(
  items: T[],
  keyFn: (item: T) => string,
  idFn: (item: T) => string,
  label: string,
): boolean {
  const collisions = exactCollisions(items, keyFn, idFn);
  const sanctioned = KNOWN_HOMONYM_ID_PAIRS.length;
  if (collisions.length === 0) {
    console.log(
      `  OK — no duplicate ${label} (${items.length} total, ${sanctioned} узаконенных пары-омонима пропущены поимённо).`,
    );
    return false;
  }
  console.log(`  ⚠ ${collisions.length} duplicate ${label} found:`);
  for (const c of collisions) console.log(`    - "${c.key}" ×${c.count} → ${c.ids.join(", ")}`);
  return true;
}

/** То же, но по ключу с нормализацией «ё» и регистра, за вычетом
 * известных настоящих пар. Отдельная функция, а не флаг у предыдущей:
 * это другой вопрос и другой список исключений. */
function reportYoCollisions<T>(items: T[], keyFn: (item: T) => string, label: string): boolean {
  const collisions = yoCollisions(items, keyFn);
  if (collisions.length === 0) {
    console.log(`  OK — no «ё»/case collisions among ${label}.`);
    return false;
  }
  console.log(`  ⚠ ${collisions.length} «ё»/case collision(s) among ${label}:`);
  for (const c of collisions) console.log(`    - "${c.key}" ← ${c.variants.join(" / ")}`);
  return true;
}

function tally<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

async function main() {
  if (SELF_TEST) {
    const ok = selfTest();
    if (!ok) process.exitCode = 1;
    return;
  }
  let hadDuplicates = false;

  const flashcards = await db.flashcardCard.findMany();
  const idioms = await db.idiom.findMany();

  console.log(
    `=== Flashcards (FlashcardCard) === (${process.env.TURSO_DATABASE_URL ? "ПРОД" : process.env.DATABASE_URL ?? "file:./dev.db"})`,
  );
  const flashcardIdDupes = reportDuplicates(flashcards, (c) => c.id, "flashcard ids");
  const flashcardWordDupes = reportSanctionedDuplicates(
    flashcards,
    (c) => c.russian,
    (c) => c.id,
    "flashcard Russian words",
  );
  // «ё» и регистр. Прежнее правило сравнивало посимвольно и потому не
  // видело ни «свёкровь / свекровь», ни «сёрфинг / серфинг»: это ОДНО
  // слово, написанное двумя способами, и в банке оно лежало дважды.
  // Настоящих минимальных пар, различающихся только «ё», в русском
  // немного, и они перечислены поимённо в KNOWN_YO_PAIRS — иначе ворота
  // были бы красными вечно из-за «все / всё» (todo / todos).
  const flashcardYoDupes = reportYoCollisions(flashcards, (c) => c.russian, "flashcard Russian words");
  hadDuplicates = hadDuplicates || flashcardIdDupes || flashcardWordDupes || flashcardYoDupes;
  console.log("  By level:", tally(flashcards, (c) => c.level));
  console.log("  By category:", tally(flashcards, (c) => c.category));

  console.log("\n=== Idioms (Idiom) ===");
  const idiomIdDupes = reportDuplicates(idioms, (i) => i.id, "idiom ids");
  const idiomPhraseDupes = reportDuplicates(idioms, (i) => i.phrase, "idiom phrases");
  const idiomYoDupes = reportYoCollisions(idioms, (i) => i.phrase, "idiom phrases");
  // Reuse of a Spanish equivalent by two DIFFERENT Russian phrases is not always
  // wrong (two idioms can legitimately share a real equivalent), but it has
  // repeatedly flagged genuine near-duplicate Russian concepts in practice
  // (see rusofasil pipeline runs 28/31) — report as a warning to investigate,
  // not a hard failure like id/phrase collisions.
  const equivalentCounts = new Map<string, string[]>();
  for (const i of idioms) {
    const key = i.spanishEquivalent.trim().toLowerCase();
    const list = equivalentCounts.get(key) ?? [];
    list.push(i.phrase);
    equivalentCounts.set(key, list);
  }
  const reusedEquivalents = [...equivalentCounts.entries()].filter(([, phrases]) => phrases.length > 1);
  if (reusedEquivalents.length === 0) {
    console.log(`  OK — no reused Spanish equivalents (${idioms.length} total).`);
  } else {
    console.log(`  ⚠ ${reusedEquivalents.length} Spanish equivalent(s) reused by multiple phrases (investigate, not auto-fail):`);
    for (const [eq, phrases] of reusedEquivalents) {
      console.log(`    - "${eq}" used by: ${phrases.join(" / ")}`);
    }
  }
  hadDuplicates = hadDuplicates || idiomIdDupes || idiomPhraseDupes || idiomYoDupes;
  console.log("  By category:", tally(idioms, (i) => i.category));

  console.log("");
  if (hadDuplicates) {
    console.log("Duplicates found — fix before merging a new batch.");
    process.exitCode = 1;
  } else {
    console.log("All clear — safe to add a new batch on top of this baseline.");
  }
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
