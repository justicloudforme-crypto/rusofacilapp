import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";
import { SETTLE_MAX_MS, settleGeometry } from "./helpers/geometry";

/**
 * Сторож полосы 640–767: **ряд шапки не выезжает за свою контентную
 * коробку**.
 *
 * Что он сравнивает и почему именно это. Правило сличает правый край
 * самого правого ребёнка ряда с правым краем КОНТЕНТНОЙ коробки того же
 * контейнера — `div.mx-auto.max-w-5xl.px-4.sm:px-6`, то есть с
 * `getBoundingClientRect().right` минус собственный `padding-right`.
 * Никакого «оставлять N px запаса» здесь нет намеренно: любое такое N
 * было бы числом, подогнанным под сегодняшнее состояние, а вопрос,
 * на который отвечает эта проверка, — «помещается ли ряд в раму, которую
 * сам себе объявил».
 *
 * Почему этого не видела ни одна прежняя проверка (долг 56, 7.131).
 * `check:layout` ходит анонимно и логиниться не умеет, а анонимная шапка
 * правого кластера почти не содержит. `e2e/page-width.spec.ts` и
 * `e2e/navbar-signed-in.spec.ts` вошедшего меряют, но сравнивают документ
 * с ВЬЮПОРТОМ: ряд, вылезший за свою коробку на 15.48 px, но оставшийся
 * внутри 640 px экрана за счёт правого паддинга, для них зелёный. Ровно
 * это состояние жило на `main` и на проде, и ровно оно не давало вернуть
 * кнопке поиска 44×44 (7.131, часть 7; 7.132, части 2 и 3).
 *
 * Позитивный контроль — не приложение, а половина проверки: в конце
 * каждого теста в шапку подсаживается лишняя ширина, и то же правило
 * ОБЯЗАНО на ней покраснеть. Подсадка ставится на самый правый ВИДИМЫЙ
 * элемент кластера (при 640 это переключатель профиля или кнопка входа) —
 * то есть ровно туда, куда её кладёт чужая растеризация шрифта в CI.
 */

/** Полоса, ради которой сторож заведён. 768 — правый край полосы: там
 * появляется значок серии (`md:flex`), то есть кластер шире, чем на 720. */
const WIDTHS = [640, 720, 768] as const;

/** Подсадка заведомо больше, чем вилка чужой растеризации из 7.131
 * (+3…+10 px), и больше измеренного запаса до коробки (+16 px при 640):
 * контроль обязан краснеть без всяких «в зависимости от движка». */
const PLANT_PX = 64;

interface RowGeometry {
  vw: number;
  contentRight: number;
  rowRight: number;
  overflow: number;
}

async function rowGeometry(page: import("@playwright/test").Page): Promise<RowGeometry> {
  return page.evaluate(() => {
    const container = document.querySelector("header > div.mx-auto");
    if (!container) throw new Error("шапка не найдена: header > div.mx-auto");
    const style = getComputedStyle(container);
    const box = container.getBoundingClientRect();
    const contentRight = box.right - parseFloat(style.paddingRight);
    const rowRight = Math.max(
      ...[...container.children].map((child) => child.getBoundingClientRect().right),
    );
    return {
      vw: document.documentElement.clientWidth,
      contentRight: Number(contentRight.toFixed(2)),
      rowRight: Number(rowRight.toFixed(2)),
      overflow: Number((rowRight - contentRight).toFixed(2)),
    };
  });
}

/** Ставит/снимает лишнюю ширину на самом правом ВИДИМОМ элементе кластера. */
async function plant(page: import("@playwright/test").Page, px: number): Promise<void> {
  await page.evaluate((px) => {
    const cluster = document.querySelector("header > div.mx-auto > div.ml-auto");
    if (!cluster) throw new Error("правый кластер шапки не найден");
    const visible = [...cluster.children].filter((n) => getComputedStyle(n).display !== "none");
    const target = visible[visible.length - 1] as HTMLElement | undefined;
    if (!target) throw new Error("в кластере нет ни одного видимого элемента");
    target.style.paddingRight = px ? `${px}px` : "";
  }, px);
}

/** Полпикселя — это допуск на округление субпиксельной геометрии, а НЕ
 * запас ширины: при 640 у ряда его 24 px, и ни одно из чисел этой спеки
 * от 0.5 не зависит. */
const ROUNDING_EPS = 0.5;

for (const lang of ["es", "ru"] as const) {
  test(`/${lang}: ряд шапки помещается в свою контентную коробку на 640–768`, async ({ page }) => {
    // Бюджет по числу загрузок: шесть страниц (три ширины × два состояния
    // входа) с ожиданием устоявшейся геометрии после каждой, плюс логин.
    // Тот же счёт, что в e2e/navbar-signed-in.spec.ts.
    test.setTimeout(30_000 + 6 * (SETTLE_MAX_MS + 5_000));

    const tooWide: string[] = [];

    // Анонимный посетитель — на главной: у него в кластере нет ни имени,
    // ни значка серии, и это отдельное состояние шапки, а не «то же самое
    // поменьше».
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 780 });
      const response = await page.goto(`/${lang}`, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `/${lang} не ответила 200`).toBe(200);
      await settleGeometry(page);
      const geometry = await rowGeometry(page);
      if (geometry.overflow > ROUNDING_EPS) {
        tooWide.push(
          `аноним, ${width}px: ряд кончается на ${geometry.rowRight}, коробка на ${geometry.contentRight} (+${geometry.overflow})`,
        );
      }
    }

    await loginWithSubscription(page);

    // Вошедший — на /profile: именно эта страница краснела в CI (7.131),
    // и именно у неё самый широкий правый кластер (подпись «Мой профиль»).
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 780 });
      const response = await page.goto(`/${lang}/profile`, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `/${lang}/profile не ответила 200`).toBe(200);
      await settleGeometry(page);
      const geometry = await rowGeometry(page);
      if (geometry.overflow > ROUNDING_EPS) {
        tooWide.push(
          `вошедший, ${width}px: ряд кончается на ${geometry.rowRight}, коробка на ${geometry.contentRight} (+${geometry.overflow})`,
        );
      }
    }

    expect(tooWide, `ряд шапки шире своей контентной коробки:\n${tooWide.join("\n")}`).toEqual([]);

    // ПОЗИТИВНЫЙ КОНТРОЛЬ. Без него зелёное «0 находок» не значит ничего
    // (PROGRESS.md 4.1): проверка, которая не умеет краснеть, и проверка,
    // которой нечего сказать, выглядят одинаково.
    await page.setViewportSize({ width: 640, height: 780 });
    await page.goto(`/${lang}/profile`, { waitUntil: "domcontentloaded" });
    await settleGeometry(page);
    const clean = await rowGeometry(page);
    expect(clean.overflow, "перед подсадкой ряд обязан помещаться").toBeLessThanOrEqual(ROUNDING_EPS);

    await plant(page, PLANT_PX);
    const planted = await rowGeometry(page);
    expect(
      planted.overflow,
      `подсадка ${PLANT_PX}px обязана вывести ряд за коробку, а он кончился на ${planted.rowRight} при коробке ${planted.contentRight}`,
    ).toBeGreaterThan(ROUNDING_EPS);

    await plant(page, 0);
    const restored = await rowGeometry(page);
    expect(restored.overflow, "после снятия подсадки ряд обязан вернуться в коробку").toBeLessThanOrEqual(
      ROUNDING_EPS,
    );
  });
}
