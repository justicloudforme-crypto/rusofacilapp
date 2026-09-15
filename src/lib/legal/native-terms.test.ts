import { describe, expect, it } from "vitest";
import { TERMS_CONTENT, PRIVACY_CONTENT, visibleLegalParagraphs, type LegalDocument } from "./content";
import { locales } from "@/i18n/config";

/**
 * ДОЛГ 196 — СПОСОБЫ ОПЛАТЫ ЖИВУТ НА САЙТЕ И НЕ ЖИВУТ В ПРИЛОЖЕНИИ.
 *
 * Решение владельца 15.09.2026: MXN и OXXO из условий НЕ удалять. На
 * сайте текст остаётся полным и правдивым — там есть и Stripe, и
 * продажи. Внутри оболочки раздел про способы оплаты не показывать.
 *
 * Обе стороны обязаны краснеть по отдельности, и это не формальность:
 * «убрали из приложения» и «не тронули веб» — два разных утверждения, и
 * первая редакция такой правки ломает обычно именно второе.
 */

const PAYMENT_WORDS = ["OXXO", "MXN"];

function textOf(doc: LegalDocument, nativeShell: boolean): string {
  return doc.sections.flatMap((s) => visibleLegalParagraphs(s, { nativeShell })).join("\n");
}

describe("условия использования внутри приложения", () => {
  for (const locale of locales) {
    it(`/${locale}/terms: в оболочке ни OXXO, ни MXN`, () => {
      const native = textOf(TERMS_CONTENT[locale], true);
      for (const word of PAYMENT_WORDS) expect(native).not.toContain(word);
      // Убран РАЗДЕЛ про способы оплаты, а не документ: условия о
      // продлении, отмене и изменении цены обязаны остаться на месте.
      expect(native).toContain("Stripe");
      expect(native.length).toBeGreaterThan(2000);
    });

    it(`/${locale}/terms: на сайте текст полный`, () => {
      const web = textOf(TERMS_CONTENT[locale], false);
      for (const word of PAYMENT_WORDS) expect(web).toContain(word);
      // И он длиннее нативного ровно на спрятанные абзацы, а не на что-то ещё.
      expect(web.length).toBeGreaterThan(textOf(TERMS_CONTENT[locale], true).length);
    });

    it(`/${locale}/terms: спрятано ровно два абзаца и оба про оплату`, () => {
      const hidden = TERMS_CONTENT[locale].sections
        .flatMap((s) => s.paragraphs)
        .filter((p): p is { text: string; webOnly: true } => typeof p !== "string");
      expect(hidden).toHaveLength(2);
      for (const p of hidden) expect(p.text).toMatch(/OXXO|MXN/);
    });

    it(`/${locale}/privacy не тронута вовсе`, () => {
      expect(textOf(PRIVACY_CONTENT[locale], true)).toBe(textOf(PRIVACY_CONTENT[locale], false));
    });
  }

  // ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ: поведение ДО правки — абзацы не помечены —
  // обязано быть поймано этой же проверкой.
  it("подсадка «пометки сняты» ловится: в оболочке снова OXXO и MXN", () => {
    const beforeFix: LegalDocument = {
      ...TERMS_CONTENT.es,
      sections: TERMS_CONTENT.es.sections.map((s) => ({
        ...s,
        paragraphs: s.paragraphs.map((p) => (typeof p === "string" ? p : p.text)),
      })),
    };
    const native = textOf(beforeFix, true);
    for (const word of PAYMENT_WORDS) expect(native).toContain(word);
  });

  // ВТОРАЯ ПОДСАДКА, В ДРУГУЮ СТОРОНУ: пометить абзац, который обязан
  // остаться у ВСЕХ, — и веб перестанет быть полным.
  it("подсадка «спрятали лишнее» ловится: на сайте пропал бы Stripe", () => {
    const overzealous: LegalDocument = {
      ...TERMS_CONTENT.es,
      sections: TERMS_CONTENT.es.sections.map((s) => ({
        ...s,
        paragraphs: s.paragraphs.map((p) =>
          typeof p === "string" && p.includes("Stripe") ? ({ text: p, webOnly: true } as const) : p,
        ),
      })),
    };
    expect(textOf(overzealous, true)).not.toContain("Stripe");
    // А веб при этом обязан остаться полным — и остаётся: правило про
    // оболочку, а не про документ.
    expect(textOf(overzealous, false)).toContain("Stripe");
  });
});
