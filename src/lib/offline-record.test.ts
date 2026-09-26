import { describe, expect, it } from "vitest";
import { MAX_ACTION_AGE_MS, actionInstant, isForeignRecord, parseRecordKey } from "./offline-record";

const NOW = new Date("2026-09-27T12:00:00Z");

describe("поля записи очереди без сети (7.236)", () => {
  it("контроль: время действия из очереди принимается — вчерашний ответ ставит вчерашний день", () => {
    const yesterday = NOW.getTime() - 26 * 60 * 60 * 1000;
    expect(actionInstant(yesterday, true, NOW).getTime()).toBe(yesterday);
  });

  it("без ключа время действия игнорируется — обычная отправка ставит «сейчас»", () => {
    expect(actionInstant(NOW.getTime() - 60_000, false, NOW)).toBe(NOW);
  });

  it("часы телефона впереди и слишком старое действие — «сейчас»", () => {
    expect(actionInstant(NOW.getTime() + 60_000, true, NOW)).toBe(NOW);
    expect(actionInstant(NOW.getTime() - MAX_ACTION_AGE_MS - 1, true, NOW)).toBe(NOW);
    expect(actionInstant("вчера", true, NOW)).toBe(NOW);
    expect(actionInstant(Number.NaN, true, NOW)).toBe(NOW);
  });

  it("ключ: UUID принимается, мусор — нет", () => {
    expect(parseRecordKey("3f1c2b8e-9a47-4c1d-8f2e-5b6a7c8d9e0f")).toBe("3f1c2b8e-9a47-4c1d-8f2e-5b6a7c8d9e0f");
    expect(parseRecordKey("short")).toBeNull();
    expect(parseRecordKey("x'; DROP TABLE User; --aaaaaaaa")).toBeNull();
    expect(parseRecordKey(42)).toBeNull();
  });

  it("владелец: чужой — отказ, свой и не указанный (старый клиент) — принимается", () => {
    expect(isForeignRecord("aaaa", "bbbb")).toBe(true);
    expect(isForeignRecord("bbbb", "bbbb")).toBe(false);
    expect(isForeignRecord(undefined, "bbbb")).toBe(false);
  });
});
