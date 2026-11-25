import { test, expect } from "./helpers/test";
import { SITE_URL } from "../src/lib/site";

/**
 * СТОРОЖ ОТЧЁТА SEARCH CONSOLE «Duplicate without user-selected canonical»
 * (заход 7.309, 25.11.2026).
 *
 * В отчёте 116 адресов трёх видов: `/stories` без языка, `/es/pricing?next=…`
 * с параметром и копии на `www.` (старые обходы августа). Замер живого сайта
 * 25.11.2026 — всё три уже отвечают правильно, правки сайта не было:
 *
 *   - `/es/pricing?next=…` — 200, `rel=canonical` = `/es/pricing` без
 *     параметра (`routeAlternates(lang, "/pricing")`, страница цен);
 *   - `/stories` — 307 на `/es/stories` (у краулера нет куки и языка
 *     устройства). Редирект ВРЕМЕННЫЙ нарочно: цель зависит от человека —
 *     кука `rf-lang` → язык устройства → испанский (правило 265,
 *     `src/lib/locale-decision.ts`). Постоянный 301/308 браузер запомнил бы
 *     навсегда, и выбравший русский снова попадал бы на `/es`;
 *   - `www.…` — 308 на апекс с тем же путём и параметрами (7.112,
 *     `src/lib/canonical-host.ts`).
 *
 * Статический сторож `src/lib/route-metadata.test.ts` проверяет, что каждая
 * страница ЗОВЁТ `routeAlternates` со своим путём. Этот файл проверяет то,
 * что видит Google: код ответа, `Location` и `rel=canonical` в отданном
 * HTML. Потеряй страница цен canonical, начни он нести `?next=`, стань
 * редирект `/stories` постоянным или перестань `www` сводиться к апексу —
 * здесь красное.
 */

/** Только `<link rel="canonical">` из отданного HTML; регистр атрибутов любой (раздел 4.2). */
function canonicalOf(html: string): string[] {
  const out: string[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/\brel\s*=\s*["']canonical["']/i.test(tag)) continue;
    const href = /\bhref\s*=\s*["']([^"']*)["']/i.exec(tag);
    out.push(href ? href[1] : "");
  }
  return out;
}

// Запросы без браузера: оба проекта Playwright проверяют одно и то же
// (≈2 с), пропуск ради экономии запрещён `check:e2e-coverage` (7.52).

test.describe("дубли без canonical (GSC)", () => {
  for (const path of [
    "/es/pricing",
    "/es/pricing?next=%2Fes%2Fstories",
    "/es/pricing?next=/es/lessons/a1&highlight=premium",
  ]) {
    test(`${path} — 200 и canonical без параметров`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(200);
      const canonical = canonicalOf(await res.text());
      // Ровно один: два разных canonical Google считает «не выбранным».
      expect(canonical).toEqual([`${SITE_URL}/es/pricing`]);
    });
  }

  test("/es/stories — 200 и canonical на себя", async ({ request }) => {
    const res = await request.get("/es/stories", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(canonicalOf(await res.text())).toEqual([`${SITE_URL}/es/stories`]);
  });

  test("/stories без куки и языка — временный 307 на /es/stories", async ({ request }) => {
    const res = await request.get("/stories", {
      maxRedirects: 0,
      headers: { "accept-language": "", cookie: "" },
    });
    expect(res.status()).toBe(307);
    expect(new URL(res.headers()["location"], SITE_URL).pathname).toBe("/es/stories");
  });

  // Контроль: ПОЧЕМУ редирект временный. С запомненным русским тот же адрес
  // ведёт на /ru — постоянный редирект на /es это бы сломал.
  test("/stories с запомненным русским — 307 на /ru/stories", async ({ request }) => {
    const res = await request.get("/stories", {
      maxRedirects: 0,
      headers: { "accept-language": "es-MX,es;q=0.9", cookie: "rf-lang=ru" },
    });
    expect(res.status()).toBe(307);
    expect(new URL(res.headers()["location"], SITE_URL).pathname).toBe("/ru/stories");
  });

  for (const path of ["/stories", "/es/pricing?next=%2Fes%2Fstories"]) {
    test(`www${path} — 308 на апекс с тем же путём`, async ({ request }) => {
      const res = await request.get(path, {
        maxRedirects: 0,
        headers: { host: "www.rusofacilapp.com" },
      });
      expect(res.status()).toBe(308);
      expect(res.headers()["location"]).toBe(`${SITE_URL}${path}`);
    });
  }
});
