import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import FreeTrialLimitBanner, { NativeLockedNotice, LockedOrEmpty } from "./FreeTrialLimitBanner";

// Пейвол подменён целиком: настоящая рама требует словарь, планы и цену —
// то есть ровно то, чего внутри оболочки не существует. Здесь проверяется
// не она, а СКОЛЬКО плашек печатает компонент.
vi.mock("@/contexts/PaywallContext", () => ({
  usePaywall: () => ({ openPaywall: () => {} }),
}));
import CategoryGrid, { type CategoryGridDict } from "./CategoryGrid";
import { NATIVE_SHELL_COOKIE, NATIVE_SHELL_COOKIE_VALUE } from "@/lib/native-shell-token";
import { nativeAccessCopy } from "@/lib/native-access-copy";
import { ACCESS_MARK_ICON } from "@/lib/access-marks";
import { flashcardCategories } from "@/lib/flashcards";
import type { FlashcardCategory } from "@/lib/flashcards";

/**
 * ТРИ НАХОДКИ ВЛАДЕЛЬЦА С ЖИВОГО ТЕЛЕФОНА 14.09.2026 — 7.195, части 1, 3, 4.
 *
 *   1. Плашка замка в словаре на уровне C1 рисовалась ДВА РАЗА подряд.
 *   2. Плитки тем на уровне C1 писали «0 слов» при непустом банке.
 *   3. Два знака (👑 и 🔒) стояли вперемешку: у уровня C1 — корона на
 *      фильтре и замок на плашке про тот же материал.
 *
 * Признак оболочки в jsdom поднимается кукой — той же самой, которую в
 * приложении ставит `src/lib/native-shell-client.ts`; `Capacitor` здесь
 * нет вовсе, и это ровно тот путь, которым признак работает у service
 * worker'а (7.192).
 */
function enterNativeShell() {
  document.cookie = `${NATIVE_SHELL_COOKIE}=${NATIVE_SHELL_COOKIE_VALUE}; path=/`;
}
function leaveNativeShell() {
  document.cookie = `${NATIVE_SHELL_COOKIE}=; path=/; max-age=0`;
}

function plates(): HTMLElement[] {
  return screen.queryAllByTestId("native-locked-notice");
}

afterEach(() => {
  cleanup();
  leaveNativeShell();
});

describe("часть 1 — плашка на экране одна", () => {
  beforeEach(enterNativeShell);

  it("плашка сверху есть, второй под ней нет", () => {
    render(
      <>
        <NativeLockedNotice locale="ru" lockedTotal={8} level="C1" topic="Еда" unit="words" requirement="premium-tier" />
        <LockedOrEmpty
          locale="ru"
          emptyMessage="Нет карточек для этого фильтра"
          lockedHere={8}
          level="C1"
          topic="Еда"
          unit="words"
          requirement="premium-tier"
          noticeAbove
        />
      </>,
    );
    expect(plates()).toHaveLength(1);
    // И текста «ничего нет» под плашкой тоже нет: он противоречил бы ей.
    expect(screen.queryByText("Нет карточек для этого фильтра")).not.toBeInTheDocument();
  });

  it("без плашки сверху нижняя рисуется — иначе экран снова онемел бы", () => {
    render(
      <LockedOrEmpty
        locale="ru"
        emptyMessage="Нет карточек для этого фильтра"
        lockedHere={8}
        level="C1"
        unit="words"
        requirement="premium-tier"
      />,
    );
    expect(plates()).toHaveLength(1);
  });

  // ПОЗИТИВНЫЙ КОНТРОЛЬ: подсадка второй плашки обязана уронить счёт.
  it("подсадка второй плашки ловится", () => {
    render(
      <>
        <NativeLockedNotice locale="ru" lockedTotal={8} level="C1" unit="words" />
        <NativeLockedNotice locale="ru" lockedTotal={8} level="C1" unit="words" />
      </>,
    );
    expect(plates()).toHaveLength(2);
  });

  it("два предупреждения идиом дают ОДНУ плашку в оболочке", () => {
    // Путь, который поймал CI, а не рассуждение: у гостя по ссылке на
    // закрытое выражение `limited` и `focusMissing` истинны ОБА.
    render(
      <>
        <FreeTrialLimitBanner message="общий предел" cta="купить" locale="ru" lockedTotal={766} unit="expressions" />
        <FreeTrialLimitBanner
          message="ссылка на закрытое"
          cta="купить"
          locale="ru"
          lockedTotal={766}
          unit="expressions"
          requirement="premium-tier"
          noticeAbove
        />
      </>,
    );
    expect(plates()).toHaveLength(1);
  });

  it("В ВЕБЕ оба предупреждения остаются — они говорят разное", () => {
    // ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ к случаю выше. Первая редакция правки свела
    // три блока идиом в одну цепочку и убрала со страницы сообщение
    // «…se abre con la suscripción»; поймал это CI
    // (`e2e/search-deep-link.spec.ts`), а не проверка. Теперь ловит она.
    leaveNativeShell();
    render(
      <>
        <FreeTrialLimitBanner message="общий предел" cta="купить" locale="ru" lockedTotal={766} unit="expressions" />
        <FreeTrialLimitBanner
          message="ссылка на закрытое"
          cta="купить"
          locale="ru"
          lockedTotal={766}
          unit="expressions"
          noticeAbove
        />
      </>,
    );
    expect(plates()).toHaveLength(0);
    expect(screen.getByText("общий предел")).toBeInTheDocument();
    expect(screen.getByText("ссылка на закрытое")).toBeInTheDocument();
  });

  it("честно пустой фильтр по-прежнему говорит, что он пуст", () => {
    render(<LockedOrEmpty locale="ru" emptyMessage="Нет карточек для этого фильтра" lockedHere={0} unit="words" />);
    expect(plates()).toHaveLength(0);
    expect(screen.getByText("Нет карточек для этого фильтра")).toBeInTheDocument();
  });

  /**
   * ПРАВИЛО СМЕНИЛОСЬ, А НЕ ОСЛАБЛО — долг 259, решение владельца
   * 18.09.2026. До него это утверждение звучало «в вебе плашки нет вовсе»,
   * и оно было верным для прежнего правила. Теперь причина «материал есть
   * и закрыт» одинакова в браузере и в приложении, и проверяется ровно то
   * же самое, только с обратным знаком: плашка ОБЯЗАНА быть, а прежний
   * текст — исчезнуть, потому что он противоречил бы ей.
   */
  it("в вебе плашка та же, что в приложении", () => {
    leaveNativeShell();
    render(<LockedOrEmpty locale="ru" emptyMessage="Нет карточек для этого фильтра" lockedHere={8} unit="words" />);
    expect(plates()).toHaveLength(1);
    expect(plates()[0].textContent).toContain("8");
    expect(screen.queryByText("Нет карточек для этого фильтра")).toBeNull();
  });

  it("в вебе честно пустой фильтр по-прежнему говорит, что он пуст", () => {
    leaveNativeShell();
    render(<LockedOrEmpty locale="ru" emptyMessage="Нет карточек для этого фильтра" lockedHere={0} unit="words" />);
    expect(plates()).toHaveLength(0);
    expect(screen.getByText("Нет карточек для этого фильтра")).toBeInTheDocument();
  });
});

describe("часть 2 — разрез числа звучит словами", () => {
  beforeEach(enterNativeShell);

  it("пересечение называет и уровень, и тему", () => {
    render(<NativeLockedNotice locale="ru" lockedTotal={8} level="C1" topic="Еда" unit="words" />);
    const text = plates()[0].textContent ?? "";
    expect(text).toContain("8");
    expect(text).toContain("C1");
    expect(text).toContain("Еда");
  });

  it("уровень без темы про тему не сочиняет", () => {
    render(<NativeLockedNotice locale="ru" lockedTotal={988} level="C1" unit="words" />);
    const text = plates()[0].textContent ?? "";
    expect(text).toContain("988");
    expect(text).toContain("C1");
    expect(text).not.toContain("теме");
  });

  it("ни одного литерала-числа: что передали, то и напечатано", () => {
    for (const n of [1, 2, 5, 26, 766, 988]) {
      cleanup();
      render(<NativeLockedNotice locale="ru" lockedTotal={n} unit="words" />);
      expect(plates()[0].textContent).toContain(String(n));
    }
  });

  it("испанская локаль печатает испанский разрез", () => {
    render(<NativeLockedNotice locale="es" lockedTotal={8} level="C1" topic="Comida" unit="words" />);
    const text = plates()[0].textContent ?? "";
    expect(text).toContain("Comida");
    expect(text).toContain("C1");
  });
});

describe("часть 4 — два знака, каждый на своём месте", () => {
  beforeEach(enterNativeShell);

  it("премиальный материал носит корону и подпись плана", () => {
    render(<NativeLockedNotice locale="ru" lockedTotal={988} level="C1" unit="words" requirement="premium-tier" />);
    const text = plates()[0].textContent ?? "";
    expect(text).toContain(ACCESS_MARK_ICON["premium-tier"]);
    expect(text).toContain(nativeAccessCopy("ru").locked.badgePremium);
    expect(text).not.toContain(ACCESS_MARK_ICON.subscription);
  });

  it("обычный платный материал носит замок и подпись подписки", () => {
    render(<NativeLockedNotice locale="ru" lockedTotal={26} level="B2" unit="words" requirement="subscription" />);
    const text = plates()[0].textContent ?? "";
    expect(text).toContain(ACCESS_MARK_ICON.subscription);
    expect(text).toContain(nativeAccessCopy("ru").locked.badge);
    expect(text).not.toContain(ACCESS_MARK_ICON["premium-tier"]);
  });

  it("знак помечен как МЕТКА, а не как орган управления", () => {
    const { container } = render(
      <NativeLockedNotice locale="ru" lockedTotal={988} level="C1" unit="words" requirement="premium-tier" />,
    );
    expect(container.querySelectorAll("[data-access-mark]")).toHaveLength(1);
    // Ни кнопки, ни ссылки: плашка ничего не предлагает нажать.
    expect(container.querySelectorAll("a, button")).toHaveLength(0);
  });

  // ПОЗИТИВНЫЙ КОНТРОЛЬ второй половины: подсадка замка на премиальный
  // материал обязана быть отличима от короны.
  it("подсадка замка на премиальный материал ловится", () => {
    render(<NativeLockedNotice locale="ru" lockedTotal={988} level="C1" unit="words" requirement="subscription" />);
    const text = plates()[0].textContent ?? "";
    expect(text).toContain(ACCESS_MARK_ICON.subscription);
    expect(text).not.toContain(ACCESS_MARK_ICON["premium-tier"]);
  });
});

const GRID_DICT: CategoryGridDict = {
  locale: "ru",
  categoryLabels: Object.fromEntries(flashcardCategories.map((c) => [c, c])) as Record<FlashcardCategory, string>,
  cardCountLabel: { one: "{count} слово", few: "{count} слова", many: "{count} слов" },
  nextLevelBadgeLabel: "Дальше {level}",
  premiumTierBadge: "Только Premium",
  subscriptionBadge: "По подписке",
};

/** Перепись банка в форме ответа `/api/flashcards/summary`. */
function bankOf(perCategory: number): Record<string, { bank: number; open: number; locked: number }> {
  return Object.fromEntries(flashcardCategories.map((c) => [c, { bank: perCategory, open: 0, locked: perCategory }]));
}

describe("часть 3 — плитка не пишет «0 слов», когда слова есть", () => {
  beforeEach(enterNativeShell);

  it("на закрытом уровне плитка называет то, что ЕСТЬ, и ставит корону", () => {
    const { container } = render(
      <CategoryGrid
        dict={GRID_DICT}
        summary={{}}
        levelFilter="C1"
        bank={bankOf(43)}
        lockedAtLevel={988}
        summaryLevel="C1"
        onSelectCategory={() => {}}
      />,
    );
    const tiles = [...container.querySelectorAll("[data-testid=category-tile]")];
    expect(tiles.length).toBe(flashcardCategories.length);
    for (const tile of tiles) {
      expect(tile.getAttribute("data-total")).toBe("43");
      expect(tile.textContent).not.toContain("0 слов");
      expect(tile.textContent).toContain(ACCESS_MARK_ICON["premium-tier"]);
    }
    // И одна плашка на весь экран с числом уровня.
    expect(plates()).toHaveLength(1);
    expect(plates()[0].textContent).toContain("988");
  });

  // ПОЗИТИВНЫЙ КОНТРОЛЬ: без переписи банка плитка снова пишет ноль —
  // ровно то, что владелец снял на телефоне.
  it("подсадка прежнего поведения (переписи банка нет) ловится", () => {
    const { container } = render(
      <CategoryGrid
        dict={GRID_DICT}
        summary={{}}
        levelFilter="C1"
        bank={{}}
        lockedAtLevel={0}
        summaryLevel="C1"
        onSelectCategory={() => {}}
      />,
    );
    const tiles = [...container.querySelectorAll("[data-testid=category-tile]")];
    expect(tiles.every((t) => t.getAttribute("data-total") === "0")).toBe(true);
    expect(tiles[0].textContent).toContain("0 слов");
    // 7.196: корона при этом на месте — она метка СОРТА и от переписи не
    // зависит вовсе. Подсадка ловится числом «0 слов», а не отсутствием
    // знака: это два независимых утверждения, и их нельзя путать.
    expect(tiles[0].textContent).toContain(ACCESS_MARK_ICON["premium-tier"]);
  });

  /**
   * ПРАВИЛО СМЕНИЛОСЬ, А НЕ ОСЛАБЛО — долг 257, решение владельца
   * 18.09.2026. Прежнее утверждение звучало «в вебе плитка считает
   * доступное, как считала», и ему соответствовал замер: в браузере на C1
   * у бесплатного и у доступа по коду стояло 0 корон, 0 замков и сумма
   * чисел 0 при 988 строках банка. Теперь браузер обязан сказать то же
   * самое, что приложение, — и проверяется это тем же числом и тем же
   * селектором, только с обратным знаком.
   */
  it("в вебе плитка говорит то же, что в приложении", () => {
    leaveNativeShell();
    const { container } = render(
      <CategoryGrid
        dict={GRID_DICT}
        summary={{ food: { total: 5, known: 0 } }}
        levelFilter="C1"
        bank={bankOf(43)}
        lockedAtLevel={988}
        summaryLevel="C1"
        onSelectCategory={() => {}}
      />,
    );
    const tiles = [...container.querySelectorAll("[data-testid=category-tile]")];
    const food = tiles.find((t) => t.textContent?.includes("food"));
    expect(food?.getAttribute("data-total")).toBe("43");
    expect(plates()).toHaveLength(1);
    // Только знаки НА ПЛИТКАХ: у плашки над сеткой метка своя, и считать
    // её вместе с плитками значило бы сверять 24 с 23.
    expect(
      container.querySelectorAll("[data-testid=category-tile] [data-access-mark=premium-tier]"),
    ).toHaveLength(tiles.length);
    expect(container.querySelectorAll("[data-testid=category-tile] [data-access-locked]")).toHaveLength(tiles.length);
  });

  it("на открытом уровне корона не ставится", () => {
    const open = Object.fromEntries(flashcardCategories.map((c) => [c, { bank: 40, open: 10, locked: 30 }]));
    const { container } = render(
      <CategoryGrid
        dict={GRID_DICT}
        summary={{}}
        levelFilter="B1"
        bank={open}
        lockedAtLevel={0}
        summaryLevel="B1"
        onSelectCategory={() => {}}
      />,
    );
    expect(container.querySelectorAll("[data-access-mark]")).toHaveLength(0);
    expect(plates()).toHaveLength(0);
  });
});
