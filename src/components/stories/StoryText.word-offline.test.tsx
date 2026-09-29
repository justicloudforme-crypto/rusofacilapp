import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import StoryText, { type StoryTextDict } from "./StoryText";
import es from "@/dictionaries/es.json";
import ru from "@/dictionaries/ru.json";
import { resetTranslationStoreForTests } from "@/lib/translation-store";

/**
 * ПЕРЕВОД СЛОВА БЕЗ СЕТИ — ДОЛГ 360 (заход 7.247).
 *
 * Три исхода одного нажатия, и путать их нельзя:
 *   — запрос не дошёл (нет сети)       → `translationOffline`;
 *   — сервер ответил отказом (502)      → прежняя `translationError`;
 *   — слово уже переведено (кеш вкладки) → перевод, без запроса вовсе.
 * Второй исход — позитивный контроль первого: без него «новый текст на
 * экране» мог бы значить, что новый текст стоит на ЛЮБОЙ ошибке.
 */

const dict: StoryTextDict = {
  translationLoading: "…",
  translationError: es.stories.translationError,
  translationOffline: es.stories.translationOffline,
  wordListenLabel: "Escuchar palabra",
  wordStressDependsOnMeaning: "El acento depende del sentido",
  closeLabel: "Cerrar",
  playLabel: "Escuchar el texto",
  pauseLabel: "Pausar lectura",
  skipBackLabel: "Retroceder 15 segundos",
  skipForwardLabel: "Avanzar 15 segundos",
  seekLabel: "Ir a la frase",
  completedBadge: "Leído",
};

/** Как отвечает `/api/dictionary/translate` в этом тесте. */
let dictionary: "offline" | "server-error" | "ok";

beforeEach(() => {
  resetTranslationStoreForTests();
  dictionary = "ok";
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private readonly cb: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.cb([{ target, isIntersecting: true } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const href = String(url);
      if (href.startsWith("/api/word-audio")) return new Response(JSON.stringify({ audioUrl: null }), { status: 200 });
      if (href.startsWith("/api/dictionary/bank")) {
        // Банк видимого абзаца знает одно слово — оно и есть «кеш».
        return new Response(JSON.stringify({ translations: { собака: "perro" } }), { status: 200 });
      }
      if (dictionary === "offline") throw new TypeError("Failed to fetch");
      if (dictionary === "server-error") {
        return new Response(JSON.stringify({ error: "not_translated" }), { status: 502 });
      }
      return new Response(JSON.stringify({ translation: "tutor", source: "bank" }), { status: 200 });
    }),
  );
});

afterEach(() => {
  cleanup();
  resetTranslationStoreForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function draw() {
  return render(
    <StoryText
      storyId="story-1"
      audioStoryId="story-1"
      title="Репка"
      author="Народная сказка"
      paragraphs={["Мария работала репетитором. Собака бежала впереди."]}
      audioSegments={[]}
      fullAudioUrl={null}
      sentenceOffsets={null}
      dict={dict}
    />,
  );
}

const tap = (container: HTMLElement, word: string) =>
  container.querySelector<HTMLElement>(`button[data-word="${word}"]`)!.click();

describe("StoryText: перевод слова без сети (долг 360)", () => {
  it("без сети — понятный текст про интернет, а не «No se pudo traducir»", async () => {
    dictionary = "offline";
    const { container } = draw();
    tap(container, "репетитором");
    await vi.waitFor(() => expect(screen.getByText(dict.translationOffline)).toBeTruthy());
    expect(screen.queryByText(dict.translationError)).toBeNull();
  });

  it("ПОЗИТИВНЫЙ КОНТРОЛЬ: отказ СЕРВЕРА при живой сети — прежняя фраза, не «нет сети»", async () => {
    dictionary = "server-error";
    const { container } = draw();
    tap(container, "репетитором");
    await vi.waitFor(() => expect(screen.getByText(dict.translationError)).toBeTruthy());
    expect(screen.queryByText(dict.translationOffline)).toBeNull();
  });

  it("с сетью — перевод", async () => {
    const { container } = draw();
    tap(container, "репетитором");
    await vi.waitFor(() => expect(screen.getByText("tutor")).toBeTruthy());
  });

  it("без сети слово из кеша показывает перевод, а не ошибку", async () => {
    const { container } = draw();
    // Предзагрузка абзаца положила «собака» в кеш, пока сеть была.
    await vi.waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).startsWith("/api/dictionary/bank"))).toBe(true),
    );
    await new Promise((r) => setTimeout(r, 0));
    dictionary = "offline";
    tap(container, "Собака");
    await vi.waitFor(() => expect(screen.getByText("perro")).toBeTruthy());
    expect(screen.queryByText(dict.translationOffline)).toBeNull();
  });

  it("тексты: es на «tú», ru на «вы», и они не совпадают с прежней фразой", () => {
    expect(es.stories.translationOffline).toBe("Sin conexión: para traducir palabras necesitas internet.");
    expect(ru.stories.translationOffline).toBe("Нет подключения: для перевода слов нужен интернет.");
    expect(es.stories.translationOffline).not.toBe(es.stories.translationError);
    expect(ru.stories.translationOffline).not.toBe(ru.stories.translationError);
  });
});
