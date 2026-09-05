import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { TERMS_CONTENT } from "./legal/content";
import { locales } from "@/i18n/config";

/**
 * Nothing may promise cash to a reader who cannot pay in cash, and the
 * Terms must say what is actually being sold.
 *
 * This closes debt 43 of PROGRESS.md 7.117 and the terms gap named beside
 * it. On 07.09.2026 the OXXO voucher stopped being offered outside Mexico
 * — the tab, the instructions, the caption, the FAQ entry and the front
 * page tile all became conditional on `x-vercel-ip-country` — and two
 * places were knowingly left behind:
 *
 *  1. `generateMetadata` for /pricing, whose description ended "Tarjeta o
 *     efectivo OXXO." in both locales. It goes to a search engine rather
 *     than to a buyer, and a description is written once per locale and
 *     cached, so it CANNOT be made country-aware the way the page body is.
 *     The only honest fix is a sentence that is true everywhere. That is
 *     what this file checks: the snippet may mention OXXO, but only with
 *     the words that bound it to Mexico.
 *  2. The Terms, which described a monthly/annual subscription world and
 *     said nothing about cash, nothing about Premium being a one-time
 *     payment, and nothing about the currency actually charged.
 *
 * Checked against the SOURCE of generateMetadata rather than a rendered
 * page, deliberately: metadata is not in the body text an e2e run reads,
 * and this is a claim about what is written, not about what is painted.
 */

function pricingPageSource(): string {
  return readFileSync(path.join(process.cwd(), "src", "app", "[lang]", "pricing", "page.tsx"), "utf8");
}

/** The two description literals inside generateMetadata — the ru one and
 * the es one, pulled out by the marker each ends with. */
function metadataDescriptions(source: string): string[] {
  const block = source.slice(source.indexOf("description:"), source.indexOf("alternates:"));
  return [...block.matchAll(/"([^"]{60,})"/g)].map((m) => m[1]);
}

describe("the search snippet for /pricing", () => {
  it("reads two real descriptions — an empty scan would pass everything below", () => {
    const found = metadataDescriptions(pricingPageSource());
    expect(found).toHaveLength(2);
    for (const text of found) expect(text).toContain("RusoFácilapp");
  });

  it("never promises cash without saying where cash works", () => {
    for (const text of metadataDescriptions(pricingPageSource())) {
      if (!/OXXO/.test(text)) continue;
      // The word that has to be in the same sentence. Without it the
      // snippet is the pre-08.09.2026 one, which promised a Mexican corner
      // shop to a reader in Madrid.
      expect(text).toMatch(/México|Мексик/);
    }
  });

  it("still promises the card, which works everywhere", () => {
    for (const text of metadataDescriptions(pricingPageSource())) {
      expect(text).toMatch(/tarjeta|картой/i);
    }
  });

  /** PROGRESS.md 4.1: a detector that finds nothing is indistinguishable
   * from a clean page until you hand it the thing it is meant to find. */
  describe("positive control", () => {
    it("catches the exact sentence this replaced", () => {
      const planted = 'description: lang === "ru" ? "Тарифы RusoFácilapp: доступ к курсу A1–B2. Карта или наличные в OXXO." : "Planes de RusoFácilapp: mensual, anual o de por vida. Tarjeta o efectivo OXXO." , alternates:';
      const offenders = metadataDescriptions(planted).filter((t) => /OXXO/.test(t) && !/México|Мексик/.test(t));
      expect(offenders).toHaveLength(2);
    });
  });
});

describe("what section 3 of the Terms has to state, in both locales", () => {
  /** Section 3 is "Suscripciones y pagos" / "Подписки и оплата" — found by
   * its number, not by its index, so reordering the document cannot make
   * this test quietly read the wrong section. */
  function paymentSection(locale: (typeof locales)[number]): string {
    const section = TERMS_CONTENT[locale].sections.find((s) => s.heading.startsWith("3."));
    expect(section, `no section 3 in ${locale} terms`).toBeTruthy();
    return section!.paragraphs.join("\n");
  }

  it.each(locales)("%s: cash is named, and bounded to Mexico", (locale) => {
    const text = paymentSection(locale);
    expect(text).toContain("OXXO");
    expect(text).toMatch(/México|Мексик/);
    // The voucher's own deadline is a term, not a detail: an unpaid one
    // expires and the buyer is charged nothing.
    expect(text).toMatch(/3 (días|дня)/);
  });

  it.each(locales)("%s: Premium is stated to be a one-time payment, not a subscription", (locale) => {
    const text = paymentSection(locale);
    expect(text).toMatch(/Premium/);
    expect(text).toMatch(/pago único|разовый платёж/);
    // And the consequence a reader needs: there is nothing to cancel.
    expect(text).toMatch(/no se renueva|не продлевается/i);
  });

  it.each(locales)("%s: the currency actually charged is named", (locale) => {
    const text = paymentSection(locale);
    expect(text).toContain("MXN");
    expect(text).toMatch(/aproximad|приблизительн/);
  });

  it("carries its own date, separate from the Privacy Policy's", () => {
    // The Terms changed on 08.09.2026 and the Privacy Policy did not. One
    // shared constant would have back-dated this change or falsely
    // re-dated that document.
    for (const locale of locales) {
      expect(TERMS_CONTENT[locale].lastUpdated).toBe("2026-09-08");
    }
  });

  describe("positive control", () => {
    it("catches a section 3 that says none of it", () => {
      const before = [
        "Ofrecemos planes de suscripción mensual y anual. Los pagos se procesan a través de Stripe.",
        "Las suscripciones se renuevan automáticamente al final de cada periodo.",
      ].join("\n");
      expect(before).not.toContain("OXXO");
      expect(before).not.toMatch(/pago único/);
      expect(before).not.toContain("MXN");
    });
  });
});
