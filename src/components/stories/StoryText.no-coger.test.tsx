import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import StoryText, { type StoryTextDict } from "./StoryText";
import type { StoryAudioSegment } from "@/lib/stories";
import { cacheTranslation, resetTranslationStoreForTests } from "@/lib/translation-store";

/**
 * «coger» НЕ ПОКАЗЫВАЕТСЯ В КАРТОЧКЕ СЛОВА, ДАЖЕ ИЗ СТАРЫХ КОПИЙ (7.320).
 *
 * Ответ `/api/dictionary/translate` лежит на грани Vercel до 7 дней, в
 * браузере сутки, в кеше воркера и в памяти вкладки. Всё, что легло туда до
 * фильтра на сервере, приходит со старым «cogió» — карточка обязана
 * показать «agarró». Здесь `fetch` нарочно отдаёт НЕфильтрованный ответ:
 * так выглядит старая копия.
 */

const dict: StoryTextDict = {
  translationLoading: "…",
  translationError: "No se pudo traducir esta palabra.",
  translationOffline: "Sin conexión: para traducir palabras necesitas internet.",
  translationSlow: "slow",
  translationTimeout: "timeout",
  translationRetry: "retry",
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

/** Что «отдаёт кеш грани» на адрес перевода — старая копия до фильтра. */
let upstreamTranslation = "cogió";

/** Прибор: каждый запрос вкладки с разбором по адресам. */
let calls: string[];
const countOf = (prefix: string) => calls.filter((url) => url.startsWith(prefix)).length;

/** Наблюдатель видимости, которого в jsdom нет: показывает всё сразу. */
let observedTargets: Element[];

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
      return new Response(JSON.stringify({ translation: upstreamTranslation, source: "mymemory" }), { status: 200 });
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

describe("StoryText: «coger» из старых копий перевода (7.320)", () => {
  it("ответ сети «cogió» → карточка «agarró», и в память вкладки ложится чистое", async () => {
    upstreamTranslation = "cogió";
    const { container } = draw();
    await vi.waitFor(() => expect(countOf("/api/dictionary/bank")).toBe(1));
    container.querySelector<HTMLElement>('button[data-word="репетитором"]')!.click();
    await screen.findByText("agarró");
    expect(screen.queryByText(/cog/i)).toBeNull();
  });

  it("память вкладки со старым «Lo cojo.» → карточка «Lo agarro.» без запроса", async () => {
    cacheTranslation("репетитором", "Lo cojo.");
    const { container } = draw();
    await vi.waitFor(() => expect(countOf("/api/dictionary/bank")).toBe(1));
    container.querySelector<HTMLElement>('button[data-word="репетитором"]')!.click();
    await screen.findByText("Lo agarro.");
    expect(countOf("/api/dictionary/translate")).toBe(0);
    expect(screen.queryByText(/coj/i)).toBeNull();
  });

  it("контроль прибора: обычный перевод показывается как есть", async () => {
    upstreamTranslation = "recogió";
    const { container } = draw();
    await vi.waitFor(() => expect(countOf("/api/dictionary/bank")).toBe(1));
    container.querySelector<HTMLElement>('button[data-word="репетитором"]')!.click();
    await screen.findByText("recogió");
  });
});
