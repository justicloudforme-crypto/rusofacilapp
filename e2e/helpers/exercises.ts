import { expect, type Page } from "@playwright/test";

/**
 * Заполняет ВСЕ упражнения открытой вкладки «Ejercicios» чем угодно —
 * важна полнота (кнопка «Comprobar» активна только при ней), а не
 * правильность: сервер записывает и несданную попытку. Заход 7.236.
 * Семь типов: радиокнопки (выбор, аудирование, чтение), поля (пропуск,
 * транскрипция), списки (сопоставление), кнопки пула (перестановка слов).
 */
export async function fillAllExercises(page: Page, pick: "first" | "last" = "first"): Promise<void> {
  const panel = page.locator('[data-offline-panel="exercises"]');
  await panel.locator("fieldset, input, select").first().waitFor();
  // Радиокнопки спрятаны внутрь <label> — отметка принудительная.
  const names = await panel.locator('input[type="radio"]').evaluateAll((els) =>
    Array.from(new Set(els.map((el) => (el as HTMLInputElement).name))),
  );
  // В каждом уроке есть выбор ответа; пустой список — вкладка не та или
  // разметка уехала, и «заполнено» было бы неправдой.
  expect(names.length, "в упражнениях не нашлось ни одной группы радиокнопок").toBeGreaterThan(0);
  for (const name of names) {
    // `el.click()` изнутри страницы, а не `check({force})`: в WebKit на
    // телефоне (mobile-iphone) принудительный клик по спрятанной радиокнопке
    // её не отмечает. Отметка затем утверждается — иначе заполнение молча не
    // случилось бы.
    // «last» — другой набор ответов с другим баллом (7.237: две попытки,
    // которые должны различаться на экране).
    const group = panel.locator(`input[type="radio"][name="${name}"]`);
    const radio = pick === "last" ? group.last() : group.first();
    await radio.evaluate((el) => (el as HTMLInputElement).click());
    await expect(radio).toBeChecked();
  }
  // Поля ввода.
  const texts = panel.locator('input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]):not([type="file"])');
  for (let i = 0; i < (await texts.count()); i++) await texts.nth(i).fill("a");
  // Списки сопоставления: первый непустой вариант.
  const selects = panel.locator("select");
  for (let i = 0; i < (await selects.count()); i++) {
    const values = await selects.nth(i).locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    await selects.nth(i).selectOption(values[0]);
  }
  // Перестановка слов: пул — блок без `min-h-12` (с ним — выбранные слова).
  for (let guard = 0; guard < 200; guard++) {
    const pool = panel.locator("fieldset > div.flex.flex-wrap.gap-2:not(.min-h-12) > button:not([disabled])");
    if ((await pool.count()) === 0) break;
    await pool.first().click();
  }
}
