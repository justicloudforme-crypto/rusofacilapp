import { test, expect } from "./helpers/test";
import { settleGeometry } from "./helpers/geometry";
import { expectPageIsItself } from "./helpers/page-identity";

/**
 * Два долга одного захода (7.284), оба — «сколько места на экране
 * достаётся пальцу и ученику», и ни один сторож до этого их не мерил.
 *
 * ДОЛГ 178 — каталог рассказов на телефоне. Замер 15.11.2026 до правки,
 * 360×640: шапка 65 + липкий блок фильтров 228 CSS-пикселей = 46 %
 * экрана; целиком видна 1 карточка (высота 276). После правки: блок — одна
 * кнопка «Filtros» (60), 20 % экрана, карточка 202, целиком видно 2.
 * Здесь заперты три числа: липкий блок в свёрнутом виде не выше 80 px,
 * вместе с шапкой — не больше 25 % высоты, и под ним целиком помещаются
 * хотя бы две карточки. Плюс поведение: кнопка раскрывает ряды, выбор
 * уровня сворачивает их обратно и фильтрует список.
 *
 * ДОЛГ 81 — цели шапки на планшете. До правки на 768 и 1024 «Cursos»
 * 39,4×20, «Precios» 42,5×20, звук 36×36, язык 36×36. Правило проекта
 * (`CLAUDE.md`): любая цель для пальца — не меньше 44×44. Здесь каждая
 * видимая ссылка и кнопка шапки на 768 и 1024 меряется по обеим осям,
 * обе локали. Полоса 640–767 сюда намеренно не входит: её бюджет ширины
 * разобран в `Navbar.tsx` (долги 55, 56) и правкой не тронут. И ещё одно
 * число — документ на 768 не шире экрана при корневом кегле 20 px
 * (долг 63: до правки 773 против 768, оба движка).
 */

const PHONES = [
  { width: 360, height: 640 },
  { width: 375, height: 667 },
];

for (const vp of PHONES) {
  test(`каталог рассказов на ${vp.width}×${vp.height}: фильтры не съедают экран (долг 178)`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto("/es/stories");
    await settleGeometry(page);
    await expectPageIsItself(page, "/es/stories");

    const toggle = page.getByTestId("story-filters-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Ряды свёрнуты, но в DOM — сторож знаков читает полосу уровней.
    await expect(page.getByTestId("story-level-filter")).toBeHidden();
    expect(await page.locator("[data-testid=story-level-filter] button").count()).toBeGreaterThanOrEqual(6);

    const m = await page.evaluate(async () => {
      const header = document.querySelector("header")!.getBoundingClientRect();
      const panel = document.querySelector("[data-testid=story-filters]")!;
      const first = document.querySelector("[data-testid=story-card]")!;
      // Прокрутить так, чтобы липкий блок прижался под шапкой, а первая
      // карточка встала сразу под ним — так ученик листает список.
      const target = first.getBoundingClientRect().top + window.scrollY - header.height - panel.getBoundingClientRect().height - 8;
      window.scrollTo(0, target);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const p = panel.getBoundingClientRect();
      const cards = [...document.querySelectorAll("[data-testid=story-card]")].map((c) => c.getBoundingClientRect());
      return {
        panelH: p.height,
        pinnedBottom: p.bottom,
        vh: window.innerHeight,
        fullCards: cards.filter((c) => c.top >= p.bottom - 1 && c.bottom <= window.innerHeight + 1).length,
      };
    });
    expect(m.panelH, "свёрнутый липкий блок фильтров").toBeLessThanOrEqual(80);
    expect(m.pinnedBottom / m.vh, "доля экрана под шапкой и фильтрами").toBeLessThanOrEqual(0.25);
    expect(m.fullCards, "карточек целиком под липким блоком").toBeGreaterThanOrEqual(2);

    // Поведение: раскрыть → выбрать уровень → ряды свернулись, список отфильтрован.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("story-level-filter")).toBeVisible();
    await page.locator("[data-testid=story-level-filter] button[data-level=A1]").click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toContainText("1");
    await expect(page.getByTestId("story-level-filter")).toBeHidden();
  });
}

for (const width of [768, 1024]) {
  for (const lang of ["es", "ru"] as const) {
    test(`шапка на ${width} (${lang}): каждая цель не меньше 44×44 (долг 81)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${lang}/stories`);
      await settleGeometry(page);
      await expectPageIsItself(page, `/${lang}/stories`);
      const targets = await page.evaluate(() =>
        [...document.querySelectorAll("header a, header button")]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ el, r }) => r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden")
          .map(({ el, r }) => ({
            name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24),
            w: Math.round(r.width * 10) / 10,
            h: Math.round(r.height * 10) / 10,
          })),
      );
      // Позитивная половина: шапка вообще измерена (логотип, три ссылки,
      // поиск, звук, язык, кнопка входа — восемь у гостя).
      expect(targets.length).toBeGreaterThanOrEqual(7);
      const small = targets.filter((t) => t.w < 44 || t.h < 44);
      expect(small, `меньше 44×44: ${JSON.stringify(small)}`).toEqual([]);
    });
  }
}

test("шапка на 768 при корневом кегле 20 px не шире экрана (долг 63)", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/es");
  await expectPageIsItself(page, "/es");
  await page.addStyleTag({ content: "html{font-size:20px !important}" });
  await settleGeometry(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
