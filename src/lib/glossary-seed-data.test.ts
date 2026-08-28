import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard against the glossary data drifting back out of shape.
 *
 * This reads prisma/seed-glossary.ts as TEXT rather than importing it: that
 * module runs its own main() against the database on import, and the seed
 * file — not the DB — is the source of truth these rules protect. Production
 * is kept in sync with it (`npm run db:seed-glossary -- --dry-run` reports
 * `identical` when they agree), so guarding the file guards both.
 *
 * What is checked here is only what formalises cleanly. See PROGRESS.md
 * ("ЗАКРЫТО #4") for the transcription standard in full, including the class
 * of errors this file deliberately does NOT try to catch.
 */

const SEED_PATH = path.resolve(__dirname, "../../prisma/seed-glossary.ts");
const source = readFileSync(SEED_PATH, "utf8");

interface Entry {
  slug: string;
  transcription: string;
  /** Every string literal inside the entry — checked for script mixing. */
  body: string;
}

function parseEntries(): Entry[] {
  const entries: Entry[] = [];
  // Entries are object literals starting at `slug:` and ending at the
  // `relatedLessons:` line that closes every one of them.
  const re = /slug: "([a-z0-9-]+)",([\s\S]*?relatedLessons: \[[^\]]*\],)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const body = match[2];
    const transcription = /transcription: "([^"]*)"/.exec(body)?.[1] ?? "";
    entries.push({ slug: match[1], transcription, body });
  }
  return entries;
}

const entries = parseEntries();

/** Splits a transcription into comparable tokens (it may hold several words,
 * a `/` between an aspect pair, or quoted Russian particles). */
function tokens(transcription: string): string[] {
  return transcription
    .split(/[\s/]+/)
    .map((t) => t.replace(/[«».,()]/g, ""))
    .filter(Boolean);
}

describe("glossary seed data", () => {
  it("parses every entry (guards the parser itself against silent drift)", () => {
    // If the file's shape changes and this regex stops matching, every other
    // assertion below would vacuously pass. This is the tripwire for that.
    expect(entries.length).toBeGreaterThanOrEqual(117);
    expect(entries.every((e) => e.transcription.length > 0)).toBe(true);
  });

  it("has no duplicate slugs", () => {
    const seen = new Map<string, number>();
    for (const e of entries) seen.set(e.slug, (seen.get(e.slug) ?? 0) + 1);
    const duplicates = [...seen].filter(([, n]) => n > 1).map(([slug]) => slug);
    expect(duplicates).toEqual([]);
  });

  // Rule 1 of the standard: a transcription spells actual pronunciation, so a
  // word-final voiced obstruent cannot occur — Russian devoices it. This is
  // the general rule; the specific spellings that were wrong in the past
  // (padyézh, predlóg, zalóg, slyeng, soyúz, infinitív) are all instances of
  // it, and are asserted by name below as well.
  it("has no word-final voiced obstruent in any transcription", () => {
    const offenders: string[] = [];
    for (const e of entries) {
      for (const token of tokens(e.transcription)) {
        // Two-letter and shorter tokens are quoted Russian function words
        // («v», «i», «na», «-ta»), not full words carrying the rule.
        if (token.length <= 2) continue;
        if (/(zh|[bvgdz])$/.test(token)) offenders.push(`${e.slug}: "${token}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has none of the specific spellings the 2026-08-28 audit removed", () => {
    // Matched as whole tokens, not substrings: "predlógi" (предлоги, plural)
    // is correct — г is not word-final there, so nothing devoices. Written as
    // a substring check first, this assertion failed on exactly that word.
    const forbidden = new Set(["padyézh", "predlóg", "zalóg", "slyeng", "soyúz", "infinitív"]);
    const offenders: string[] = [];
    for (const e of entries) {
      for (const token of tokens(e.transcription)) {
        if (forbidden.has(token)) offenders.push(`${e.slug}: "${token}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  // Rule 4 (akanye) applied to the commonest ending: unstressed -ое is
  // pronounced -aye, so a transcription may only end in "-oye" when that o
  // carries the stress mark (pryamóye, dvaynóye are correct).
  it("writes unstressed -ое as -aye, never -oye", () => {
    const offenders: string[] = [];
    for (const e of entries) {
      for (const token of tokens(e.transcription)) {
        if (/oye$/.test(token) && !/óye$/.test(token)) offenders.push(`${e.slug}: "${token}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  // A real bug caught by hand on 2026-08-28: a Latin "p" glued onto Cyrillic
  // "робелы". Editing Spanish and Russian in the same line makes this easy to
  // do and nearly impossible to see.
  it("never mixes Cyrillic and Latin letters inside one word", () => {
    const offenders: string[] = [];
    for (const e of entries) {
      const words = e.body.match(/[A-Za-zА-Яа-яЁё'’-]{2,}/g) ?? [];
      for (const word of words) {
        if (/[А-Яа-яЁё]/.test(word) && /[A-Za-z]/.test(word)) {
          offenders.push(`${e.slug}: "${word}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
