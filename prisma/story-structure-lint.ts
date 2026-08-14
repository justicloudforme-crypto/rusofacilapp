/**
 * Mechanical pre-QA lint for the story bank (prisma/stories-data.ts) — automates
 * the cheap, purely structural checks that used to be manual self-review steps,
 * so the blind QA subagent's time goes entirely to the judgment calls it's
 * actually needed for (plot fidelity, moral accuracy, mechanism/register match).
 *
 * This tool does NOT replace QA. It only catches:
 *   1. RU/ES paragraph-count mismatches (a hard bug — always 0 findings expected).
 *   2. Title-collision-adjacent sanity: does the title's main noun appear in the
 *      body? (heuristic word-overlap check, catches things like the "варежка" vs
 *      "перчатка" title/body mismatch from pipeline run 29 — advisory, not exhaustive).
 *   3. Candidate деепричастие/причастие word forms in A1/A2/B1 stories — flags
 *      words whose ending LOOKS like a participle/gerund suffix. This has real
 *      false positives (lexicalized adjectives like "сломанный", "любимый" match
 *      the same endings and are fine) — it's a checklist to speed up the human
 *      self-review pass established after pipeline runs 18/20/29, not an auto-reject.
 *
 * Read-only, no DB connection needed.
 *   npm run lint:stories
 */
import { stories } from "./stories-data";

const RUSSIAN_STOPWORDS = new Set([
  "и", "в", "на", "с", "у", "к", "о", "об", "за", "по", "из", "от", "для", "не", "но",
  "а", "что", "как", "это", "его", "её", "их", "он", "она", "они", "мы", "вы", "я",
  "один", "одна", "одно", "новый", "новая", "новое", "первый", "первая", "последний",
]);

// Suffixes that mark деепричастие (gerund) or причастие (participle) morphology.
// Deliberately over-broad — false positives are expected and fine, this is a
// checklist for a human, not an auto-reject gate.
const PARTICIPLE_GERUND_SUFFIXES = [
  "вший", "вшая", "вшее", "вшие", "вшим", "вшей", "вшими", "вшего", "вшую",
  "ющий", "ющая", "ющее", "ющие", "ющим", "ющей", "ющими", "ющего", "ющую",
  "ущий", "ущая", "ущее", "ущие", "ущим", "ущей", "ущими", "ущего", "ущую",
  "ащий", "ащая", "ащее", "ащие", "ащим", "ащей", "ащими", "ащего", "ащую",
  "ящий", "ящая", "ящее", "ящие", "ящим", "ящей", "ящими", "ящего", "ящую",
  "нный", "нная", "нное", "нные", "нным", "нной", "нными", "нного", "нную",
  "вши", // деепричастие: сделав, увидев is handled by trailing "в" below
];

function titleNounOverlap(title: string, body: string): boolean {
  const titleWords = title
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?«»"']/g, "").toLowerCase())
    .filter((w) => w.length >= 4 && !RUSSIAN_STOPWORDS.has(w));
  if (titleWords.length === 0) return true; // nothing substantive to check
  const bodyLower = body.toLowerCase();
  // Match on a 5-char stem so simple case inflection doesn't cause false alarms.
  return titleWords.some((w) => bodyLower.includes(w.slice(0, Math.min(5, w.length))));
}

function findParticipleCandidates(text: string): string[] {
  const words = text.split(/[\s.,!?«»"'—():;]+/).filter(Boolean);
  const hits = new Set<string>();
  for (const word of words) {
    const lower = word.toLowerCase();
    if (PARTICIPLE_GERUND_SUFFIXES.some((suf) => lower.endsWith(suf))) {
      hits.add(word);
    } else if (/[а-я]в$/i.test(lower) && lower.length > 4) {
      // trailing bare "-в" деепричастие (сделав, решив, увидев...) — very noisy,
      // only flag if the word isn't a common short verb form ending coincidentally in в.
      hits.add(word);
    }
  }
  return [...hits];
}

function main() {
  let issues = 0;

  console.log(`Linting ${stories.length} stories...\n`);

  for (const story of stories) {
    const ruLines = story.text.split("\n");
    const esLines = story.translationEs.split("\n");

    if (ruLines.length !== esLines.length) {
      issues++;
      console.log(`✗ [${story.level}] "${story.title}": RU has ${ruLines.length} lines, ES has ${esLines.length} — paragraph misalignment.`);
    }

    if (!titleNounOverlap(story.title, story.text)) {
      // Advisory only — many real titles are symbolic/abstract/a character name
      // ("Хамелеон", "Второй шанс") and legitimately won't literal-match the body.
      // Not counted toward the hard-fail `issues` total; scan the printed list by
      // eye for the one pattern this actually catches: a concrete object noun in
      // the title that the body consistently calls something else (run 29's
      // варежка/перчатка bug).
      console.log(`⚠ [${story.level}] "${story.title}": title's main word(s) not found in body — verify title/body consistency (expect false positives on symbolic/abstract titles).`);
    }

    if (["A1", "A2", "B1"].includes(story.level)) {
      const candidates = findParticipleCandidates(story.text);
      if (candidates.length > 0) {
        console.log(`  [${story.level}] "${story.title}": possible деепричастие/причастие forms to verify by hand: ${candidates.join(", ")}`);
      }
    }
  }

  console.log(`\n${issues === 0 ? "No hard structural issues found." : `${issues} hard structural issue(s) found — fix before QA.`}`);
  console.log("Note: the деепричастие/причастие list above is advisory only (expect false positives on lexicalized adjectives like \"сломанный\"/\"любимый\") — use it as a checklist, not an auto-reject.");
  if (issues > 0) process.exitCode = 1;
}

main();
