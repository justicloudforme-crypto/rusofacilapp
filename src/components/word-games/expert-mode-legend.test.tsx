import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/contexts/PaywallContext", () => ({
  usePaywall: () => ({ openPaywall: () => {} }),
}));

import WordGamesPicker, { type PickerData, type WordGamesPickerDict } from "./WordGamesPicker";
import es from "@/dictionaries/es.json";
import ru from "@/dictionaries/ru.json";
import type { Locale } from "@/i18n/config";
import { flashcardLevels, type FlashcardLevel } from "@/lib/flashcards";

/**
 * ДОЛГ 213 — ЗНАК ★ ОБЪЯСНЁН ГЛАЗАМИ (решение владельца 15.09.2026).
 *
 * Знак оставлен, но видимой подписи у него не было ни одной: «Modo
 * experto» / «Режим эксперта» жило только в `aria-label`/`title`, а на
 * телефоне ни наведения, ни всплывающей подсказки нет вовсе.
 *
 * Проверка ДВУСТОРОННЯЯ, и вторая сторона здесь не формальность: легенда,
 * напечатанная там, где звёзд нет, объясняла бы знак, которого человек не
 * видит, — то есть была бы новым дефектом того же класса.
 *
 * Перепись боевой базы (7.198): `curved = 1` у 479 пазлов из 3277, все —
 * филворды, у кроссвордов 0 из 1262. Поэтому вкладка кроссвордов взята
 * отдельным случаем: там легенды быть не может по данным.
 */

const DICTS: Record<Locale, WordGamesPickerDict> = {
  es: es.wordGames as WordGamesPickerDict,
  ru: ru.wordGames as WordGamesPickerDict,
};

/** Разрезы в форме ответа страницы: `curved` — номера пазлов со звездой. */
function pickerData(curvedByLevel: Partial<Record<FlashcardLevel, number[]>>): PickerData {
  const build = (withCurved: boolean) =>
    Object.fromEntries(
      flashcardLevels.map((lvl) => [
        lvl,
        {
          total: 12,
          completed: [] as number[],
          curved: withCurved ? (curvedByLevel[lvl] ?? []) : [],
          premiumOnly: withCurved ? (curvedByLevel[lvl] ?? []) : [],
        },
      ]),
    ) as unknown as PickerData["WORD_SEARCH"];
  return { WORD_SEARCH: build(true), CROSSWORD: build(false) };
}

const legend = () => screen.queryByTestId("expert-mode-legend");

afterEach(cleanup);

for (const locale of ["es", "ru"] as const) {
  describe(`легенда ★, локаль /${locale}`, () => {
    it("есть там, где на сетке ЕСТЬ плитка со звездой", () => {
      render(
        <WordGamesPicker
          lang={locale}
          dict={DICTS[locale]}
          data={pickerData({ A1: [2, 5] })}
          isPremium={false}
          isSubscriber={false}
        />,
      );
      // Звезда на сетке действительно есть.
      expect(screen.getAllByText("★").length).toBeGreaterThan(0);
      expect(legend()).toBeInTheDocument();
      expect(legend()!.textContent).toContain("★");
      // Текст объясняет СЛОЖНОСТЬ и раскладку слов, а не оплату: корона и
      // звезда в тексте не смешиваются (7.196).
      expect(legend()!.textContent).not.toContain("👑");
      expect(legend()!.textContent).not.toMatch(/Premium|подписк|suscripci/i);
    });

    // ВТОРАЯ СТОРОНА: там, где звёзд нет, легенды быть не должно.
    it("её нет там, где звёзд нет — уровень без изогнутых пазлов", () => {
      render(
        <WordGamesPicker
          lang={locale}
          dict={DICTS[locale]}
          data={pickerData({})}
          isPremium={false}
          isSubscriber={false}
        />,
      );
      expect(screen.queryAllByText("★")).toHaveLength(0);
      expect(legend()).not.toBeInTheDocument();
    });

    it("подпись знака больше не только в подсказке: текст легенды виден", () => {
      render(
        <WordGamesPicker
          lang={locale}
          dict={DICTS[locale]}
          data={pickerData({ A1: [7] })}
          isPremium={false}
          isSubscriber={false}
        />,
      );
      // Ровно то, чего не хватало: видимый узел с объяснением.
      expect(legend()!.textContent!.length).toBeGreaterThan(40);
      // И ничего, что запрещает перенос: на 320 px строка обязана
      // переноситься, а не расталкивать страницу.
      expect(legend()!.className).not.toMatch(/whitespace-nowrap|w-\[|min-w-\[/);
    });

    it("у премиального посетителя объяснение то же самое — это не про доступ", () => {
      render(
        <WordGamesPicker
          lang={locale}
          dict={DICTS[locale]}
          data={pickerData({ A1: [3] })}
          isPremium
          isSubscriber
        />,
      );
      expect(legend()!.textContent).toBe(DICTS[locale].expertModeLegend);
    });
  });
}

describe("тексты легенды и подсказки существуют в обеих локалях", () => {
  it("испанский и русский — разные строки, обе непустые", () => {
    for (const key of ["expertModeLegend", "expertModeHint"] as const) {
      expect(DICTS.es[key as "expertModeLegend"]).toBeTruthy();
      expect((ru.wordGames as Record<string, string>)[key]).toBeTruthy();
      expect((es.wordGames as Record<string, string>)[key]).not.toBe((ru.wordGames as Record<string, string>)[key]);
    }
    // Кириллицы в испанской строке нет, латиницы вместо русской — тоже.
    expect((es.wordGames as Record<string, string>).expertModeLegend).not.toMatch(/[А-Яа-яЁё]/);
    expect((ru.wordGames as Record<string, string>).expertModeLegend).toMatch(/[А-Яа-яЁё]/);
  });
});
