import { describe, expect, it } from "vitest";
import { freeLadders, freeRungPaths } from "./free-index";
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
