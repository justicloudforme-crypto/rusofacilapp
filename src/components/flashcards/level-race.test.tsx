import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useEffect, useState } from "react";

vi.mock("@/contexts/PaywallContext", () => ({
  usePaywall: () => ({ openPaywall: () => {} }),
}));

import CategoryGrid, { type CategoryGridDict } from "./CategoryGrid";
import ContinueStrip, { type ContinueStripDict } from "./ContinueStrip";
import { NATIVE_SHELL_COOKIE, NATIVE_SHELL_COOKIE_VALUE } from "@/lib/native-shell-token";
import { flashcardCategories, type FlashcardCategory, type FlashcardLevel } from "@/lib/flashcards";
import { useCategorySummary } from "@/lib/flashcards/use-category-summary";
import {
  EMPTY_SUMMARY,
  fetchCategorySummary,
  type CategorySummaryResponse,
} from "@/lib/flashcards/summary-client";
import type { Locale } from "@/i18n/config";

/**
 * БЫСТРОЕ ПЕРЕКЛЮЧЕНИЕ УРОВНЕЙ С ЗАДЕРЖАННЫМ ПЕРВЫМ ОТВЕТОМ — 7.199, часть 1.
 *
 * Что снято на телефоне (POCO X6 Pro, APK 7.198, обе локали, гость и
 * подписчик): выбран C1 — первые полторы секунды всё верно, потом строка
 * «Продолжить» подменяется словами ЧУЖОГО разреза («молоко», «арендатор»,
 * «гибкий график») с серыми полосками вместо чисел, плашка C1 пропадает, а
 * числа на плитках превращаются в заглушки — и так не меньше 18 секунд.
 *
 * Стенд воспроизводит это БЕЗ таймеров: оба запроса задерживаются вручную и
 * отвечают в том порядке, в каком их видел владелец — сначала C1, потом
 * опоздавший ответ про «все уровни». Порядок и есть подсадка; ждать
 * настоящих полутора секунд для этого не нужно.
 *
 * ДВЕ ПОЛОВИНЫ, И ОБЕ ОБЯЗАНЫ КРАСНЕТЬ:
 *   — на нынешнем коде (`useCategorySummary`) числа принадлежат выбранному
 *     уровню и заглушек нет;
 *   — на коде ДО правки (`useRacingSummary` ниже — тот самый эффект без
 *     признака отмены, скопированный дословно) тот же стенд обязан
 *     показать чужие числа и заглушку. Это положительный контроль: не
 *     «проверка ничего не нашла», а «проверка умеет находить ровно это».
 */

// ── стенд ──────────────────────────────────────────────────────────────

interface Deferred {
  cut: string | null;
  reply: (body: Partial<CategorySummaryResponse>) => void;
  fail: () => void;
}

let pending: Deferred[] = [];

function mockSummaryEndpoint() {
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body)) as { level?: string };
      const cut = sent.level ?? null;
      return new Promise<Response>((resolve, reject) => {
        pending.push({
          cut,
          reply: (body) =>
            resolve({ ok: true, json: async () => ({ level: cut, ...body }) } as unknown as Response),
          fail: () => reject(new Error("сеть молчит")),
        });
      });
    }),
  );
}

/** Отвечает на запрос, поданный про этот разрез, и даёт React перерисоваться. */
async function answer(cut: string | null, body: Partial<CategorySummaryResponse>) {
  const hit = pending.find((p) => p.cut === cut);
  expect(hit, `запроса про разрез ${String(cut)} не было`).toBeTruthy();
  pending = pending.filter((p) => p !== hit);
  await act(async () => {
    hit!.reply(body);
    await Promise.resolve();
  });
}

async function refuse(cut: string | null) {
  const hit = pending.find((p) => p.cut === cut);
  expect(hit, `запроса про разрез ${String(cut)} не было`).toBeTruthy();
  pending = pending.filter((p) => p !== hit);
  await act(async () => {
    hit!.fail();
    await Promise.resolve();
  });
}

// ── данные двух разрезов ───────────────────────────────────────────────
// Числа взяты из боевой базы (7.195/7.196): у гостя на C1 банк 988 строк и
// ноль доступных; «все уровни» — это 5771 строка, и «Продолжить» там
// показывает совсем другие слова.

const ALL_CUT: Partial<CategorySummaryResponse> = {
  tier: "free",
  categories: Object.fromEntries(flashcardCategories.map((c) => [c, { total: 266, known: 5 }])),
  bankCategories: Object.fromEntries(flashcardCategories.map((c) => [c, { bank: 266, open: 266, locked: 0 }])),
  recent: [
    { category: "food", total: 266, known: 5, lastActivityAt: 2, lastCardId: "milk", lastCardWord: "молоко", bankTotal: 266 },
    { category: "law", total: 57, known: 2, lastActivityAt: 1, lastCardId: "tenant", lastCardWord: "арендатор", bankTotal: 57 },
  ],
  totalKnown: 7,
  availableWords: 230,
  premiumOnlyWords: 5541,
  hasAnyProgress: true,
  lockedByLevel: {},
  lockedTotal: 5541,
};

const C1_CUT: Partial<CategorySummaryResponse> = {
  tier: "free",
  categories: Object.fromEntries(flashcardCategories.map((c) => [c, { total: 0, known: 0 }])),
  bankCategories: Object.fromEntries(flashcardCategories.map((c) => [c, { bank: 51, open: 0, locked: 51 }])),
  recent: [
    { category: "work", total: 0, known: 0, lastActivityAt: 3, lastCardId: "talks", lastCardWord: "переговоры", bankTotal: 51 },
  ],
  totalKnown: 0,
  availableWords: 0,
  premiumOnlyWords: 988,
  hasAnyProgress: true,
  lockedByLevel: { C1: 988 },
  lockedTotal: 988,
};

// ── две страницы: нынешняя и дореформенная ─────────────────────────────

const GRID_DICT = (locale: Locale): CategoryGridDict => ({
  locale,
  categoryLabels: Object.fromEntries(flashcardCategories.map((c) => [c, c])) as Record<FlashcardCategory, string>,
  cardCountLabel:
    locale === "ru"
      ? { one: "{count} слово", few: "{count} слова", many: "{count} слов" }
      : { one: "{count} palabra", few: "{count} palabras", many: "{count} palabras" },
  nextLevelBadgeLabel: "→ {level}",
  premiumTierBadge: locale === "ru" ? "Только Premium" : "Solo Premium",
  subscriptionBadge: locale === "ru" ? "По подписке" : "Con suscripción",
});

const STRIP_DICT = (locale: Locale): ContinueStripDict => ({
  locale,
  continueTitle: locale === "ru" ? "Продолжить" : "Continuar",
  categoryLabels: GRID_DICT(locale).categoryLabels,
  cardCountLabel: GRID_DICT(locale).cardCountLabel,
  continueWithWord: locale === "ru" ? "Продолжить со слова «{word}»" : "Seguir con «{word}»",
});

function View({
  locale,
  levelFilter,
  onLevel,
  summaryLevel,
  summary,
}: {
  locale: Locale;
  levelFilter: FlashcardLevel | "all";
  onLevel: (next: FlashcardLevel | "all") => void;
  summaryLevel: string | null | undefined;
  summary: CategorySummaryResponse;
}) {
  return (
    <div>
      <button type="button" data-testid="pick-c1" onClick={() => onLevel("C1")}>
        C1
      </button>
      <ContinueStrip
        dict={STRIP_DICT(locale)}
        recent={summary.recent}
        ready={summaryLevel !== undefined && (summaryLevel ?? "all") === levelFilter}
        onSelectCategory={() => {}}
      />
      <CategoryGrid
        dict={GRID_DICT(locale)}
        summary={summary.categories}
        hasAnyProgress={summary.hasAnyProgress}
        levelFilter={levelFilter}
        bank={summary.bankCategories}
        summaryLevel={summaryLevel}
        tier={summary.tier}
        lockedAtLevel={levelFilter === "all" ? 0 : (summary.lockedByLevel[levelFilter] ?? 0)}
        onSelectCategory={() => {}}
      />
    </div>
  );
}

/** Нынешний словарь: разрез держит общий крючок. */
function FixedScreen({ locale }: { locale: Locale }) {
  const [levelFilter, setLevelFilter] = useState<FlashcardLevel | "all">("all");
  const { summary, summaryLevel } = useCategorySummary(levelFilter);
  return (
    <View locale={locale} levelFilter={levelFilter} onLevel={setLevelFilter} summaryLevel={summaryLevel} summary={summary} />
  );
}

/**
 * ПОДСАДКА — код ДО правки, скопированный дословно из `FlashcardsApp.tsx`
 * (и трёх его близнецов): эффект без признака отмены. Опоздавший ответ
 * перезаписывает состояние, посчитанное по текущему разрезу.
 */
function useRacingSummary(level: FlashcardLevel | "all") {
  const [state, setState] = useState<{ summary: CategorySummaryResponse; summaryLevel: string | null | undefined }>({
    summary: EMPTY_SUMMARY,
    summaryLevel: undefined,
  });
  useEffect(() => {
    void fetchCategorySummary(level).then((body) => {
      setState({ summary: body, summaryLevel: body.level });
    });
  }, [level]);
  return state;
}

function RacingScreen({ locale }: { locale: Locale }) {
  const [levelFilter, setLevelFilter] = useState<FlashcardLevel | "all">("all");
  const { summary, summaryLevel } = useRacingSummary(levelFilter);
  return (
    <View locale={locale} levelFilter={levelFilter} onLevel={setLevelFilter} summaryLevel={summaryLevel} summary={summary} />
  );
}

// ── измерители ─────────────────────────────────────────────────────────

const tiles = () => [...document.querySelectorAll("[data-testid=category-tile]")];
const tileSkeletons = () => document.querySelectorAll("[data-testid=tile-count-skeleton]");
const stripSkeletons = () => document.querySelectorAll("[data-testid=continue-count-skeleton]");
const stripText = () => document.querySelector("[data-testid=continue-strip]")?.textContent ?? "";

function enterNativeShell() {
  document.cookie = `${NATIVE_SHELL_COOKIE}=${NATIVE_SHELL_COOKIE_VALUE}; path=/`;
}
function leaveNativeShell() {
  document.cookie = `${NATIVE_SHELL_COOKIE}=; path=/; max-age=0`;
}

/** Открыть страницу, нажать C1 и ответить в порядке владельца: сначала C1,
 *  потом ОПОЗДАВШИЙ ответ про «все уровни». */
async function raceAllThenC1(Screen: (p: { locale: Locale }) => React.ReactElement, locale: Locale) {
  render(<Screen locale={locale} />);
  expect(pending).toHaveLength(1); // запрос про «все уровни» ушёл при открытии
  await act(async () => {
    fireEvent.click(screen.getByTestId("pick-c1"));
  });
  expect(pending).toHaveLength(2); // и второй, про C1
  await answer("C1", C1_CUT);
  await answer(null, ALL_CUT); // опоздавший
}

beforeEach(() => {
  pending = [];
  mockSummaryEndpoint();
  enterNativeShell();
});

afterEach(() => {
  cleanup();
  leaveNativeShell();
  vi.unstubAllGlobals();
});

for (const locale of ["es", "ru"] as const) {
  describe(`гонка разрезов, локаль /${locale}`, () => {
    it("опоздавший ответ про «все уровни» не перетирает числа C1", async () => {
      await raceAllThenC1(FixedScreen, locale);

      // Плитки: банк C1, а не 266 строк разреза «все уровни».
      expect(tiles()).toHaveLength(flashcardCategories.length);
      for (const tile of tiles()) expect(tile.getAttribute("data-bank-total")).toBe("51");
      // Ни одной заглушки — ни на плитках, ни в «Продолжить».
      expect(tileSkeletons()).toHaveLength(0);
      expect(stripSkeletons()).toHaveLength(0);
      // «Продолжить» — слово ТОГО ЖЕ разреза.
      expect(stripText()).toContain("переговоры");
      expect(stripText()).not.toContain("молоко");
      expect(stripText()).not.toContain("арендатор");
      // И плашка уровня на месте: 988 закрытых строк C1.
      expect(screen.getAllByTestId("native-locked-notice")[0].textContent).toContain("988");
    });

    // ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ: тот же стенд на коде ДО правки.
    it("подсадка (эффект без отмены) ловится: чужие слова и вечная заглушка", async () => {
      await raceAllThenC1(RacingScreen, locale);

      expect(tileSkeletons()).toHaveLength(flashcardCategories.length);
      expect(stripSkeletons()).toHaveLength(ALL_CUT.recent!.length);
      expect(stripText()).toContain("молоко");
      expect(stripText()).toContain("арендатор");
      expect(stripText()).not.toContain("переговоры");
      // Плашки уровня нет вовсе — ровно то, что пропало на видео.
      expect(screen.queryAllByTestId("native-locked-notice")).toHaveLength(0);
    });

    it("заглушка не живёт дольше одного запроса: даже отказ её снимает", async () => {
      render(<FixedScreen locale={locale} />);
      await act(async () => {
        fireEvent.click(screen.getByTestId("pick-c1"));
      });
      await refuse("C1");
      await refuse(null);
      expect(tileSkeletons()).toHaveLength(0);
    });
  });
}

describe("подписчик видит то же правило", () => {
  it("разрез C1 остаётся за C1 и у оплатившего", async () => {
    render(<FixedScreen locale="es" />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("pick-c1"));
    });
    await answer("C1", { ...C1_CUT, tier: "standard" });
    await answer(null, { ...ALL_CUT, tier: "standard" });
    for (const tile of tiles()) expect(tile.getAttribute("data-bank-total")).toBe("51");
    expect(tileSkeletons()).toHaveLength(0);
    expect(stripText()).toContain("переговоры");
  });
});

describe("в вебе числа печатаются как печатались", () => {
  it("вне оболочки заглушек нет вовсе", async () => {
    leaveNativeShell();
    render(<FixedScreen locale="ru" />);
    await answer(null, ALL_CUT);
    expect(tileSkeletons()).toHaveLength(0);
    expect(stripSkeletons()).toHaveLength(0);
  });
});
