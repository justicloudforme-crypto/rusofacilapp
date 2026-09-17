import { test, expect } from "./helpers/test";

/**
 * «СКОЛЬКО МНЕ ОТКРЫТО» — НА САМОМ ЭКРАНЕ, А НЕ ТОЛЬКО ПОСЛЕ РАУНДА
 * (долг 249, заход 7.207).
 *
 * ЧТО СНЯЛ ВЛАДЕЛЕЦ 17.09.2026. В «Emparejar» при фильтре TODOS строки
 * «Llevas 0 de … palabras disponibles …» на экране нет; на её месте — блок
 * «Continuar».
 *
 * ЧТО ИЗМЕРЕНО. Строка не «вытеснена»: она никогда и не стояла на сетке
 * тем — `learnedProgressText` зовётся только из окна итога раунда
 * (`GameResultPanel`), и так с коммита `f6d2675`. В 7.204 владелец видел
 * её именно там.
 *
 * ЧТО ПРОВЕРЯЕТСЯ ЗДЕСЬ, и это про ПОСЛЕДСТВИЕ, а не про имя класса:
 *
 *   1) строка ВИДНА на сетке тем, до всякого раунда, на ширине телефона;
 *   2) числа в ней — ТЕ ЖЕ, что отдаёт `/api/flashcards/summary`, то есть
 *      второго счёта «доступного» на экране не завелось;
 *   3) блок «Продолжить» не сломан — он на месте и стоит ВЫШЕ строки.
 *
 * Ширина 384 — та, на которой владелец снимал видео (POCO X6 Pro).
 *
 * КОНТРОЛЬ НА КОДЕ ДО ПРАВКИ не нужен отдельным прогоном и не был бы
 * честным, если бы был написан словами: до правки элемента
 * `[data-learned-progress="grid"]` в разметке нет ВОВСЕ, поэтому первая же
 * проверка краснеет на прежнем коде по построению. Проверено подсадкой
 * прежней сетки локально.
 */
const WIDTH = 384;

for (const lang of ["es", "ru"] as const) {
  test(`[${lang}] строка «сколько открыто» видна на сетке тем «Emparejar»`, async ({ page }) => {
    await page.setViewportSize({ width: WIDTH, height: 780 });

    // Числа — из того же маршрута, из которого их берёт страница. Гость
    // шлёт свою карту прогресса телом (см. шапку маршрута); пустая карта —
    // это ровно тот гость, которого мы открываем ниже.
    const res = await page.request.post("/api/flashcards/summary", {
      data: {},
    });
    expect(res.ok(), "маршрут сводки не ответил").toBe(true);
    const summary = (await res.json()) as {
      totalKnown: number;
      availableWords: number;
      premiumOnlyWords: number;
      subscriptionOnlyWords: number;
    };

    await page.goto(`/${lang}/vocabulary?mode=match`);

    const line = page.locator('[data-learned-progress="grid"]');
    await expect(line).toBeVisible();

    // Числа те самые. Знаменатель и обе закрытые доли — каждое своим
    // утверждением, иначе совпадение одного числа сошло бы за совпадение
    // всех.
    await expect(line).toContainText(String(summary.availableWords));
    if (summary.subscriptionOnlyWords > 0) {
      await expect(line).toContainText(String(summary.subscriptionOnlyWords));
    }
    if (summary.premiumOnlyWords > 0) {
      await expect(line).toContainText(String(summary.premiumOnlyWords));
    }

    // Сколько открыто — величина положительная: строка про «0 из 0»
    // означала бы, что мерить нечего, и проба была бы вакуумной.
    expect(summary.availableWords, "доступных слов ноль — проба ничего не судит").toBeGreaterThan(0);

    // «Продолжить» не сломан: сетка тем на месте, и строка стоит НИЖЕ
    // блока, а не вместо него.
    const grid = page.locator('[data-testid="category-tile"]').first();
    await expect(grid).toBeVisible();
    const lineBox = await line.boundingBox();
    const gridBox = await grid.boundingBox();
    expect(lineBox, "у строки нет коробки").not.toBeNull();
    expect(gridBox, "у плитки темы нет коробки").not.toBeNull();
    expect(lineBox!.y).toBeLessThan(gridBox!.y);
    // И она действительно ВНУТРИ экрана телефона, а не за его краем.
    expect(lineBox!.x).toBeGreaterThanOrEqual(0);
    expect(lineBox!.x + lineBox!.width).toBeLessThanOrEqual(WIDTH);
  });
}
