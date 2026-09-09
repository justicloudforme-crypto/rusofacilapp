import { test, expect } from "./helpers/test";

/**
 * «Продолжить» открывает ТО САМОЕ слово, а не начало темы.
 *
 * ЧТО ЭТО ЗА ЖАЛОБА. Скриншот 06.09.2026: на странице слов два ряда
 * одинаковых плиток подряд — «ПРОДОЛЖИТЬ» и сетка категорий, — и второй
 * читается как дубль первого. Замер до правки: разметка плитки
 * «Продолжить» повторяла плитку каталога по всем признакам (иконка 48 px
 * из одной карты, коробка подписи `min-h-11`, счётчик, полоса, радиус,
 * рамка), а нажатие звало `selectCategory(category)`, то есть
 * `setIndex(0)` — ПЕРВУЮ карточку темы.
 *
 * ПРОБА УТВЕРЖДАЕТ О ПОСЛЕДСТВИИ, а не об имени класса (урок долга 94):
 * она читает НАПЕЧАТАННОЕ русское слово открывшейся карточки и требует,
 * чтобы это было слово места остановки, — и рядом же требует, чтобы у
 * темы существовала другая первая карточка, иначе «то самое» и «первое»
 * были бы одним и тем же и проба ничего бы не доказывала.
 *
 * Место остановки подкладывается через localStorage, а не через базу:
 * `/api/flashcards/summary` принимает карту прогресса гостя телом запроса
 * (POST, см. её шапку). Базу прогона e2e пишет только сервер — правило
 * 7.148 — и эта проба её не трогает вовсе.
 */

/**
 * Тема, которая есть и в `dev.db`, и в `e2e/fixtures/flashcards.json`.
 * Сами карточки в этих двух базах РАЗНЫЕ, поэтому id и слово не
 * записаны здесь литералом, а снимаются с того же маршрута, из которого
 * их берёт страница. Тот же приём, по которому `word-games-access.spec.ts`
 * выбирает клетку кроссворда, а не пишет её координату руками.
 */
const CATEGORY = "greetings";
/** Порядковый номер карточки места остановки. НЕ 0: иначе «то самое
 * слово» и «первое слово темы» были бы одним и тем же, и проба прошла бы
 * и на прежнем поведении. */
const RESUME_AT = 3;

interface Card {
  id: string;
  russian: string;
}

const WIDTHS = [
  { name: "телефон", width: 375, height: 780 },
  { name: "планшет", width: 768, height: 1024 },
];

for (const lang of ["es", "ru"] as const) {
  for (const size of WIDTHS) {
    test(`[${lang}] [${size.name}] «Продолжить» открывает то самое слово`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });

      // Карточки темы — из того же маршрута, что и у страницы, поэтому
      // «первая» и «та самая» здесь настоящие, а не угаданные.
      const res = await page.request.get(`/api/flashcards?category=${CATEGORY}`);
      expect(res.ok(), "маршрут карточек не ответил").toBe(true);
      const cards = ((await res.json()) as { cards?: Card[] }).cards ?? [];
      // Меньше двух карточек — проба вакуумна, и молчать об этом нельзя.
      expect(cards.length, `в теме ${CATEGORY} меньше ${RESUME_AT + 1} карточек`).toBeGreaterThan(RESUME_AT);
      const resume = cards[RESUME_AT];
      const first = cards[0];
      expect(resume.russian).not.toBe(first.russian);

      // Место остановки: одна запись в той самой карте, которую страница
      // и так шлёт на /api/flashcards/summary. Ставится ДО первой
      // загрузки страницы, иначе её прочитает уже отрисованный компонент.
      await page.addInitScript(
        ([key, cardId]) => {
          window.localStorage.setItem(key, JSON.stringify({ [cardId]: { known: false, updatedAt: Date.now() } }));
        },
        ["rusofacil:flashcard-progress", resume.id] as const,
      );

      await page.goto(`/${lang}/vocabulary`);

      const strip = page.locator('[data-testid="continue-strip"]');
      await expect(strip).toBeVisible();

      const row = strip.locator(`[data-testid="continue-row"][data-category="${CATEGORY}"]`);
      await expect(row).toBeVisible();
      // Блок знает, где человек остановился, и говорит это в разметке.
      await expect(row).toHaveAttribute("data-card", resume.id);
      // …и печатает само слово — то, чего сетка категорий не делает.
      await expect(row).toContainText(resume.russian);

      // Блок отличается от карточки категории НЕ только текстом: он
      // строка во всю ширину, а плитка каталога — элемент сетки. Ширина
      // сравнивается числом, а не на глаз.
      const tile = page.locator('[data-testid="category-tile"]').first();
      await expect(tile).toBeVisible();
      const rowBox = await row.boundingBox();
      const tileBox = await tile.boundingBox();
      expect(rowBox, "у строки «Продолжить» нет коробки").not.toBeNull();
      expect(tileBox, "у плитки категории нет коробки").not.toBeNull();
      expect(rowBox!.width).toBeGreaterThan(tileBox!.width * 1.4);

      // Тап.
      await row.click();

      // ПОСЛЕДСТВИЕ: открыта карточка, и напечатано на ней слово места
      // остановки.
      const front = page.locator('div[role="button"][tabindex="0"]');
      await expect(front).toBeVisible();
      await expect(front).toContainText(resume.russian);

      // Контроль, без которого строка выше ничего не значит: первая
      // карточка темы — ДРУГАЯ, и её здесь нет. Без него проба прошла бы
      // и на прежнем поведении, если бы слова случайно совпали.
      await expect(front).not.toContainText(first.russian);

      // И место остановки пережило перезагрузку: оно в адресе, а не
      // только в памяти компонента.
      await expect(page).toHaveURL(new RegExp(`card=${resume.id}`));
    });
  }
}
