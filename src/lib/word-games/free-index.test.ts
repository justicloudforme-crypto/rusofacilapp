import { describe, expect, it } from "vitest";
import { freeLadders, freeNeighbours, freeRungPaths } from "./free-index";
import { isFreeWordGamePuzzle, WORD_GAME_FREE_RUNGS_PER_LEVEL } from "./free-tier";

/** A production-shaped bank: every ladder holds rungs 1..10 and far beyond. */
const deep = () => Array.from({ length: 400 }, (_, i) => i + 1);

describe("freeLadders", () => {
  it("names exactly the 80 free puzzles — 2 types x 4 levels x 10", () => {
    const paths = freeRungPaths("es", deep);
    expect(paths).toHaveLength(2 * 4 * WORD_GAME_FREE_RUNGS_PER_LEVEL);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("agrees with isFreeWordGamePuzzle on every rung it emits", () => {
    for (const ladder of freeLadders("es", deep)) {
      for (const rung of ladder.rungs) {
        expect(isFreeWordGamePuzzle(rung)).toBe(true);
      }
    }
  });

  it("emits no C1 rung — the rule excludes the level, not just the tail", () => {
    expect(freeRungPaths("es", deep).filter((p) => p.includes("/C1/"))).toEqual([]);
  });

  it("emits the same rungs for both locales, differing only in the prefix", () => {
    expect(freeRungPaths("ru", deep)).toEqual(freeRungPaths("es", deep).map((p) => p.replace("/es/", "/ru/")));
  });

  it("never links past the end of a short ladder", () => {
    const short = (_type: string, level: string) => (level === "B2" ? [1, 2, 3] : deep());
    const paths = freeRungPaths("es", short as never);
    expect(paths.filter((p) => p.includes("/B2/"))).toHaveLength(2 * 3);
    expect(paths.filter((p) => p.endsWith("/B2/4"))).toEqual([]);
  });

  it("drops a ladder with no rows instead of emitting dead links", () => {
    const empty = (type: string) => (type === "CROSSWORD" ? [] : deep());
    const ladders = freeLadders("es", empty as never);
    expect(ladders.every((l) => l.type === "WORD_SEARCH")).toBe(true);
    expect(freeRungPaths("es", empty as never)).toHaveLength(4 * WORD_GAME_FREE_RUNGS_PER_LEVEL);
  });

  it("skips a gap in the ladder instead of linking a rung that is not there", () => {
    const gapped = (_type: string, level: string) => (level === "A2" ? [1, 2, 5, 9] : deep());
    const paths = freeRungPaths("es", gapped as never);
    expect(paths.filter((p) => p.includes("/A2/"))).toHaveLength(2 * 4);
    expect(paths).not.toContain("/es/word-games/CROSSWORD/A2/3");
    expect(paths).toContain("/es/word-games/CROSSWORD/A2/5");
  });

  /**
   * Positive control for the two tests above: a helper that ignored the
   * ladder length — the obvious wrong implementation, and the one a fixed
   * `Array.from({length: 10})` would give — must be visibly different on
   * the same input. Without this, "never links past the end" would pass on
   * a version that cannot fail it for any bank shape at all.
   */
  it("control: ignoring the ladder length really does produce different output", () => {
    const short = (_type: string, level: string) => (level === "B2" ? [1, 2, 3] : deep());
    const clipped = freeRungPaths("es", short as never);
    const unclipped = freeRungPaths("es", deep);
    expect(unclipped.length - clipped.length).toBe(2 * (WORD_GAME_FREE_RUNGS_PER_LEVEL - 3));
    expect(unclipped).toContain("/es/word-games/CROSSWORD/B2/10");
    expect(clipped).not.toContain("/es/word-games/CROSSWORD/B2/10");
  });
});

describe("freeNeighbours", () => {
  it("walks the free ladder in both directions", () => {
    const middle = freeNeighbours("es", "CROSSWORD", "B1", 5, deep);
    expect(middle.prev?.href).toBe("/es/word-games/CROSSWORD/B1/4");
    expect(middle.next?.href).toBe("/es/word-games/CROSSWORD/B1/6");
  });

  it("has no previous rung at the bottom and no next rung at the top of the FREE ladder", () => {
    expect(freeNeighbours("ru", "WORD_SEARCH", "A1", 1, deep).prev).toBeNull();
    const last = freeNeighbours("ru", "WORD_SEARCH", "A1", WORD_GAME_FREE_RUNGS_PER_LEVEL, deep);
    expect(last.next, "rung 11 is paywalled; linking it hands a crawler a 307").toBeNull();
    expect(last.prev?.sequence).toBe(WORD_GAME_FREE_RUNGS_PER_LEVEL - 1);
  });

  it("stays inside its own (type, level) ladder", () => {
    const only = (type: string, level: string) =>
      type === "CROSSWORD" && level === "A2" ? deep() : [];
    const n = freeNeighbours("es", "CROSSWORD", "A2", 3, only as never);
    expect(n.prev?.href).toBe("/es/word-games/CROSSWORD/A2/2");
    expect(n.next?.href).toBe("/es/word-games/CROSSWORD/A2/4");
    expect(freeNeighbours("es", "WORD_SEARCH", "A2", 3, only as never)).toEqual({ prev: null, next: null });
  });

  it("jumps a gap rather than linking a rung the bank does not hold", () => {
    const gapped = (_type: string, level: string) => (level === "B2" ? [1, 2, 5, 9] : deep());
    const n = freeNeighbours("es", "CROSSWORD", "B2", 2, gapped as never);
    expect(n.next?.sequence).toBe(5);
  });

  it("says nothing for a puzzle that is not free itself", () => {
    expect(freeNeighbours("es", "CROSSWORD", "C1", 3, deep)).toEqual({ prev: null, next: null });
    expect(freeNeighbours("es", "CROSSWORD", "B1", 11, deep)).toEqual({ prev: null, next: null });
  });

  /**
   * Positive control: the obvious wrong implementation — sequence +/- 1,
   * with no ladder and no free rule — must be visibly different on the
   * same input, otherwise the assertions above pass on anything.
   */
  it("control: sequence +/- 1 really does produce different output", () => {
    const naive = (sequence: number) => ({ prev: sequence - 1, next: sequence + 1 });
    const top = WORD_GAME_FREE_RUNGS_PER_LEVEL;
    expect(naive(top).next).toBe(top + 1);
    expect(freeNeighbours("es", "CROSSWORD", "B1", top, deep).next).toBeNull();
    const gapped = (_type: string, level: string) => (level === "B2" ? [1, 2, 5, 9] : deep());
    expect(naive(2).next).toBe(3);
    expect(freeNeighbours("es", "CROSSWORD", "B2", 2, gapped as never).next?.sequence).toBe(5);
  });
});
