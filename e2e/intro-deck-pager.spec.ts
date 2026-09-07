import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";

/**
 * Переключатель слайдов вводной деки: он должен быть ОДНОЙ СТРОКОЙ и его
 * элементы должны быть не меньше 44×44 — при любом системном кегле.
 *
 * ЧТО ЭТА СПЕКА МЕРЯЕТ ТАКОГО, ЧЕГО НЕ МЕРЯЕТ `intro-deck-layout.spec.ts`.
 * Та проверяет, что карточка слайда ничего не срезает и что элементы деки
 * не меньше 44×44 — и на прежней вёрстке была ЗЕЛЁНОЙ, потому что перенос
 * полосы точек не является ни обрезкой, ни маленькой кнопкой. Полоса
 * переносилась намеренно (`max-w-[224px]` → 5 + 5), и именно эта
 * намеренность оказалась дефектом.
 *
 * Жалоба владельца была «десять точек ломаются в три ряда 4 + 4 + 2».
 * Замер на живом проде 07.09.2026 при корневом кегле 16 px даёт 5 + 5 —
 * то есть по умолчанию она НЕ воспроизводится. Воспроизводится она ровно
 * тогда, когда у человека увеличен системный шрифт: кнопка задана в rem
 * (`h-11` = 2.75rem), а потолок полосы был задан в ПИКСЕЛЯХ (224), и при
 * корневом кегле 18–20 px в 224 px влезает четыре кнопки вместо пяти —
 * 4 + 4 + 2, ровно как в жалобе (12 из 12 конфигураций, оба движка). При
 * 24 px становится 3 + 3 + 3 + 1.
 *
 * Поэтому ширины здесь перемножены на КЕГЛИ: набор без кегля 20 пропустил
 * бы ровно тот отказ, ради которого спека написана.
 *
 * Чего здесь НЕТ намеренно: утверждения «документ не шире вьюпорта».
 * При 768 px и кегле 20 на `/es` документ шире вьюпорта на 5 px, и это
 * РАМА ШАПКИ (`ml-auto flex items-center gap-1 sm:gap-2`), а не дека:
 * тот же самый перебор даёт те же 773 px на живом проде, где этой правки
 * нет. Оно записано отдельным долгом; накрывать чужой дефект утверждением
 * этой спеки — значит сделать её красной по причине, которую она не
 * чинит.
 */
const WIDTHS = [320, 360, 390, 768] as const;
const ROOT_SIZES = [16, 20] as const;
const MIN_TAP = 44;

/** Раскладка полосы точек и размеры всего, во что можно ткнуть. */
async function pager(page: Page) {
  return page.evaluate(() => {
    const deck = document.querySelector('[data-testid="intro-presentation"]');
    if (!deck) throw new Error('no [data-testid="intro-presentation"]');
    const dots = [...deck.querySelectorAll('[data-testid="intro-dot"]')];
    // Полоса ищется по своему хуку, а если его нет — по общему родителю
    // точек. Это не удобство: без запасного пути спека на прежней вёрстке
    // краснела бы «нет такого элемента», то есть позитивный контроль
    // доказывал бы только отсутствие атрибута, а не геометрию. С запасным
    // путём она на прежней вёрстке краснеет ровно тем, чем должна, —
    // «точки легли в 2 ряда» (или в 3 при увеличенном кегле).
    const strip = deck.querySelector('[data-testid="intro-dots"]') ?? dots[0]?.parentElement;
    if (!strip) throw new Error("no pager strip");
    const tops = dots.map((d) => Math.round(d.getBoundingClientRect().top));
    const rowsSet = [...new Set(tops)];
    const row = strip.parentElement as HTMLElement;
    const rowBox = row.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth;
    const controls = [...deck.querySelectorAll("a, button")].map((el) => {
      const b = el.getBoundingClientRect();
      return {
        name: `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}"`,
        w: Math.round(b.width * 10) / 10,
        h: Math.round(b.height * 10) / 10,
      };
    });
    return {
      dots: dots.length,
      rows: rowsSet.length,
      perRow: rowsSet.map((t) => tops.filter((x) => x === t).length),
      rowLeft: Math.round(rowBox.left * 10) / 10,
      rowRight: Math.round(rowBox.right * 10) / 10,
      viewport,
      small: controls.filter((c) => c.w > 0 && c.h > 0 && (c.w < 44 || c.h < 44)),
      current: dots.filter((d) => d.getAttribute("aria-current") === "true").length,
      counter: deck.querySelector('[data-testid="intro-counter"]')?.textContent?.trim() ?? null,
    };
  });
}

/** Настоящий свайп: React слушает нативные touch-события, а Playwright их
 *  сам не порождает — мышью такой жест не воспроизводится ни в одном
 *  движке (замерено: мышиное протягивание на исправленной деке НЕ листает,
 *  и это не дефект, а другой класс события). */
async function swipe(page: Page, dx: number) {
  await page.evaluate((delta) => {
    const card = document.querySelector('[data-testid="intro-slide-card"]');
    if (!card) throw new Error("no slide card");
    const b = card.getBoundingClientRect();
    const y = b.top + b.height / 2;
    const x0 = b.left + b.width / 2 - delta / 2;
    const fire = (type: string, x: number) => {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      const touch = { identifier: 1, target: card, clientX: x, clientY: y, pageX: x, pageY: y };
      const list = type === "touchend" ? [] : [touch];
      Object.defineProperty(ev, "touches", { value: list });
      Object.defineProperty(ev, "targetTouches", { value: list });
      Object.defineProperty(ev, "changedTouches", { value: [touch] });
      card.dispatchEvent(ev);
    };
    fire("touchstart", x0);
    fire("touchmove", x0 + delta / 2);
    fire("touchend", x0 + delta);
  }, dx);
  await page.waitForTimeout(200);
}

async function openDeck(page: Page, lang: string, width: number, root: number) {
  await page.setViewportSize({ width, height: 800 });
  await page.addInitScript(
    `document.addEventListener("DOMContentLoaded",()=>{document.documentElement.style.fontSize="${root}px";});`,
  );
  const response = await page.goto(`/${lang}/courses`);
  expect(response?.status()).toBe(200);
  await page.locator('[data-testid="intro-dot"]').first().waitFor();
}

for (const lang of ["es", "ru"] as const) {
  for (const width of WIDTHS) {
    for (const root of ROOT_SIZES) {
      test(`/${lang}/courses ${width}px, кегль ${root}px: полоса точек — одна строка, элементы ≥44×44`, async ({
        page,
      }) => {
        await openDeck(page, lang, width, root);
        const m = await pager(page);

        expect(m.dots).toBeGreaterThan(1);
        expect(m.rows, `точки легли в ${m.rows} ряда: ${m.perRow.join(" + ")}`).toBe(1);
        expect(m.perRow[0]).toBe(m.dots);

        // Ряд пейджера целиком в своей ширине: полоса ПРОКРУЧИВАЕТСЯ, и
        // прокрутка не должна утекать наружу.
        expect(m.rowLeft).toBeGreaterThanOrEqual(-0.5);
        expect(m.rowRight).toBeLessThanOrEqual(m.viewport + 0.5);

        expect(
          m.small,
          `меньше ${MIN_TAP}×${MIN_TAP}: ${m.small.map((t) => `${t.name} ${t.w}×${t.h}`).join("; ")}`,
        ).toEqual([]);
      });
    }
  }

  test(`/${lang}/courses: положение читается числом, aria-current один, ←/→ и свайп листают`, async ({ page }) => {
    await openDeck(page, lang, 390, 16);

    const dots = page.getByTestId("intro-dot");
    const total = await dots.count();
    const counter = page.getByTestId("intro-counter");

    await expect(counter).toHaveText(`1 / ${total}`);
    expect((await pager(page)).current, "ровно одна активная точка").toBe(1);

    // Прыжок на конкретный слайд остался возможен.
    await dots.nth(6).click();
    await expect(counter).toHaveText(`7 / ${total}`);
    await expect(dots.nth(6)).toHaveAttribute("aria-current", "true");

    // Клавиатура: до правки ←/→ не делали ничего (0 из 8 конфигураций).
    await page.keyboard.press("ArrowRight");
    await expect(counter).toHaveText(`8 / ${total}`);
    await page.keyboard.press("ArrowLeft");
    await expect(counter).toHaveText(`7 / ${total}`);

    // Свайп: до правки его не было вовсе.
    await swipe(page, -120);
    await expect(counter).toHaveText(`8 / ${total}`);
    await swipe(page, 120);
    await expect(counter).toHaveText(`7 / ${total}`);

    // Короткий жест — не листание, иначе обычная прокрутка страницы
    // пальцем через карточку меняла бы слайд.
    await swipe(page, -20);
    await expect(counter).toHaveText(`7 / ${total}`);
  });
}
