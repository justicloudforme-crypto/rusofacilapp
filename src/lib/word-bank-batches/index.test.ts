import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import lessons from "@/lib/lessons/content.json";
import { bankKey } from "@/lib/translation-normalize";
import { WORD_BANK_BATCHES, batchKeyCount, lookupBatchKey } from "./index";

/**
 * ПЕРЕВОДЫ ПАРТИЙ НЕ ВЫДУМАНЫ — сторож долга 171 (заход 7.312).
 *
 * Правило владельца: в банк идёт только перевод, который уже есть в
 * проекте и проверен. Для партий это значит одно: у каждой строки в
 * `from` назван урок, в словаре (`vocabulary`) которого ТА ЖЕ словоформа
 * стоит отдельной строкой, и перевод партии равен переводу урока знак в
 * знак (несколько уроков — склейка через «; » в том же порядке). Любая
 * «поправка от себя» роняет этот тест.
 */
type Vocab = { word: string; translation: string };
const LESSONS = lessons as unknown as Record<string, { vocabulary?: Vocab[] }>;

function lessonTranslation(slug: string, word: string): string | null {
  const row = (LESSONS[slug]?.vocabulary ?? []).find((v) => v.word.trim().toLowerCase() === word);
  return row ? row.translation : null;
}

describe("партии своего банка переводов (долг 171)", () => {
  const all = WORD_BANK_BATCHES.flatMap((b) => b.entries);

  it("каждая партия небольшая — не больше 150 слов (решение владельца 7.312)", () => {
    for (const batch of WORD_BANK_BATCHES) expect(batch.entries.length).toBeLessThanOrEqual(150);
    expect(all.length).toBeGreaterThan(0);
  });

  it("ключ — одна русская словоформа в записи bankKey, без повторов", () => {
    const seen = new Set<string>();
    for (const entry of all) {
      expect(bankKey(entry.word), entry.word).toBe(entry.word);
      expect(seen.has(entry.word), `повтор ${entry.word}`).toBe(false);
      seen.add(entry.word);
    }
    expect(batchKeyCount()).toBe(all.length);
  });

  it("перевод равен словарю названного урока знак в знак", () => {
    const bad: string[] = [];
    for (const entry of all) {
      expect(entry.from.length, entry.word).toBeGreaterThan(0);
      const parts = entry.from.map((slug) => lessonTranslation(slug, entry.word));
      if (parts.some((p) => p === null)) {
        bad.push(`${entry.word}: в ${entry.from.join(", ")} такой строки словаря нет`);
        continue;
      }
      const expected = parts.join("; ");
      if (entry.translation !== expected) bad.push(`${entry.word}: «${entry.translation}» ≠ урок «${expected}»`);
    }
    expect(bad).toEqual([]);
  });

  it("отклонённые слова (узкий перевод урока) в партии не попали", () => {
    const keys = new Set(all.map((e) => e.word));
    for (const batch of WORD_BANK_BATCHES) {
      for (const r of batch.rejected) {
        expect(keys.has(r.word), r.word).toBe(false);
        expect(r.reason.length).toBeGreaterThan(10);
      }
    }
  });

  it("поиск по ключу: слово партии находится, чужое — нет (позитивный и отрицательный контроль)", () => {
    expect(lookupBatchKey("ему")).toBe("a él");
    expect(lookupBatchKey("хорошо")).toBe("bien");
    expect(lookupBatchKey("стоит")).toBeNull();
    expect(lookupBatchKey("показывает")).toBeNull();
  });

  it("слово-проба «Прода после выката» (scripts/prod-smoke.mjs) есть в партии", () => {
    const smoke = readFileSync("scripts/prod-smoke.mjs", "utf-8");
    const probe = /const WORD_BANK_PROBE = "([^"]+)"/.exec(smoke)?.[1];
    expect(probe, "проба в prod-smoke.mjs не найдена").toBeTruthy();
    expect(lookupBatchKey(probe as string)).not.toBeNull();
  });
});
