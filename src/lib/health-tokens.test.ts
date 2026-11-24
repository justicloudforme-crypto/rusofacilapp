import { describe, expect, it } from "vitest";
import { HEALTH_DOWN_TOKEN, HEALTH_OK_TOKEN, isOwnHealthAnswer } from "./health-tokens";

// Долг 278 (7.304): «сервер ответил» ≠ «база жива». Проба воркера
// судит о СЕТИ, поэтому 503 `RF-DOWN` — тоже ответ своего сервера.
describe("isOwnHealthAnswer", () => {
  it("свой живой ответ и свой «база лежит» — оба ответ сервера", () => {
    expect(isOwnHealthAnswer(JSON.stringify({ status: HEALTH_OK_TOKEN, ok: true }))).toBe(true);
    expect(isOwnHealthAnswer(JSON.stringify({ status: HEALTH_DOWN_TOKEN, ok: false, db: "down" }))).toBe(true);
  });

  it("чужая страница, пустое тело и голое слово без кавычек — не ответ сервера", () => {
    expect(isOwnHealthAnswer("<html><title>Wi-Fi login</title></html>")).toBe(false);
    expect(isOwnHealthAnswer("")).toBe(false);
    expect(isOwnHealthAnswer("Bad gateway RF-DOWNTIME")).toBe(false);
  });
});
