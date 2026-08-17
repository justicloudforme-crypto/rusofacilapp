import { describe, expect, it } from "vitest";
import { getNextLevel, shouldSuggestNextLevel } from "./level-progress";

describe("getNextLevel", () => {
  it("steps through the CEFR order", () => {
    expect(getNextLevel("A1")).toBe("A2");
    expect(getNextLevel("A2")).toBe("B1");
    expect(getNextLevel("B1")).toBe("B2");
    expect(getNextLevel("B2")).toBe("C1");
  });

  it("returns null at the top of the scale", () => {
    expect(getNextLevel("C1")).toBeNull();
  });
});

describe("shouldSuggestNextLevel", () => {
  it("suggests moving on once known/total crosses the threshold", () => {
    expect(shouldSuggestNextLevel("A1", 80, 100)).toBe(true);
    expect(shouldSuggestNextLevel("A1", 79, 100)).toBe(false);
  });

  it("never suggests when no specific level is selected", () => {
    expect(shouldSuggestNextLevel("all", 100, 100)).toBe(false);
  });

  it("never suggests past the top level, however high the mastery", () => {
    expect(shouldSuggestNextLevel("C1", 100, 100)).toBe(false);
  });

  it("does not divide by zero for a category with no cards at this level", () => {
    expect(shouldSuggestNextLevel("A1", 0, 0)).toBe(false);
  });
});
