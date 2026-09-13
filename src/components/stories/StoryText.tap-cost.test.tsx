import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import StoryText, { type StoryTextDict } from "./StoryText";
import type { StoryAudioSegment } from "@/lib/stories";
import { readCachedTranslation, resetTranslationStoreForTests } from "@/lib/translation-store";

/**
 * СКОЛЬКО ЗАПРОСОВ СТОИТ ОДИН ТАП — долг 169, заход 7.188.
 *
 * Здесь меряется не форма кода, а ЧИСЛО: сколько раз позван `fetch` и по
 * каким адресам. До 7.188 на каждый тап приходилось три запроса (два в
 * наш сервер, один наружу изнутри второго), и повтор по тому же слову
 * стоил ровно столько же.
 *
 * `/api/dictionary/bank` — адрес предзагрузки видимого абзаца; наружу он
 * не ходит никогда (это заперто в его собственном тесте). Поэтому «тап
 * стоил 0 запросов в словарь» здесь означает «и 0 знаков чужой квоты».
 */

const dict: StoryTextDict = {
  translationLoading: "…",
  translationError: "No se pudo traducir esta palabra.",
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

const paragraphs = ["Мария три года работала репетитором. Собака бежала впереди меня."];

const segments: StoryAudioSegment[] = [
  { paragraphIndex: 0, sentenceIndex: 0, url: "https://blob.example/0-0.mp3", durationSeconds: 9 },
  { paragraphIndex: 0, sentenceIndex: 1, url: "https://blob.example/0-1.mp3", durationSeconds: 4 },
];

/** Прибор: каждый запрос вкладки с разбором по адресам. */
let calls: string[];
const countOf = (prefix: string) => calls.filter((url) => url.startsWith(prefix)).length;

/** Наблюдатель видимости, которого в jsdom нет: показывает всё сразу. */
let observedTargets: Element[];
/**
 * Из наблюдаемого — только абзацы. Тот же `IntersectionObserver` в
 * `StoryText` уже занят другим делом (маячок прилипания плеера), и
 * считать его вместе с абзацами значило бы мерить не то.
 */
const observedParagraphs = () => observedTargets.filter((target) => target.querySelector("button[data-word]"));

function installIntersectionObserver() {
  observedTargets = [];
  class FakeObserver {
    constructor(private readonly cb: IntersectionObserverCallback) {}
    observe(target: Element) {
      observedTargets.push(target);
      this.cb(
        [{ target, isIntersecting: true } as unknown as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver as unknown as typeof IntersectionObserver);
}

beforeEach(() => {
  resetTranslationStoreForTests();
  calls = [];
  installIntersectionObserver();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const href = String(url);
      calls.push(href);
      if (href.startsWith("/api/word-audio")) {
        return new Response(JSON.stringify({ audioUrl: null }), { status: 200 });
      }
      if (href.startsWith("/api/dictionary/bank")) {
        // Банк знает два слова этого абзаца из девяти — то же отношение,
        // что на живой базе (32,1 % словоупотреблений).
        return new Response(JSON.stringify({ translations: { года: "año", собака: "perro" } }), { status: 200 });
      }
      return new Response(JSON.stringify({ translation: "de fuera", source: "mymemory" }), { status: 200 });
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
      paragraphs={paragraphs}
      audioSegments={segments}
      fullAudioUrl={null}
      sentenceOffsets={null}
      dict={dict}
    />,
  );
}

describe("StoryText: цена одного тапа (долг 169)", () => {
  it("ПОЗИТИВНЫЙ КОНТРОЛЬ ПРИБОРА: он видит запрос в словарь, когда тот есть", async () => {
    // Пока не показано, что счётчик УМЕЕТ увидеть запрос в
    // `/api/dictionary/translate`, число «0 запросов» не значит ничего.
    const { container } = draw();
    await vi.waitFor(() => expect(countOf("/api/dictionary/bank")).toBe(1));
    container.querySelector<HTMLElement>('button[data-word="репетитором"]')!.click();
    await vi.waitFor(() => expect(countOf("/api/dictionary/translate")).toBe(1));
  });

  it("предзагружается ТОЛЬКО видимый абзац, одним запросом и только в банк", async () => {
    draw();
    await vi.waitFor(() => expect(countOf("/api/dictionary/bank")).toBe(1));
    // Абзац в рассказе один — наблюдается один абзац. Сличается ТЕКСТ, а
    // не сам узел: React пересоздаёт узел абзаца между отрисовками, и
    // счёт узлов сказал бы про React, а не про предзагрузку.
    expect(new Set(observedParagraphs().map((target) => target.textContent)).size).toBe(1);
    expect(observedParagraphs()[0].textContent).toContain("Мария три года");
    expect(countOf("/api/dictionary/translate")).toBe(0);
    const asked = new URL(calls[0], "https://rusofacilapp.com").searchParams.get("words") ?? "";
    // Спрошены слова этого абзаца, и ни одного лишнего.
    expect(asked.split(",")).toContain("года");
    expect(asked.split(",")).toContain("собака");
  });

  it("СЛОВО ИЗ БАНКА: тап не стоит НИ ОДНОГО запроса в словарь", async () => {
    const { container } = draw();
    // Ждём не ОТПРАВКИ запроса предзагрузки, а того, что её ответ уже
    // лёг в кэш вкладки: иначе тап успел бы обогнать её.
    await vi.waitFor(() => expect(readCachedTranslation("года")).toBe("año"));
    const before = countOf("/api/dictionary");

    container.querySelector<HTMLElement>('button[data-word="года"]')!.click();
    await vi.waitFor(() => expect(screen.getByTestId("translation-popover")).toBeTruthy());
    await vi.waitFor(() => expect(screen.getByText("año")).toBeTruthy());

    // Единственный запрос тапа — озвучка слова из НАШЕГО Blob. В словарь
    // не ушло ничего, значит и наружу не ушло ничего.
    expect(countOf("/api/dictionary")).toBe(before);
    expect(countOf("/api/dictionary/translate")).toBe(0);
    expect(countOf("/api/word-audio")).toBe(1);
  });

  it("СЛОВО НЕ ИЗ БАНКА: первый тап спрашивает словарь, ВТОРОЙ — уже нет", async () => {
    const { container } = draw();
    await vi.waitFor(() => expect(countOf("/api/dictionary/bank")).toBe(1));

    container.querySelector<HTMLElement>('button[data-word="репетитором"]')!.click();
    await vi.waitFor(() => expect(screen.getByText("de fuera")).toBeTruthy());
    expect(countOf("/api/dictionary/translate")).toBe(1);

    screen.getByLabelText(dict.closeLabel).click();
    container.querySelector<HTMLElement>('button[data-word="репетитором"]')!.click();
    await vi.waitFor(() => expect(screen.getByText("de fuera")).toBeTruthy());

    // Повтор по тому же слову больше не стоит ни запроса, ни чужой квоты.
    expect(countOf("/api/dictionary/translate")).toBe(1);
  });

  it("отказ словаря показан фразой на языке ученика, а не строкой сервиса", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const href = String(url);
        calls.push(href);
        if (href.startsWith("/api/word-audio")) return new Response(JSON.stringify({ audioUrl: null }), { status: 200 });
        if (href.startsWith("/api/dictionary/bank")) return new Response(JSON.stringify({ translations: {} }), { status: 200 });
        return new Response(JSON.stringify({ error: "not_translated" }), { status: 502 });
      }),
    );
    const { container } = draw();
    container.querySelector<HTMLElement>('button[data-word="репетитором"]')!.click();
    await vi.waitFor(() => expect(screen.getByText(dict.translationError)).toBeTruthy());
    expect(screen.queryByText(/MYMEMORY/i)).toBeNull();
  });
});
