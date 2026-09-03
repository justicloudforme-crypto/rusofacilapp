import { describe, expect, it } from "vitest";
import { isExpectedServiceWorkerFailure } from "./sw-registration-failure";

describe("isExpectedServiceWorkerFailure", () => {
  it("боевой случай 01.09.2026 — Safari, приватное окно — ожидаем", () => {
    const error = { name: "SecurityError", message: "Script https://rusofacilapp.com/sw.js load failed" };
    expect(isExpectedServiceWorkerFailure(error)).toBe(true);
  });

  it.each([
    ["NotSupportedError", "The operation is not supported."],
    ["AbortError", "Registration failed - the user aborted"],
    ["TypeError", "Failed to register a ServiceWorker: An unknown error occurred"],
    ["TypeError", "Failed to fetch"],
    ["TypeError", "Load failed"],
  ])("«%s: %s» — ожидаемый отказ, в Sentry не уходит", (name, message) => {
    expect(isExpectedServiceWorkerFailure({ name, message })).toBe(true);
  });

  it.each([
    ["TypeError", "undefined is not an object (evaluating 'e.waiting')"],
    ["SyntaxError", "Unexpected token '<'"],
    ["Error", "что-то своё сломалось"],
  ])("«%s: %s» — НЕ ожидаемый, обязан уйти в Sentry", (name, message) => {
    expect(isExpectedServiceWorkerFailure({ name, message })).toBe(false);
  });

  it("не падает на не-объектах", () => {
    expect(isExpectedServiceWorkerFailure(null)).toBe(false);
    expect(isExpectedServiceWorkerFailure(undefined)).toBe(false);
    expect(isExpectedServiceWorkerFailure("Load failed")).toBe(true);
    expect(isExpectedServiceWorkerFailure(42)).toBe(false);
  });
});
