import { test, expect } from "./helpers/test";

/**
 * Значок платности в списке уроков говорит правду о ПОСЛЕДСТВИИ.
 *
 * До 09.09.2026 значка здесь не было ни одного, а платность была: 116
 * уроков из 120 отдают неоплатившему только грамматику, а словарь,
 * упражнения и слайды прячут за пейволлом. «Платность есть — знака нет».
 *
 * Проба не смотрит на имя класса и не ищет глиф в отрыве от смысла. Она
 * берёт две строки списка — со значком и без — и открывает обе, требуя
 * противоположных последствий: у отмеченной есть карточка пейволла
 * (`.paywall-lock`, тот же хук, на который смотрит JSON-LD страницы), у
 * неотмеченной её нет ни одной. Отрицательная половина здесь
 * обязательна: значок, который стоит ВЕЗДЕ, столь же бесполезен, как
 * значок, которого нет нигде.
 */
const LEVEL = "a1";
const MARKED_LESSON = "2";
const UNMARKED_LESSON = "1";
/** 🔒 — глиф «нужна подписка», один на весь сайт (ACCESS_MARK_ICON). */
const SUBSCRIPTION_GLYPH = "\u{1F512}";

for (const lang of ["es", "ru"] as const) {
  test(`[${lang}] значок у урока стоит ровно там, где урок закрыт`, async ({ page }) => {
    await page.goto(`/${lang}/courses/${LEVEL}`);

    const marked = page.locator(`a[href="/${lang}/courses/${LEVEL}/${MARKED_LESSON}"]`);
    const unmarked = page.locator(`a[href="/${lang}/courses/${LEVEL}/${UNMARKED_LESSON}"]`);
    await expect(marked).toBeVisible();
    await expect(unmarked).toBeVisible();

    // Значок есть у второго урока и НЕТ у первого — иначе он не значок, а
    // украшение строки.
    await expect(marked).toContainText(SUBSCRIPTION_GLYPH);
    await expect(unmarked).not.toContainText(SUBSCRIPTION_GLYPH);

    // ПОСЛЕДСТВИЕ отмеченного: карточки пейволла на странице ЕСТЬ.
    // Считаются, а не проверяются на видимость: страница печатает все три
    // вкладки в HTML сразу и прячет неактивные классом `hidden` (см.
    // LessonView) — ради краулера. Видимость здесь мерила бы, какая
    // вкладка открыта по умолчанию, а не закрыт ли урок.
    await page.goto(`/${lang}/courses/${LEVEL}/${MARKED_LESSON}`);
    const markedLocks = await page.locator(".paywall-lock").count();
    expect(markedLocks).toBeGreaterThan(0);

    // ПОСЛЕДСТВИЕ неотмеченного: закрытого блока нет ни одного.
    await page.goto(`/${lang}/courses/${LEVEL}/${UNMARKED_LESSON}`);
    await expect(page.locator(".paywall-lock")).toHaveCount(0);
  });
}
