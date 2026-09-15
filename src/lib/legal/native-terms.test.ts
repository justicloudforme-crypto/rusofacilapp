import { describe, expect, it } from "vitest";
import {
  TERMS_CONTENT,
  PRIVACY_CONTENT,
  visibleLegalParagraphs,
  type LegalDocument,
  type LegalParagraph,
} from "./content";
import { locales } from "@/i18n/config";

/**
 * ДОЛГ 196 — СПОСОБЫ ОПЛАТЫ ЖИВУТ НА САЙТЕ И НЕ ЖИВУТ В ПРИЛОЖЕНИИ.
 *
 * Решение владельца 15.09.2026: MXN и OXXO из условий НЕ удалять. На
 * сайте текст остаётся полным и правдивым — там есть и Stripe, и
 * продажи. Внутри оболочки раздел про способы оплаты не показывать.
 *
 * ДОВЕДЕНО 16.09.2026 (заход 7.200): внутри оболочки не называется НИ ОДНА
 * платёжная система, а не только OXXO и MXN. Наблюдение владельца было
 * прямое — внутри приложения на `/ru/terms` и `/es/terms` читалось
 * «Платежи обрабатываются через Stripe…», то есть правило 7.199 закрывало
 * два слова из списка, а список был длиннее.
 *
 * ПОЧЕМУ ЭТО НЕ ПРОСТО «СПРЯТАТЬ ЕЩЁ ОДИН АБЗАЦ». Абзац про Stripe несёт
 * два факта, и второй человеку нужен на любой поверхности: карту мы не
 * храним, потому что её видит внешний обработчик. Спрятать абзац целиком
 * значило бы отнять этот факт у читателя внутри приложения. Поэтому
 * абзацы ходят ПАРОЙ — `webOnly` называет систему по имени, `nativeOnly`
 * говорит то же самое, не называя, — и обе стороны этой пары проверяются
 * здесь по отдельности.
 *
 * Обе стороны обязаны краснеть по отдельности, и это не формальность:
 * «убрали из приложения» и «не тронули веб» — два разных утверждения, и
 * первая редакция такой правки ломает обычно именно второе.
 */

/**
 * Имена платёжных систем и способов оплаты. Список curated и объяснимый, а
 * не «всё, что похоже»: сюда входит то, что читается как УКАЗАНИЕ, где
 * платить, — именно это Google и запрещает уводить наружу. «Tarjeta» и
 * «карта» здесь нет намеренно: это род платежа, а не система, и абзац
 * «данные карты мы не храним» обязан жить в приложении.
 */
const PAYMENT_NAMES = [
  "Stripe",
  "OXXO",
  "MXN",
  "PayPal",
  "Mercado Pago",
  "MercadoPago",
  "SPEI",
  "Klarna",
  "Conekta",
  "Apple Pay",
  "Google Pay",
  "Google Play Billing",
  "RevenueCat",
  "Visa",
  "Mastercard",
  "American Express",
];

function textOf(doc: LegalDocument, nativeShell: boolean): string {
  return doc.sections.flatMap((s) => visibleLegalParagraphs(s, { nativeShell })).join("\n");
}

function marked(doc: LegalDocument, mark: "webOnly" | "nativeOnly"): { text: string }[] {
  return doc.sections
    .flatMap((s) => s.paragraphs)
    .filter((p): p is Exclude<LegalParagraph, string> => typeof p !== "string")
    .filter((p) => mark in p);
}

describe("условия использования внутри приложения", () => {
  for (const locale of locales) {
    it(`/${locale}/terms: в оболочке не названа НИ ОДНА платёжная система`, () => {
      const native = textOf(TERMS_CONTENT[locale], true);
      for (const name of PAYMENT_NAMES) expect(native, `в оболочке названо «${name}»`).not.toContain(name);
      // Убран РАЗДЕЛ про способы оплаты, а не документ: условия о
      // продлении, отмене и изменении цены обязаны остаться на месте.
      expect(native.length).toBeGreaterThan(2000);
      expect(native).toMatch(/renueva|продлева/);
      expect(native).toMatch(/cancel|Отмен/);
    });

    it(`/${locale}/terms: факт «карту мы не храним» остаётся и в оболочке`, () => {
      // Вторая половина пары. Без неё «спрятали Stripe» превратилось бы в
      // «человек внутри приложения не знает, кто списывает деньги».
      const native = textOf(TERMS_CONTENT[locale], true);
      expect(native).toMatch(/nunca almacenamos los datos de tu tarjeta|данные вашей карты никогда не хранятся/);
      expect(native).toMatch(/proveedor de pagos externo|внешний платёжный провайдер/);
    });

    it(`/${locale}/terms: на сайте текст полный и системы названы по имени`, () => {
      const web = textOf(TERMS_CONTENT[locale], false);
      for (const word of ["OXXO", "MXN", "Stripe"]) expect(web).toContain(word);
      // И он длиннее нативного: спрятанного больше, чем подставленного.
      expect(web.length).toBeGreaterThan(textOf(TERMS_CONTENT[locale], true).length);
    });

    it(`/${locale}/terms: помечено ровно три абзаца «только веб» и один «только оболочка»`, () => {
      const web = marked(TERMS_CONTENT[locale], "webOnly");
      const native = marked(TERMS_CONTENT[locale], "nativeOnly");
      expect(web).toHaveLength(3);
      expect(native).toHaveLength(1);
      // Каждый спрятанный — про оплату, и это не совпадение: пометка
      // существует ради одного правила, а не как общий выключатель.
      for (const p of web) expect(p.text).toMatch(/OXXO|MXN|Stripe/);
      for (const p of native) expect(p.text).toMatch(/tarjeta|карты/);
    });

    it(`/${locale}/privacy не тронута правилом оболочки вовсе`, () => {
      expect(textOf(PRIVACY_CONTENT[locale], true)).toBe(textOf(PRIVACY_CONTENT[locale], false));
    });
  }

  // ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ: поведение ДО правки — абзацы не помечены —
  // обязано быть поймано этой же проверкой.
  it("подсадка «пометки сняты» ловится: в оболочке снова OXXO, MXN и Stripe", () => {
    const beforeFix: LegalDocument = {
      ...TERMS_CONTENT.es,
      sections: TERMS_CONTENT.es.sections.map((s) => ({
        ...s,
        paragraphs: s.paragraphs.map((p) => (typeof p === "string" ? p : p.text)),
      })),
    };
    const native = textOf(beforeFix, true);
    for (const word of ["OXXO", "MXN", "Stripe"]) expect(native).toContain(word);
  });

  // ПОДСАДКА РОВНО В СОСТОЯНИЕ 7.199: OXXO и MXN спрятаны, а Stripe нет.
  // Это и есть то, что владелец прочитал на экране телефона 16.09.2026, и
  // правило обязано краснеть именно на нём, а не только на «пометок нет».
  it("подсадка «спрятали только валюту и ваучер» ловится: Stripe остался виден в оболочке", () => {
    const asIn7199: LegalDocument = {
      ...TERMS_CONTENT.ru,
      sections: TERMS_CONTENT.ru.sections.map((s) => ({
        ...s,
        paragraphs: s.paragraphs.flatMap((p): LegalParagraph[] => {
          if (typeof p === "string") return [p];
          if ("nativeOnly" in p) return [];
          // Абзац про Stripe снова становится общим — как было до 7.200.
          return p.text.includes("Stripe") ? [p.text] : [p];
        }),
      })),
    };
    expect(textOf(asIn7199, true)).toContain("Stripe");
  });

  // ВТОРАЯ ПОДСАДКА, В ДРУГУЮ СТОРОНУ: спрятать абзац, не подставив
  // ничего, — и человек внутри приложения перестанет знать, что карту мы
  // не храним. Первая редакция такой правки ломает обычно именно это.
  it("подсадка «спрятали и ничего не дали взамен» ловится", () => {
    const overzealous: LegalDocument = {
      ...TERMS_CONTENT.es,
      sections: TERMS_CONTENT.es.sections.map((s) => ({
        ...s,
        paragraphs: s.paragraphs.filter((p) => typeof p === "string" || !("nativeOnly" in p)),
      })),
    };
    expect(textOf(overzealous, true)).not.toMatch(/nunca almacenamos los datos de tu tarjeta/);
    // А веб при этом остаётся полным: правило про оболочку, а не про документ.
    expect(textOf(overzealous, false)).toContain("Stripe");
  });

  // ТРЕТЬЯ ПОДСАДКА: новая платёжная система, вписанная в ОБЫЧНЫЙ абзац.
  // Именно так дефект и вернётся — не снятием пометки, а добавлением
  // строки, о пометке не знающей.
  it("подсадка «новое имя в обычном абзаце» ловится", () => {
    const withPayPal: LegalDocument = {
      ...TERMS_CONTENT.ru,
      sections: TERMS_CONTENT.ru.sections.map((s) => ({
        ...s,
        paragraphs: s.heading.startsWith("3.")
          ? [...s.paragraphs, "Также принимаем оплату через PayPal."]
          : s.paragraphs,
      })),
    };
    const native = textOf(withPayPal, true);
    expect(PAYMENT_NAMES.filter((n) => native.includes(n))).toEqual(["PayPal"]);
  });
});
