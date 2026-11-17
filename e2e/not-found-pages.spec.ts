import { test, expect } from "./helpers/test";

/**
 * ДОЛГ 133 (заход 7.286): 13 видов адресов, где маршрут СОВПАЛ, а страница
 * сама позвала `notFound()` — нет такого рассказа, урока, пазла, медиа…
 *
 * Замер 16.11.2026 на `main` `1fa98ca` (next start, Next 16.4.2): у всех 13
 * код 404 и `noindex` (для Google верно), но человек видел только
 * английскую заглушку Next «404 This page could not be found.» — 33 знака,
 * без шапки, без подвала, без единой ссылки, `<html lang="">`. Причина —
 * в `src/app/[lang]/` не было `not-found.tsx`: у `notFound()` из страницы
 * не было своей границы, и Next рисовал встроенную. После правки — наша
 * страница (`NotFoundBody`) внутри рамы `[lang]/layout.tsx`.
 *
 * ЧЕГО ТЕСТ НЕ ТРЕБУЕТ, И ПОЧЕМУ. Серверный HTML этих ответов — пустая
 * оболочка Next `<html id="__next_error__">`, страницу рисует браузер из
 * присланных вместе с ней данных. Измерено в 7.286 на двух крошечных
 * приложениях на том же Next 16.4.2: так ведёт себя ЛЮБОЙ `notFound()` из
 * страницы, и с `<html>` в `app/layout.tsx`, и в `app/[lang]/layout.tsx`,
 * с флагом `globalNotFound` и без. Поэтому здесь мерится то, что видит
 * человек, — страница после загрузки, — и код ответа.
 *
 * Список — тот же, что «ourPage: false» в `scripts/check-404-page.mjs`.
 */

const TITLES = { es: "Página no encontrada", ru: "Страница не найдена" } as const;

const KINDS: { name: string; path: string; lang: "es" | "ru" }[] = [
  { name: "путь без локали внутри раздела", path: "/stories/net-takogo-rasskaza", lang: "es" },
  { name: "несуществующий рассказ /es", path: "/es/stories/net-takogo-rasskaza", lang: "es" },
  { name: "несуществующий рассказ /ru", path: "/ru/stories/net-takogo-rasskaza", lang: "ru" },
  { name: "несуществующий урок /es", path: "/es/courses/a1/999", lang: "es" },
  { name: "несуществующий урок /ru", path: "/ru/courses/a1/999", lang: "ru" },
  { name: "несуществующий уровень курса", path: "/es/courses/zz", lang: "es" },
  { name: "несуществующий пазл /es", path: "/es/word-games/crossword/a1/99999", lang: "es" },
  { name: "несуществующий пазл /ru", path: "/ru/word-games/crossword/a1/99999", lang: "ru" },
  { name: "несуществующий вид пазла", path: "/es/word-games/net-takogo-vida/a1/1", lang: "es" },
  { name: "несуществующее медиа", path: "/es/media/net-takogo-media", lang: "es" },
  { name: "несуществующий термин глоссария", path: "/es/glossary/net-takogo-termina", lang: "es" },
  { name: "несуществующий экзамен", path: "/es/courses/a1/exam/net-takogo", lang: "es" },
  { name: "несуществующий профиль", path: "/es/u/net-takogo-cheloveka", lang: "es" },
];

test("долг 133: видов адресов «маршрут совпал, строки нет» ровно 13", () => {
  expect(KINDS).toHaveLength(13);
});

for (const kind of KINDS) {
  test(`долг 133: ${kind.name} — код 404 и своя страница «не найдено» (${kind.lang})`, async ({ page }) => {
    const response = await page.goto(kind.path);
    // Код ответа — то, что видит Google: 404, не 200 и не редирект на
    // живую страницу (путь без локали проходит один редирект прокси на
    // /es/… и только потом получает свой 404).
    expect(response?.status(), "код ответа").toBe(404);
    expect(new URL(page.url()).pathname, "адрес не подменён живой страницей").toBe(
      kind.path.startsWith(`/${kind.lang}/`) ? kind.path : `/${kind.lang}${kind.path}`,
    );

    const body = page.getByTestId("not-found-page");
    await expect(body, "наша страница «не найдено»").toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", kind.lang);
    await expect(body.getByRole("heading", { level: 1 })).toHaveText(TITLES[kind.lang]);
    const foreign = kind.lang === "es" ? TITLES.ru : TITLES.es;
    await expect(page.getByText(foreign), "текста чужой локали нет").toHaveCount(0);

    // Рама сайта и дорога обратно.
    await expect(page.locator("header").first(), "шапка").toBeVisible();
    await expect(page.locator("footer").first(), "подвал").toBeAttached();
    await expect(body.locator(`a[href="/${kind.lang}"]`), "ссылка на главную").toBeVisible();
    await expect(body.locator(`a[href="/${kind.lang}/courses"]`), "ссылка на каталог").toBeVisible();

    // Для Google страница по-прежнему закрыта от индекса.
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  });
}
