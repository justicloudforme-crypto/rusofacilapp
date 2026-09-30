import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NativeBackButtonHandler from "@/components/NativeBackButtonHandler";
import WordGamePlayer from "./WordGamePlayer";
import type { PublicPuzzle } from "@/lib/word-games/data";

/**
 * «НАЗАД» НА ЛИСТЕ «¡PUZLE RESUELTO!» — заход 7.255, долг 366.
 *
 * Замер 7.251 (эмулятор, vc14): кроссворд A1/1 решён, лист итога открыт,
 * одно «Назад» → лист закрыт И адрес `/es/word-games/CROSSWORD/A1/1` →
 * `/es/word-games`. Причина: «Назад» закрывает верхний слой его же
 * `onClose`, а у листа итога пазла `onClose` был `backToList`
 * (`router.push`). Здесь — настоящий обработчик «Назад», настоящий
 * `WordGamePlayer` с настоящим листом; подменены мост Capacitor, роутер
 * (шпион) и доски (кнопка «решить»).
 *
 * Позитивный контроль — в том же тесте: кнопка листа «← Volver…» ведёт к
 * списку, то есть шпион роутера перехват видит. На коде до правки первый
 * тест падает на «router.push вызван» (замер — PROGRESS.md, 7.255).
 */
const { listeners, push } = vi.hoisted(() => ({
  listeners: {} as Record<string, (e: { canGoBack: boolean }) => void>,
  push: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: (event: string, cb: (e: { canGoBack: boolean }) => void) => {
      listeners[event] = cb;
      return Promise.resolve({ remove: () => {} });
    },
    exitApp: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/es/word-games/CROSSWORD/A1/1", useRouter: () => ({ push }) }));
vi.mock("@/lib/reliable-post", () => ({ postReliably: () => Promise.resolve("ok") }));
vi.mock("@/lib/flashcards/summary-client", () => ({ fetchCategorySummary: () => Promise.resolve({ totalKnown: 0, availableWords: 0, premiumOnlyWords: 0, subscriptionOnlyWords: 0 }) }));
vi.mock("./CrosswordBoard", () => ({
  default: ({ onSolved }: { onSolved: () => void }) => (
    <button type="button" onClick={onSolved}>
      resolver
    </button>
  ),
}));
vi.mock("./WordSearchBoard", () => ({ default: () => null }));

/** Любая строка словаря — её имя: тексту листа важна только форма. */
const words = new Proxy({} as Record<string, string>, { get: (_t, key) => (key === "locale" ? "es" : String(key)) });
const dict = {
  ...(words as object),
  solvedTitle: "¡Puzle resuelto!",
  backToWordGames: "← Volver a los juegos de palabras",
  wordsFoundLabel: "{found} de {total}",
} as never;
const puzzle = { id: "p1", type: "CROSSWORD", words: [{ word: "дом" }] } as unknown as PublicPuzzle;

async function solve() {
  render(
    <>
      <NativeBackButtonHandler />
      <WordGamePlayer lang="es" puzzle={puzzle} dict={dict} resultDict={words as never} signedIn />
    </>,
  );
  await userEvent.click(screen.getByRole("button", { name: "resolver" }));
  expect(await screen.findByRole("dialog")).toHaveTextContent("¡Puzle resuelto!");
}

afterEach(() => push.mockReset());

describe("лист «¡Puzle resuelto!» и «Назад» Android", () => {
  it("«Назад» закрывает только лист — пазл остаётся, перехода нет", async () => {
    await solve();
    await act(async () => listeners.backButton({ canGoBack: true }));
    expect(push, "«Назад» на листе итога увёл со страницы пазла").not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog"), "лист итога не закрылся").toBeNull();
    expect(screen.getByRole("button", { name: "resolver" })).toBeInTheDocument();
  });

  it("✕ листа — тоже только закрыть", async () => {
    await solve();
    await userEvent.click(screen.getByRole("button", { name: "closeLabel" }));
    expect(push, "✕ на листе итога увёл со страницы пазла").not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("контроль: «← Volver a los juegos de palabras» ведёт к списку", async () => {
    await solve();
    await userEvent.click(screen.getByRole("button", { name: "← Volver a los juegos de palabras" }));
    expect(push).toHaveBeenCalledWith("/es/word-games");
  });
});
