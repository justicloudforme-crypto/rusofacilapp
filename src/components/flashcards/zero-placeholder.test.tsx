import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

vi.mock("@/contexts/PaywallContext", () => ({ usePaywall: () => ({ openPaywall: () => {} }) }));

import CategoryGrid, { type CategoryGridDict } from "./CategoryGrid";
import IdiomsList, { type IdiomsDict } from "./IdiomsList";
import { flashcardCategories } from "@/lib/flashcards";

/**
 * «ДАННЫХ ЕЩЁ НЕТ» ≠ «ДАННЫХ НОЛЬ» — долги 224 и 231, заход 7.204.
 *
 * Три состояния, и все три проверяются в обе стороны:
 *
 *   до ответа   → заглушка, числа на экране нет ни одного;
 *   ответ с 0   → печатается «0» — это ЧЕСТНЫЙ ноль, и прятать его
 *                 нельзя: «данных ноль» — такой же факт, как любой другой;
 *   ответ с N   → печатается N.
 *
 * Оболочки здесь нет НАРОЧНО (куки признака не ставится): весь смысл
 * правки 7.204 в том, что правило перестало быть про оболочку. До неё в
 * вебе заглушки не было вовсе — это и есть положительный контроль ниже.
 */

const GRID_DICT: CategoryGridDict = {
  locale: "es",
  categoryLabels: Object.fromEntries(flashcardCategories.map((c) => [c, c])) as CategoryGridDict["categoryLabels"],
  cardCountLabel: { one: "{count} palabra", few: "{count} palabras", many: "{count} palabras" },
  nextLevelBadgeLabel: "Siguiente {level}",
  premiumTierBadge: "Solo Premium",
  subscriptionBadge: "Con suscripción",
};

const tiles = (container: HTMLElement) => [...container.querySelectorAll("[data-testid=category-tile]")];
const tileSkeletons = (container: HTMLElement) => container.querySelectorAll("[data-testid=tile-count-skeleton]");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("плитки словаря в ВЕБЕ (долг 224)", () => {
  it("ответа ещё нет — заглушки на всех плитках, «0 palabras» нет ни разу", () => {
    const { container } = render(
      // `summaryLevel === undefined` — это и есть «ответ не пришёл».
      <CategoryGrid dict={GRID_DICT} summary={{}} levelFilter="all" onSelectCategory={() => {}} />,
    );
    expect(tileSkeletons(container)).toHaveLength(flashcardCategories.length);
    expect(container.textContent).not.toContain("0 palabras");
  });

  it("ответ пришёл, и в нём НОЛЬ — печатается «0 palabras»", () => {
    const { container } = render(
      <CategoryGrid dict={GRID_DICT} summary={{}} levelFilter="all" summaryLevel={null} onSelectCategory={() => {}} />,
    );
    expect(tileSkeletons(container)).toHaveLength(0);
    expect(container.textContent).toContain("0 palabras");
  });

  it("ответ пришёл, и в нём N — печатается N", () => {
    const { container } = render(
      <CategoryGrid
        dict={GRID_DICT}
        summary={{ food: { total: 51, known: 3 } }}
        levelFilter="all"
        summaryLevel={null}
        onSelectCategory={() => {}}
      />,
    );
    expect(tileSkeletons(container)).toHaveLength(0);
    const food = tiles(container).find((t) => t.textContent?.includes("food"));
    expect(food?.textContent).toContain("51 palabras");
  });

  it("положительный контроль: прежнее условие (`!nativeShell || …`) печатало бы ноль", () => {
    // Прежний код в одну строку: вне оболочки `ready` был истиной всегда.
    const nativeShell = false;
    const summaryLevel = undefined as string | null | undefined;
    const readyBefore = !nativeShell || (summaryLevel !== undefined && (summaryLevel ?? "all") === "all");
    const readyNow = summaryLevel !== undefined && (summaryLevel ?? "all") === "all";
    expect(readyBefore).toBe(true); // → «0 palabras» на 23 плитках из 23
    expect(readyNow).toBe(false); // → заглушка
  });
});

const IDIOMS_DICT: IdiomsDict = {
  premiumTierBadge: "Solo Premium",
  locale: "es",
  listenLabel: "Escuchar",
  literalTranslationLabel: "Literal",
  spanishEquivalentLabel: "Equivalente",
  explanationLabel: "Explicación",
  contextExampleLabel: "Ejemplo",
  knownButton: "Marcar",
  knownBadge: "Aprendida",
  progressLabel: "Aprendidas: {known} de {total}",
  searchPlaceholder: "Buscar",
  categoryAllLabel: "Todas",
  categoryDailyLabel: "Cotidianas",
  categoryProverbsLabel: "Refranes",
  categoryLiteraryLabel: "Literarias",
  noResultsMessage: "Sin resultados",
  paginationPrev: "Atrás",
  paginationNext: "Adelante",
  paginationInfo: "{current} de {total}",
  freeTrialLimitMessage: "límite",
  freeTrialLimitCta: "cta",
  literaryLockedMessageStandard: "premium",
  literaryUpgradeCta: "cta",
  deepLinkLockedMessage: "cerrada",
};

/** Ответ `/api/idioms`, который отдаётся ТОЛЬКО когда его отпустят: это и
 *  есть та доля секунды, которую видит человек. */
function heldIdiomsEndpoint(idioms: unknown[]) {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    if (String(input).includes("/api/idioms")) {
      await held;
      return new Response(JSON.stringify({ idioms, limited: false, literaryLocked: null, lockedTotal: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { headers: { "Content-Type": "application/json" } });
  });
  return async () => {
    release();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };
}

const bar = () => screen.queryAllByTestId("idioms-progress-skeleton").length;
const label = () => screen.queryByTestId("idioms-progress-label")?.textContent ?? null;

describe("полоса освоенного на странице идиом (долг 231)", () => {
  it("ответа ещё нет — заглушка, и «Aprendidas: 0 de 0» на экране нет", async () => {
    const release = heldIdiomsEndpoint([]);
    await act(async () => {
      render(<IdiomsList dict={IDIOMS_DICT} />);
    });
    expect(bar()).toBe(1);
    expect(label()).toBeNull();
    expect(document.body.textContent).not.toContain("Aprendidas: 0 de 0");
    await release();
  });

  it("ответ пришёл пустым — печатается честный «0 de 0»", async () => {
    const release = heldIdiomsEndpoint([]);
    await act(async () => {
      render(<IdiomsList dict={IDIOMS_DICT} />);
    });
    await release();
    expect(bar()).toBe(0);
    expect(label()).toBe("Aprendidas: 0 de 0");
  });

  it("ответ пришёл с выражениями — печатается их число", async () => {
    const release = heldIdiomsEndpoint([
      { id: "a", phrase: "п", category: "daily", level: "A1" },
      { id: "b", phrase: "в", category: "daily", level: "A1" },
    ]);
    await act(async () => {
      render(<IdiomsList dict={IDIOMS_DICT} />);
    });
    await release();
    expect(bar()).toBe(0);
    expect(label()).toBe("Aprendidas: 0 de 2");
  });
});
