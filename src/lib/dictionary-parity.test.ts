import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The two dictionaries must stay in step, and the Russian one must actually
 * be in Russian.
 *
 * Debt 16, found 29.08.2026 by the rendered-surface check, not by reading:
 * /ru/glossary served the h1 "Glosario de términos lingüísticos" — Spanish,
 * on the Russian page. The whole `glossary` block of ru.json was still the
 * Spanish copy. The debt said 19 keys; the actual count was **25**, which is
 * itself the argument for a test rather than a hand-audit.
 *
 * Three things are checked, and the third is the one that matters:
 *   1. same key set both ways — a key added to one file only
 *   2. no key whose Russian value is byte-identical to the Spanish one
 *      while being Latin-script prose
 *   3. no Russian value that is plainly Spanish (no Cyrillic at all)
 *
 * Deliberately NOT checked: Cyrillic inside es.json. There are 37 such
 * values and every one is correct — this app teaches Russian to Spanish
 * speakers, so its Spanish lesson titles quote Russian words ("Caso
 * dativo: la edad (мне... лет)"). A "no Cyrillic in the Spanish file" rule
 * would flag 37 correct strings and zero defects. The asymmetry is real:
 * Russian content belongs in the Spanish file, Spanish UI copy does not
 * belong in the Russian one.
 */

const DIR = join(process.cwd(), "src", "dictionaries");
const es = JSON.parse(readFileSync(join(DIR, "es.json"), "utf8")) as Record<string, unknown>;
const ru = JSON.parse(readFileSync(join(DIR, "ru.json"), "utf8")) as Record<string, unknown>;

const CYRILLIC = /[а-яёА-ЯЁ]/;
/** Four or more Latin letters in a row's worth — enough to be prose rather
 * than a unit, a code, or a brand fragment. */
const LATIN_LETTERS = /[a-záéíóúñü]/gi;

function flatten(value: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") out[key] = v;
      else flatten(v, key, out);
    }
  }
  return out;
}

const ES = flatten(es);
const RU = flatten(ru);

/**
 * Russian values that legitimately carry no Cyrillic. Every entry is here
 * for a stated reason; this list is not a place to park a defect.
 *
 * Checked against the live files on 29.08.2026: 42 Russian values had no
 * Cyrillic, 25 of them were the untranslated glossary block (now fixed) and
 * these 17 are correct as they stand.
 */
const NO_CYRILLIC_IS_CORRECT = new Map<string, string>([
  ["auth.emailPlaceholder", "an example address, not prose"],
  ["auth.legalNoticeAfterPrivacy", "punctuation fragment closing a sentence built from parts"],
  ["pricing.monthly.price", "currency amount"],
  ["pricing.monthly.mxnApprox", "currency amount"],
  ["pricing.annual.price", "currency amount"],
  ["pricing.annual.badge", "a percentage"],
  ["pricing.annual.mxnApprox", "currency amount"],
  ["pricing.lifetime.name", "the plan is called Premium in both locales"],
  ["pricing.lifetime.price", "currency amount"],
  ["pricing.lifetime.mxnApprox", "currency amount"],
  ["profile.emailLabel", "'Email' is the ordinary Russian word too"],
  ["admin.users.emailHeader", "same"],
  ["vocabulary.recall.directionEsToRuLabel", "language codes"],
  ["vocabulary.recall.directionRuToEsLabel", "language codes"],
  ["admin.exams.examSlugPlaceholder", "an example slug"],
  ["download.iosCta", "store name, not translated by Apple's own guidelines"],
  ["download.androidCta", "store name"],
]);

describe("dictionary parity", () => {
  it("reads both dictionaries and finds real content", () => {
    // Without this, an empty parse would make every assertion below pass.
    expect(Object.keys(ES).length).toBeGreaterThan(1000);
    expect(Object.keys(RU).length).toBeGreaterThan(1000);
    expect(ES["glossary.pageTitle"]).toBeTruthy();
    expect(RU["glossary.pageTitle"]).toBeTruthy();
  });

  it("has exactly the same keys in both files", () => {
    expect(Object.keys(ES).filter((k) => !(k in RU))).toEqual([]);
    expect(Object.keys(RU).filter((k) => !(k in ES))).toEqual([]);
  });

  it("has no Russian value left as the Spanish original", () => {
    const untranslated = Object.keys(RU).filter(
      (k) => RU[k] === ES[k] && !CYRILLIC.test(RU[k]) && (RU[k].match(LATIN_LETTERS) ?? []).length >= 4
    );
    // Anything on the allowlist is excluded, but only if it is still there.
    expect(untranslated.filter((k) => !NO_CYRILLIC_IS_CORRECT.has(k))).toEqual([]);
  });

  it("has no Russian value that is Spanish prose", () => {
    // Catches the case the check above misses: a value edited away from the
    // Spanish original but still written in Spanish.
    const spanish = Object.keys(RU).filter(
      (k) => !CYRILLIC.test(RU[k]) && (RU[k].match(LATIN_LETTERS) ?? []).length >= 4 && !NO_CYRILLIC_IS_CORRECT.has(k)
    );
    expect(spanish).toEqual([]);
  });

  it("keeps the allowlist honest — every entry still exists and still lacks Cyrillic", () => {
    // An allowlist that outlives its entries silently widens over time.
    for (const [key, reason] of NO_CYRILLIC_IS_CORRECT) {
      expect(RU[key], `${key} is on the allowlist but no longer exists`).toBeDefined();
      expect(CYRILLIC.test(RU[key]), `${key} now has Cyrillic (${reason}) — drop it from the allowlist`).toBe(false);
    }
  });

  it("positive control: a planted Spanish value in ru.json is caught", () => {
    // Both detectors, on the exact shape the defect had: the glossary block
    // before it was translated.
    const planted: Record<string, string> = { ...RU, "glossary.pageTitle": "Glosario de términos lingüísticos" };
    const identical = Object.keys(planted).filter(
      (k) => planted[k] === ES[k] && !CYRILLIC.test(planted[k]) && (planted[k].match(LATIN_LETTERS) ?? []).length >= 4 && !NO_CYRILLIC_IS_CORRECT.has(k)
    );
    expect(identical).toContain("glossary.pageTitle");

    // …and a value changed from the original but still Spanish, which the
    // byte-identical check alone would let through.
    const drifted: Record<string, string> = { ...RU, "courses.pageTitle": "Cursos de ruso online" };
    expect(drifted["courses.pageTitle"]).not.toBe(ES["courses.pageTitle"]);
    const spanish = Object.keys(drifted).filter(
      (k) => !CYRILLIC.test(drifted[k]) && (drifted[k].match(LATIN_LETTERS) ?? []).length >= 4 && !NO_CYRILLIC_IS_CORRECT.has(k)
    );
    expect(spanish).toContain("courses.pageTitle");
  });

  it("positive control: a missing key is caught in both directions", () => {
    const withoutOne: Record<string, string> = { ...RU };
    delete withoutOne["courses.pageTitle"];
    expect(Object.keys(ES).filter((k) => !(k in withoutOne))).toEqual(["courses.pageTitle"]);
    const extra: Record<string, string> = { ...RU, "courses.inventedKey": "выдумка" };
    expect(Object.keys(extra).filter((k) => !(k in ES))).toEqual(["courses.inventedKey"]);
  });

  it("positive control: the brand name is not mistaken for Spanish", () => {
    // "RusoFácilapp" carries á and appears inside five Russian strings. A
    // naive "no Spanish orthography in ru.json" rule would flag all five.
    const brandStrings = Object.keys(RU).filter((k) => RU[k].includes("RusoFácilapp") && CYRILLIC.test(RU[k]));
    expect(brandStrings.length).toBeGreaterThan(0);
    for (const k of brandStrings) {
      expect((RU[k].match(LATIN_LETTERS) ?? []).length, k).toBeGreaterThan(4);
      // …and none of them is reported, because they have Cyrillic.
      expect(CYRILLIC.test(RU[k])).toBe(true);
    }
  });
});
