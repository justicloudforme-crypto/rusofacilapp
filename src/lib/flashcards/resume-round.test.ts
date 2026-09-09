import { describe, expect, it } from "vitest";
import { resumeRoundAt } from "./resume-round";

const card = (id: string) => ({ id });
const POOL = ["a", "b", "c", "d", "e"].map(card);

describe("resumeRoundAt", () => {
  it("карточка из круга встаёт первой, состав круга не меняется", () => {
    const round = [card("a"), card("b"), card("c")];
    const out = resumeRoundAt(round, POOL, "c");
    expect(out.map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("карточка не из круга, но из темы — первая, и круг НЕ вырос", () => {
    const round = [card("a"), card("b"), card("c")];
    const out = resumeRoundAt(round, POOL, "e");
    expect(out.map((c) => c.id)).toEqual(["e", "b", "c"]);
    expect(out).toHaveLength(round.length);
  });

  it("карточки нет нигде — круг возвращается как есть", () => {
    const round = [card("a"), card("b")];
    expect(resumeRoundAt(round, POOL, "zzz").map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("без места остановки ничего не переставляется", () => {
    const round = [card("a"), card("b")];
    expect(resumeRoundAt(round, POOL, null).map((c) => c.id)).toEqual(["a", "b"]);
    expect(resumeRoundAt(round, POOL, undefined).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("карточка уже первая — круг не трогается", () => {
    const round = [card("a"), card("b")];
    expect(resumeRoundAt(round, POOL, "a").map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("пустой круг остаётся пустым", () => {
    expect(resumeRoundAt([], POOL, "a")).toEqual([]);
  });
});
