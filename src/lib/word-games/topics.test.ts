import { describe, expect, it } from "vitest";
import { VOCABULARY_CATEGORY_PAGES } from "@/lib/vocabulary-categories";
import { isFreeWordGamePuzzle } from "@/lib/word-games/free-tier";
import { flashcardLevels } from "@/lib/flashcards/types";
import { wordGameTypes } from "./types";
import {
  FREE_RUNGS_PER_LADDER,
  allTopicSlugs,
  categoryForTopic,
  getTopicInfo,
  puzzlesForTopic,
  topicForPuzzle,
  vocabularyPathForTopic,
} from "./topics";

/**
 * The frozen rung -> category table is content, and content that is wrong
 * here is wrong on a live indexed URL: a puzzle titled "sopa de letras de
 * comida" whose words are not about food, or a link to a vocabulary page
 * that does not exist.
 */

/** Every coordinate the app can actually serve, paid rungs included. */
function* coordinates() {
  for (const type of wordGameTypes) {
    for (const level of flashcardLevels) {
      for (let sequence = 1; sequence <= 40; sequence++) yield { type, level, sequence };
    }
  }
}

describe("free-puzzle topics", () => {
  it("themes only free puzzles, never a paid one", () => {
    // The whole decision was "regenerate the 80 free puzzles in place,
    // leave the ~5900 paid ones alone". A topic on a paid rung would mean
    // the generator had rewritten a row nobody asked it to touch.
    const themed = [...coordinates()].filter((c) => topicForPuzzle(c.type, c.level, c.sequence) !== null);
    expect(themed.length).toBeGreaterThan(0);
    for (const c of themed) {
      expect(isFreeWordGamePuzzle(c), `${c.type}/${c.level}/${c.sequence}`).toBe(true);
    }
    // C1 is paid in full and must never appear.
    expect(themed.some((c) => c.level === "C1")).toBe(false);
  });

  it("never repeats a category inside one ladder", () => {
    // Titles carry type + topic + level and no rung number, so two rungs
    // of one ladder sharing a category would produce two identical titles
    // — the exact defect these pages were rescued from. The uniqueness
    // assertion in metadata.test.ts depends on this property holding.
    for (const type of wordGameTypes) {
      for (const level of flashcardLevels) {
        const used = [];
        for (let sequence = 1; sequence <= FREE_RUNGS_PER_LADDER; sequence++) {
          const topic = topicForPuzzle(type, level, sequence);
          if (topic) used.push(topic);
        }
        expect(new Set(used).size, `${type} ${level}: ${used.join(", ")}`).toBe(used.length);
      }
    }
  });

  it("positive control: a repeated category inside a ladder does collide", () => {
    // Proves the check above is testing something. Two rungs of the same
    // ladder with the same topic produce the same title, so the assertion
    // is load-bearing rather than decorative.
    const a = topicForPuzzle("WORD_SEARCH", "A2", 1);
    expect(a).not.toBeNull();
    const asIfRepeated = [a, a];
    expect(new Set(asIfRepeated).size).not.toBe(asIfRepeated.length);
  });

  it("only names categories that have a label and a live page", () => {
    // A slug with no label would silently fall back to the mixed title; a
    // slug with no page would make the cross-link a 404.
    for (const slug of allTopicSlugs()) {
      expect(getTopicInfo(slug), slug).not.toBeNull();
      expect(vocabularyPathForTopic(slug), slug).toBe(`/es/vocabulary/${slug}`);
      const category = categoryForTopic(slug);
      expect(category, slug).not.toBeNull();
      expect(VOCABULARY_CATEGORY_PAGES.some((p) => p.category === category && p.slug === slug), slug).toBe(true);
    }
  });

  it("positive control: an unknown slug is refused rather than guessed", () => {
    expect(getTopicInfo("no-such-category")).toBeNull();
    expect(vocabularyPathForTopic("no-such-category")).toBeNull();
    expect(categoryForTopic("no-such-category")).toBeNull();
    expect(getTopicInfo(null)).toBeNull();
  });

  it("agrees with itself in both directions", () => {
    // puzzlesForTopic drives the link FROM the vocabulary page, and
    // topicForPuzzle drives the title and the link back. If the two ever
    // disagreed, a vocabulary page would advertise a puzzle that does not
    // claim it.
    for (const slug of allTopicSlugs()) {
      const puzzles = puzzlesForTopic(slug);
      expect(puzzles.length, slug).toBeGreaterThan(0);
      for (const p of puzzles) {
        expect(topicForPuzzle(p.type, p.level, p.sequence), `${slug} -> ${p.type}/${p.level}/${p.sequence}`).toBe(slug);
      }
    }
    // and nothing is missed in the other direction
    const fromTable = [...coordinates()].filter((c) => topicForPuzzle(c.type, c.level, c.sequence));
    const fromReverse = allTopicSlugs().flatMap((s) => puzzlesForTopic(s));
    expect(fromReverse.length).toBe(fromTable.length);
  });

  it("returns null outside the ladder rather than throwing", () => {
    expect(topicForPuzzle("WORD_SEARCH", "A1", 0)).toBeNull();
    expect(topicForPuzzle("WORD_SEARCH", "A1", 999)).toBeNull();
    expect(topicForPuzzle("WORD_SEARCH", "A1", 1.5)).toBeNull();
    expect(topicForPuzzle("WORD_SEARCH", "C1", 1)).toBeNull();
  });

  it("leaves the ladders that could not be themed visibly incomplete", () => {
    // 11 of the 80 rungs have no category with enough words in their
    // length band and keep the mixed generator. That is a real result, not
    // an oversight, and it is asserted so that a future edit which quietly
    // fills them with an unverified category has to say so.
    let themed = 0;
    let mixed = 0;
    for (const type of wordGameTypes) {
      for (const level of flashcardLevels) {
        if (level === "C1") continue;
        for (let sequence = 1; sequence <= FREE_RUNGS_PER_LADDER; sequence++) {
          if (topicForPuzzle(type, level, sequence)) themed++;
          else mixed++;
        }
      }
    }
    expect(themed + mixed).toBe(80);
    expect(themed).toBe(69);
    expect(mixed).toBe(11);
  });
});
