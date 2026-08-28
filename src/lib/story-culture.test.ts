import { describe, expect, it } from "vitest";
import { stories } from "../../prisma/stories-data";
import { CULTURAL_NOTE_TITLES, getCulturalNote } from "./story-culture";
import { isFrozenStory, isPilotStory, isControlStory } from "./story-pilot";

const byTitle = new Map(stories.map((s) => [s.title, s]));
const classics = stories.filter((s) => !s.author.startsWith("RusoFásil"));

describe("cultural notes", () => {
  it("never touches a story frozen by the thin-page experiment", () => {
    // The whole point of this test. Три медведя, Теремок and Снегурочка
    // are classic tales AND members of the A1 control group, so they read
    // as obvious candidates for a note and must not get one until
    // 25.09.2026. PROGRESS.md's original draft list did list them as
    // free, which is exactly the mistake this catches.
    const frozen = CULTURAL_NOTE_TITLES.filter((title) => {
      const story = byTitle.get(title);
      return story ? isFrozenStory(story) : false;
    });
    expect(frozen).toEqual([]);
  });

  it("covers every classic story that is not frozen, and nothing else", () => {
    const eligible = classics.filter((s) => !isFrozenStory(s)).map((s) => s.title);
    expect([...CULTURAL_NOTE_TITLES].sort()).toEqual([...eligible].sort());
    expect(eligible).toHaveLength(40);
  });

  it("writes no note for a RusoFácilapp original", () => {
    const original = stories.find((s) => s.author.startsWith("RusoFásil"))!;
    expect(getCulturalNote(original, "es")).toBeNull();
    expect(getCulturalNote(original, "ru")).toBeNull();
  });

  it("has both locales for every note, within the agreed length", () => {
    for (const title of CULTURAL_NOTE_TITLES) {
      const story = byTitle.get(title)!;
      for (const lang of ["es", "ru"] as const) {
        const note = getCulturalNote(story, lang);
        expect(note, `${title} / ${lang}`).toBeTruthy();
        expect(note!.length, `${title} / ${lang}`).toBeGreaterThanOrEqual(300);
        expect(note!.length, `${title} / ${lang}`).toBeLessThanOrEqual(400);
      }
    }
  });

  it("ignores a title match at the wrong level", () => {
    const story = byTitle.get("Хамелеон")!;
    expect(getCulturalNote(story, "es")).toBeTruthy();
    expect(getCulturalNote({ title: "Хамелеон", level: "A1" }, "es")).toBeNull();
  });

  it("never mixes Latin and Cyrillic inside one word", () => {
    // Same guard the glossary seed data carries: a Latin "c" or "p" typed
    // into a Cyrillic word is invisible on screen and breaks search.
    const mixed: string[] = [];
    for (const title of CULTURAL_NOTE_TITLES) {
      const story = byTitle.get(title)!;
      for (const lang of ["es", "ru"] as const) {
        for (const word of getCulturalNote(story, lang)!.split(/[^\p{L}]+/u)) {
          if (/[А-Яа-яЁё]/.test(word) && /[A-Za-z]/.test(word)) mixed.push(`${title}: ${word}`);
        }
      }
    }
    expect(mixed).toEqual([]);
  });
});

describe("frozen-story helpers", () => {
  it("counts the experiment groups as recorded in PROGRESS.md", () => {
    expect(stories.filter(isPilotStory)).toHaveLength(50);
    expect(stories.filter(isControlStory)).toHaveLength(15);
    expect(stories.filter(isFrozenStory)).toHaveLength(65);
  });

  it("puts the three classic A1 tales of the control group off limits", () => {
    for (const title of ["Три медведя", "Теремок", "Снегурочка"]) {
      expect(isFrozenStory(byTitle.get(title)!), title).toBe(true);
    }
  });
});
