import { describe, expect, it } from "vitest";
import { isCancelledByLeaving } from "./report-boundary-error";

const alive = { unloading: false, hidden: false };
const leaving = { unloading: true, hidden: false };
const hidden = { unloading: false, hidden: true };

describe("isCancelledByLeaving", () => {
  it("настоящий отказ сети на живой странице ОСТАЁТСЯ видимым", () => {
    expect(isCancelledByLeaving(new TypeError("Load failed"), alive)).toBe(false);
    expect(isCancelledByLeaving(new TypeError("Failed to fetch"), alive)).toBe(false);
  });

  it("тот же отказ на уходящей странице — шум", () => {
    expect(isCancelledByLeaving(new TypeError("Load failed"), leaving)).toBe(true);
    expect(isCancelledByLeaving(new TypeError("Load failed"), hidden)).toBe(true);
  });

  it("AbortError — шум в любом состоянии: он значит «отменили сами»", () => {
    const abort = Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
    expect(isCancelledByLeaving(abort, alive)).toBe(true);
  });

  it("не-сетевая ошибка не глушится даже при уходе со страницы", () => {
    expect(isCancelledByLeaving(new TypeError("undefined is not an object"), leaving)).toBe(false);
    expect(isCancelledByLeaving(new Error("Что-то своё сломалось"), hidden)).toBe(false);
  });

  it("серверная ошибка Next (digest) остаётся видимой", () => {
    const e = Object.assign(new Error("An error occurred in the Server Components render"), { digest: "123" });
    expect(isCancelledByLeaving(e, leaving)).toBe(false);
  });

  it("не падает на мусоре", () => {
    expect(isCancelledByLeaving(undefined, alive)).toBe(false);
    expect(isCancelledByLeaving("Load failed", alive)).toBe(false);
    expect(isCancelledByLeaving("Load failed", leaving)).toBe(true);
  });
});
