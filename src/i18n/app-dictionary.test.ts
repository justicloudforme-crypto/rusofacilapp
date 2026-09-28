import { describe, expect, it } from "vitest";
import es from "../dictionaries/es.json";
import ru from "../dictionaries/ru.json";
import { withoutWebPaymentStrings } from "./app-dictionary";

/** Все строки словаря с путями — для сравнения формы. */
function strings(value: unknown, path = ""): Array<[string, string]> {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

describe("withoutWebPaymentStrings (долг 356)", () => {
  for (const [lang, dict] of [["es", es], ["ru", ru]] as const) {
    it(`${lang}: в копии нет «OXXO» и ссылки на скачивание, остальное то же`, () => {
      const before = JSON.stringify(dict);
      const out = withoutWebPaymentStrings(dict);
      const text = JSON.stringify(out);

      // Контроль: в исходном словаре есть что убирать — иначе проба слепа.
      expect((before.match(/OXXO/g) ?? []).length).toBeGreaterThan(0);
      expect(dict.footer.appLink).not.toBe("");

      expect(text).not.toMatch(/OXXO/);
      expect(text).not.toMatch(/Descargar la app|Скачать приложение/);
      expect(out.footer.appLink).toBe("");

      // Форма та же: те же ключи, пустыми стали только строки веб-оплаты.
      const a = strings(dict);
      const b = strings(out);
      expect(b.map(([p]) => p)).toEqual(a.map(([p]) => p));
      const changed = a.filter(([, v], i) => b[i][1] !== v).map(([p]) => p);
      expect(changed.every((p) => p === "footer.appLink" || /OXXO/.test(a.find(([q]) => q === p)![1]))).toBe(true);
      expect(out.nav.home).toBe(dict.nav.home);
      // Идентификатор вопроса — не текст: ключи списка не поедут.
      expect(out.pricing.faq.map((f) => f.id)).toEqual(dict.pricing.faq.map((f) => f.id));

      // Исходный словарь — общий объект модуля — не тронут.
      expect(JSON.stringify(dict)).toBe(before);
    });
  }
});
