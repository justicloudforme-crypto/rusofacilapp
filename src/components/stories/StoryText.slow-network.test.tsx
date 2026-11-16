import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import StoryText, { type StoryTextDict } from "./StoryText";
import type { StoryAudioSegment } from "@/lib/stories";
import { resetTranslationStoreForTests } from "@/lib/translation-store";
import es from "@/dictionaries/es.json";

/**
 * ТАП ПО СЛОВУ НА МЕДЛЕННОЙ СЕТИ — долги 172 и 160, заход 7.285.
 *
 * 172. До 7.285 каждый тап спрашивал `/api/word-audio` заново: три тапа по
 *      одному слову — три запроса, и на Slow 3G каждый повтор ждал звука
 *      ≈2,1 с. Теперь повтор берёт ответ из памяти вкладки. Омограф — по
 *      МЕСТУ, а не по слову: ключ без места отдал бы чужое ударение.
 * 160. До 7.285 у запроса перевода не было срока: оборванное соединение
 *      оставляло «Перевод…» навсегда. Теперь через 3 с — «сеть медленная»,
 *      через 12 с — сообщение и кнопка «ещё раз».
 *
 * Позитивный контроль 16.11.2026: этот файл на `StoryText.tsx` из `main`
 * (до 7.285) — 8 красных из 10; зелёные там только «ответ раньше 3 с» и
 * «строки на обоих языках». На новом коде — 10 из 10.
 */

const dict: StoryTextDict = {
  translationLoading: es.stories.translationLoading,
  translationError: es.stories.translationError,
  translationOffline: es.stories.translationOffline,
  translationSlow: es.stories.translationSlow,
  translationTimeout: es.stories.translationTimeout,
  translationRetry: es.stories.translationRetry,
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

// «замок» — омограф (список `story-word-pick.ts`), стоит дважды.
const paragraphs = ["Дед видит замок. Дед открыл замок ключом."];
const segments: StoryAudioSegment[] = [
  { paragraphIndex: 0, sentenceIndex: 0, url: "https://blob.example/0-0.mp3", durationSeconds: 3 },
  { paragraphIndex: 0, sentenceIndex: 1, url: "https://blob.example/0-1.mp3", durationSeconds: 3 },
];

let calls: string[];
const countOf = (prefix: string) => calls.filter((url) => url.startsWith(prefix)).length;
type Translate = (href: string, init?: RequestInit) => Promise<Response>;
let translate: Translate;
let wordAudioFails = false;

/** Как настоящий `fetch`: висящий запрос отказывает по `abort()`. */
const hang: Translate = (_href, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });

beforeEach(() => {
  resetTranslationStoreForTests();
  calls = [];
  wordAudioFails = false;
  translate = async (href) => {
    const word = new URL(href, "https://x").searchParams.get("word");
    return new Response(JSON.stringify({ translation: `es:${word}` }), { status: 200 });
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      const href = String(url);
      calls.push(href);
      if (href.startsWith("/api/word-audio")) {
        if (wordAudioFails) throw new TypeError("Failed to fetch");
        const word = new URL(href, "https://x").searchParams.get("word");
        const at = new URL(href, "https://x").searchParams.get("at");
        return new Response(JSON.stringify({ word, audioUrl: `https://blob.example/w/${word}-${at}.mp3` }), { status: 200 });
      }
      if (href.startsWith("/api/dictionary/bank")) {
        return new Response(JSON.stringify({ translations: {} }), { status: 200 });
      }
      return translate(href, init);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetTranslationStoreForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function draw() {
  return render(
    <StoryText
      storyId="story-1"
      audioStoryId="story-1"
      title="Замок"
      author="—"
      paragraphs={paragraphs}
      audioSegments={segments}
      fullAudioUrl={null}
      sentenceOffsets={null}
      dict={dict}
    />,
  );
}

const words = (container: HTMLElement, word: string) =>
  [...container.querySelectorAll<HTMLElement>(`button[data-word="${word}"]`)];
const listenButton = () => screen.getByLabelText(dict.wordListenLabel);
const closeCard = () => screen.getByTestId("translation-popover-close").click();

describe("долг 172: повторный тап по слову не спрашивает озвучку заново", () => {
  it("три тапа по одному слову — один запрос /api/word-audio, и кнопка звучит каждый раз", async () => {
    const { container } = draw();
    for (let i = 0; i < 3; i++) {
      words(container, "Дед")[0].click();
      await vi.waitFor(() => expect(listenButton().getAttribute("aria-disabled")).toBeNull());
      closeCard();
    }
    expect(countOf("/api/word-audio")).toBe(1);
  });

  it("то же слово в другом предложении — тоже без запроса", async () => {
    const { container } = draw();
    words(container, "Дед")[0].click();
    await vi.waitFor(() => expect(listenButton().getAttribute("aria-disabled")).toBeNull());
    closeCard();
    words(container, "Дед")[1].click();
    await vi.waitFor(() => expect(listenButton().getAttribute("aria-disabled")).toBeNull());
    expect(countOf("/api/word-audio")).toBe(1);
  });

  it("ОМОГРАФ: два места — два запроса, каждый со своим местом (чужое ударение запрещено)", async () => {
    const { container } = draw();
    const [first, second] = words(container, "замок");
    first.click();
    await vi.waitFor(() => expect(countOf("/api/word-audio")).toBe(1));
    closeCard();
    second.click();
    await vi.waitFor(() => expect(countOf("/api/word-audio")).toBe(2));
    const places = calls.filter((u) => u.startsWith("/api/word-audio")).map((u) => new URL(u, "https://x").searchParams.get("at"));
    expect(places[0]).not.toBe(places[1]);
    // Повтор ТОГО ЖЕ места — уже из памяти.
    closeCard();
    first.click();
    await vi.waitFor(() => expect(listenButton().getAttribute("aria-disabled")).toBeNull());
    expect(countOf("/api/word-audio")).toBe(2);
  });

  it("отказ сети не запоминается: следующий тап спрашивает снова", async () => {
    wordAudioFails = true;
    const { container } = draw();
    words(container, "Дед")[0].click();
    await vi.waitFor(() => expect(countOf("/api/word-audio")).toBe(1));
    // Отказ должен успеть прийти: до этого второй тап честно делит тот же
    // запрос в пути.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    closeCard();
    wordAudioFails = false;
    words(container, "Дед")[0].click();
    await vi.waitFor(() => expect(listenButton().getAttribute("aria-disabled")).toBeNull());
    expect(countOf("/api/word-audio")).toBe(2);
  });

  it("файл клипа начинает качаться сразу, как стал известен адрес", async () => {
    // `Audio` в jsdom — фабрика, подкласс не перехватить; следим за
    // установкой адреса у самого элемента.
    const created: string[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src")!;
    vi.spyOn(HTMLMediaElement.prototype, "src", "set").mockImplementation(function (this: HTMLMediaElement, value: string) {
      created.push(value);
      descriptor.set!.call(this, value);
    });
    const { container } = draw();
    words(container, "Дед")[0].click();
    await vi.waitFor(() => expect(created.some((u) => u.includes("/w/"))).toBe(true));
  });
});

describe("долг 160: «Traduciendo…» не висит вечно", () => {
  it("медленно → через 3 с подпись о медленной сети, через 12 с отказ и «ещё раз», повтор переводит", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    translate = hang;
    const { container } = draw();
    await act(async () => {
      words(container, "ключом")[0].click();
    });
    const text = () => screen.getByTestId("translation-popover").querySelector("p")?.textContent;
    expect(text()).toBe(dict.translationLoading);

    await act(() => vi.advanceTimersByTimeAsync(3100));
    expect(text()).toBe(dict.translationSlow);
    expect(screen.queryByTestId("translation-retry")).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(9000));
    expect(text()).toBe(dict.translationTimeout);
    expect(screen.getByTestId("translation-retry").textContent).toBe(dict.translationRetry);

    // Сеть ожила — «ещё раз» переводит, не закрывая карточку.
    translate = async () => new Response(JSON.stringify({ translation: "con la llave" }), { status: 200 });
    await act(async () => {
      fireEvent.click(screen.getByTestId("translation-retry"));
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(text()).toBe("con la llave");
    expect(screen.queryByTestId("translation-retry")).toBeNull();
    expect(countOf("/api/dictionary/translate")).toBe(2);
  });

  it("нормальный ответ раньше 3 с подписи о медленной сети не показывает", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { container } = draw();
    await act(async () => {
      words(container, "ключом")[0].click();
      await vi.advanceTimersByTimeAsync(10);
    });
    await act(() => vi.advanceTimersByTimeAsync(15000));
    expect(screen.getByTestId("translation-popover").querySelector("p")?.textContent).toBe("es:ключом");
    expect(screen.queryByTestId("translation-retry")).toBeNull();
  });

  it("обрыв (нет сети) — сообщение и «ещё раз»", async () => {
    translate = async () => {
      throw new TypeError("Failed to fetch");
    };
    const { container } = draw();
    words(container, "ключом")[0].click();
    await vi.waitFor(() => expect(screen.getByText(dict.translationOffline)).toBeTruthy());
    expect(screen.getByTestId("translation-retry")).toBeTruthy();
  });

  it("ответ, приехавший после закрытия карточки, в новую карточку не пишется", async () => {
    let release: (r: Response) => void = () => {};
    translate = () => new Promise((resolve) => (release = resolve));
    const { container } = draw();
    words(container, "ключом")[0].click();
    await vi.waitFor(() => expect(countOf("/api/dictionary/translate")).toBe(1));
    closeCard();
    translate = async () => new Response(JSON.stringify({ translation: "abre" }), { status: 200 });
    words(container, "открыл")[0].click();
    await vi.waitFor(() => expect(screen.getByText("abre")).toBeTruthy());
    await act(async () => release(new Response(JSON.stringify({ translation: "ЧУЖОЕ" }), { status: 200 })));
    expect(screen.queryByText("ЧУЖОЕ")).toBeNull();
  });

  it("строки на обоих языках есть и различаются", async () => {
    const ru = (await import("@/dictionaries/ru.json")).default;
    for (const d of [es.stories, ru.stories]) {
      for (const key of ["translationSlow", "translationTimeout", "translationRetry"] as const) {
        expect(d[key]).toBeTruthy();
      }
      expect(d.translationTimeout).not.toBe(d.translationOffline);
      expect(d.translationSlow).not.toBe(d.translationLoading);
    }
  });
});
