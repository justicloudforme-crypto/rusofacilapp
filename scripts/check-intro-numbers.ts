/**
 * Ni una cifra escrita a mano en la presentación de introducción.
 *
 * WHY. Until 05.09.2026 every number in the introduction deck was a
 * literal typed into src/lib/intro/content.ts, and the deck had drifted
 * from the product: the tour slide promised an interactive dictionary for
 * "cualquier palabra en español" that does not exist, and the FAQ that
 * answers "what do I get for free?" described a free set of "1 lección …
 * y los primeros crucigramas de nivel A1" where the real one is four
 * lessons, both game types, every level but C1 and 83 puzzles. A
 * hand-written number does not go stale loudly; the page just keeps saying
 * it. Tests can pin the numbers that exist — only a guard can say that no
 * NEW one was typed in.
 *
 * WHAT IS CHECKED. The slides are BUILT — not read as source text — from
 * an IntroStats whose every numeric leaf has been replaced by a unique
 * sentinel. Then every run of digits in every produced string (titles,
 * paragraphs, bullets, link labels) must be one of two things:
 *
 *   1. a sentinel, i.e. a number that came from src/lib/intro/stats.ts;
 *   2. a value on the short pinned allowlist below, each with its reason.
 *
 * A digit welded to a letter is not a number in this sense and is skipped:
 * "A1", "B2", "C1" are level names. Only free-standing digit runs count.
 *
 * AND THE OTHER DIRECTION. Every sentinel must appear at least once. A
 * counted quantity that reaches no slide is a number nobody is checking —
 * either the slide that used it was deleted and the counter left behind,
 * or a sentence quietly stopped printing it.
 *
 *   npx tsx scripts/check-intro-numbers.ts
 *   npx tsx scripts/check-intro-numbers.ts --plant   # positive control
 *
 * `--plant` is not optional decoration. This check reports "0 hand-written
 * numbers", and by the project's own rule (PROGRESS.md 4.5) a check that
 * answers zero must first prove it can answer more than zero.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { buildIntroSlides } from "../src/lib/intro/content";
import { introStatsFrom, type IntroBankCounts, type IntroStats } from "../src/lib/intro/stats";
import { isEntryPoint } from "../src/lib/entry-point";

/**
 * Numbers a slide is allowed to state on its own, because they are facts
 * about the world rather than quantities of this product — nothing in this
 * repository can count them, so nothing here can keep them fresh either.
 * Every entry needs a reason, and the list is meant to stay this short.
 */
const WORLD_FACTS = new Map<string, string>([
  [
    "258",
    "millones de hablantes de ruso — a figure about the language, not about " +
      "the platform. Slide 1 states it twice (paragraph and bullet).",
  ],
]);

const SENTINEL_BASE = 7_000_001;

/** Real-shaped bank counts. The VALUES are irrelevant — every one of them
 * is replaced by a sentinel below — but the SHAPE has to be complete, or a
 * newly added count would silently never be checked. */
const BANK_SHAPE: IntroBankCounts = {
  flashcards: 1,
  stories: 1,
  freeStories: 1,
  idioms: 1,
  glossaryTerms: 1,
  wordSearchPuzzles: 1,
  crosswordPuzzles: 1,
};

export interface Sentinelled {
  stats: IntroStats;
  /** sentinel value → the dotted path of the stat it stands for */
  byValue: Map<number, string>;
}

/** Replaces every number in the stats tree with a unique value, keeping a
 * map back to the field it came from so a failure can name it. */
export function sentinelStats(): Sentinelled {
  const byValue = new Map<number, string>();
  let next = SENTINEL_BASE;

  const walk = (value: unknown, path: string): unknown => {
    if (typeof value === "number") {
      const sentinel = next;
      next += 1;
      byValue.set(sentinel, path);
      return sentinel;
    }
    if (Array.isArray(value)) return value.map((item, i) => walk(item, `${path}[${i}]`));
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, walk(v, path ? `${path}.${k}` : k)]),
      );
    }
    return value;
  };

  return { stats: walk(introStatsFrom(BANK_SHAPE), "") as IntroStats, byValue };
}

/** Every human-visible string a slide produces. */
export function slideTexts(stats: IntroStats): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = [];
  for (const slide of buildIntroSlides(stats)) {
    out.push({ where: `${slide.id}.title`, text: slide.title });
    slide.body.forEach((p, i) => out.push({ where: `${slide.id}.body[${i}]`, text: p }));
    (slide.highlights ?? []).forEach((h, i) => out.push({ where: `${slide.id}.highlights[${i}]`, text: h }));
    // Link labels are read; hrefs are addresses, and the alphabet path is
    // imported from cyrillic-alphabet.ts anyway.
    (slide.links ?? []).forEach((l, i) => out.push({ where: `${slide.id}.links[${i}].label`, text: l.label }));
  }
  return out;
}

/** A digit run that is not welded to a letter — so "A1" and "B2" are not
 * numbers here, but "83" and "2 134" are. */
const FREE_STANDING_DIGITS = /(?<![\p{L}\d])\d+(?![\p{L}\d])/gu;

export interface Result {
  handwritten: Array<{ where: string; value: string; text: string }>;
  unusedSentinels: string[];
  scannedStrings: number;
  usedSentinels: number;
}

export function scan(): Result {
  const { stats, byValue } = sentinelStats();
  const texts = slideTexts(stats);

  const handwritten: Array<{ where: string; value: string; text: string }> = [];
  const seen = new Set<number>();

  for (const { where, text } of texts) {
    for (const match of text.matchAll(FREE_STANDING_DIGITS)) {
      const value = match[0];
      const asNumber = Number(value);
      if (byValue.has(asNumber)) {
        seen.add(asNumber);
        continue;
      }
      if (WORLD_FACTS.has(value)) continue;
      handwritten.push({ where, value, text });
    }
  }

  const unusedSentinels = [...byValue.entries()]
    .filter(([sentinel]) => !seen.has(sentinel))
    .map(([, path]) => path)
    .sort();

  return { handwritten, unusedSentinels, scannedStrings: texts.length, usedSentinels: seen.size };
}

function report(result: Result): boolean {
  const { handwritten, unusedSentinels, scannedStrings, usedSentinels } = result;
  if (handwritten.length) {
    console.error("check:intro-numbers — FAILED\n");
    for (const hit of handwritten) {
      console.error(`  ${hit.where}: «${hit.value}» is written by hand.`);
      console.error(`      ${hit.text}`);
      console.error(
        "      Take it from src/lib/intro/stats.ts instead. If it is a fact about the\n" +
          "      world rather than a quantity of this product, add it to WORLD_FACTS in\n" +
          "      scripts/check-intro-numbers.ts with the reason.\n",
      );
    }
  }
  if (unusedSentinels.length) {
    console.error("check:intro-numbers — counted but never shown:\n");
    for (const path of unusedSentinels) {
      console.error(`  ${path} is counted in stats.ts and appears on no slide.`);
    }
    console.error(
      "\nEither a slide stopped printing it, or the counter outlived its sentence.\n" +
        "Remove the field or use it — a number nobody shows is a number nobody checks.\n",
    );
  }
  if (handwritten.length || unusedSentinels.length) return false;

  console.log(
    `check:intro-numbers — ${scannedStrings} slide strings scanned, ` +
      `0 hand-written numbers, all ${usedSentinels} counted quantities reach the deck ` +
      `(${WORLD_FACTS.size} world fact(s) allowed by name).`,
  );
  return true;
}

/**
 * The positive control. Two plants, because the check makes two claims and
 * either half could rot on its own:
 *
 *   1. a hand-written number inside a slide sentence — the defect this
 *      exists for;
 *   2. a counted quantity that no slide prints — the silent half, which no
 *      reader of the rendered page would ever notice.
 *
 * Both are planted IN THE REAL FILES and checked by running this script
 * again as a separate process. In memory would be cheaper and would prove
 * less: an ES module is read once per process, so a plant written to disk
 * is invisible to an already-imported `buildIntroSlides`. A control that
 * re-implements the rule instead of running it can pass while the rule
 * itself is broken.
 *
 * The files are restored in a `finally`, and the last line of the run is
 * the unplanted check, so a crash between the two is visible rather than
 * silently left behind.
 */
function plantControls(): boolean {
  const CONTENT = "src/lib/intro/content.ts";
  const STATS = "src/lib/intro/stats.ts";

  /** Runs this very script in a child process; true when it FAILED. */
  const failsWith = (needle: string): boolean => {
    try {
      execFileSync("npx", ["tsx", "scripts/check-intro-numbers.ts"], { encoding: "utf8", stdio: "pipe" });
      return false; // exit 0 — the plant went unnoticed
    } catch (error) {
      const output = String((error as { stdout?: string; stderr?: string }).stdout ?? "") +
        String((error as { stderr?: string }).stderr ?? "");
      return output.includes(needle);
    }
  };

  const controls = [
    {
      name: "a hand-written number in a slide sentence",
      file: CONTENT,
      plant: (source: string) =>
        source.replace(
          'title: "Qué hay adentro",',
          'title: "Qué hay adentro (42 lecciones)",',
        ),
      needle: "is written by hand",
    },
    {
      name: "a counted quantity that reaches no slide",
      file: STATS,
      plant: (source: string) =>
        source.replace(
          "  bank: IntroBankCounts | null;",
          "  neverShown: number;\n  bank: IntroBankCounts | null;",
        ).replace(
          "    bank,",
          "    neverShown: 99,\n    bank,",
        ),
      needle: "counted but never shown",
    },
  ];

  let ok = true;
  for (const control of controls) {
    const original = readFileSync(control.file, "utf8");
    const planted = control.plant(original);
    if (planted === original) {
      console.log(`  MISSED — ${control.name} (the plant did not apply; this file moved)`);
      ok = false;
      continue;
    }
    let caught = false;
    try {
      writeFileSync(control.file, planted);
      caught = failsWith(control.needle);
    } finally {
      writeFileSync(control.file, original);
    }
    console.log(`  ${caught ? "caught" : "MISSED"} — ${control.name}`);
    ok &&= caught;
  }

  const clean = report(scan());
  console.log(`  ${clean ? "clean" : "STILL DIRTY"} — after restoring both files`);
  ok &&= clean;
  console.log(ok ? "check:intro-numbers --plant — 3 of 3" : "check:intro-numbers --plant — FAILED");
  return ok;
}

if (isEntryPoint(import.meta.url)) {
  const ok = process.argv.includes("--plant") ? plantControls() : report(scan());
  process.exitCode = ok ? 0 : 1;
}
