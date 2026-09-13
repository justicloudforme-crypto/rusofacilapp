import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import StoryText, { type StoryTextDict } from "./StoryText";
import type { StoryAudioSegment } from "@/lib/stories";

/**
 * ДОЛГ 158 — «два голоса при тапе на слово во время чтения».
 *
 * ЧТО ПЕРЕМЕРЕНО 13.09.2026, ДО ПРАВКИ. Тап по слову сам по себе звука
 * НЕ ЗАПУСКАЕТ: карточка показывает перевод и кнопку 🔊, а клип звучит
 * только по нажатию на неё (`SpeakButton.speak`). Поэтому на видеозаписи
 * владельца наложения нет ни разу — и это не опровержение жалобы, а
 * уточнение её причины: два голоса встречаются на ВТОРОМ действии, когда
 * 🔊 нажимают при играющем рассказе. Числа стенда до правки: одновременно
 * играющих дорожек **2**, `pause()` у рассказа — **0 раз**.
 *
 * РЕШЕНИЕ ВЛАДЕЛЬЦА 13.09.2026, реализуется здесь: нажатие на слово
 * ставит рассказ на паузу, звучит слово, затем рассказ продолжается с
 * того же места.
 *
 * Правило заперто с обеих сторон: одновременно играющих дорожек НИКОГДА
 * не больше одной, и рассказ обязан ВЕРНУТЬСЯ — иначе лечение молчанием
 * было бы хуже болезни.
 */

const dict: StoryTextDict = {
  translationLoading: "…",
  translationError: "!",
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

/** Прибор: кто из дорожек сейчас играет, и сколько их было одновременно. */
let playingNow: Set<HTMLMediaElement>;
let maxConcurrent: number;
let storyPauses: number;
let storyPlays: number;

const isStoryTrack = (el: HTMLMediaElement) => el.src.includes("blob.example/0-");

beforeEach(() => {
  playingNow = new Set();
  maxConcurrent = 0;
  storyPauses = 0;
  storyPlays = 0;
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    playingNow.add(this);
    maxConcurrent = Math.max(maxConcurrent, playingNow.size);
    if (isStoryTrack(this)) storyPlays++;
    return Promise.resolve();
  });
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    playingNow.delete(this);
    if (isStoryTrack(this)) storyPauses++;
  });
  // `paused` в jsdom не следует за нашими заглушками — подставляем сами,
  // иначе SpeakButton посчитает уже играющий клип паузой.
  Object.defineProperty(window.HTMLMediaElement.prototype, "paused", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return !playingNow.has(this);
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) =>
      String(url).startsWith("/api/word-audio")
        ? new Response(JSON.stringify({ audioUrl: "https://blob.example/word.mp3" }), { status: 200 })
        : new Response(JSON.stringify({ translation: "año" }), { status: 200 }),
    ),
  );
});

afterEach(() => {
  cleanup();
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

describe("StoryText: тап по слову во время чтения (долг 158)", () => {
  // ПОЗИТИВНЫЙ КОНТРОЛЬ ПРИБОРА. Все утверждения ниже держатся на счётчике
  // `maxConcurrent`. Пока не показано, что он УМЕЕТ увидеть наложение,
  // «наложений 0» не значит ничего — это может быть и слепота счётчика.
  // Здесь два звука пускаются нарочно, мимо продукта.
  it("подсадка: прибор видит наложение, когда оно есть", () => {
    const a = new Audio("https://blob.example/0-0.mp3");
    const b = new Audio("https://blob.example/word.mp3");
    void a.play();
    void b.play();
    expect(maxConcurrent).toBe(2);
    expect(storyPlays).toBe(1);
  });

  it("тап по слову САМ ПО СЕБЕ звука не запускает — причина жалобы не в нём", async () => {
    const { container } = draw();
    container.querySelector<HTMLElement>('button[data-word="года"]')!.click();
    await vi.waitFor(() => expect(screen.getByTestId("translation-popover")).toBeTruthy());
    expect(playingNow.size).toBe(0);
  });

  it("тап по слову ВО ВРЕМЯ чтения ставит рассказ на паузу", async () => {
    const { container } = draw();
    screen.getByLabelText(dict.playLabel).click();
    await vi.waitFor(() => expect(playingNow.size).toBe(1));
    container.querySelector<HTMLElement>('button[data-word="года"]')!.click();
    await vi.waitFor(() => expect(screen.getByTestId("translation-popover")).toBeTruthy());
    expect(storyPauses).toBeGreaterThan(0);
    expect(playingNow.size).toBe(0);
  });

  it("слово и рассказ НИКОГДА не звучат вместе, и рассказ возвращается", async () => {
    const { container } = draw();
    screen.getByLabelText(dict.playLabel).click();
    await vi.waitFor(() => expect(playingNow.size).toBe(1));
    const playsBefore = storyPlays;

    container.querySelector<HTMLElement>('button[data-word="года"]')!.click();
    await vi.waitFor(() => expect(screen.getByLabelText(dict.wordListenLabel)).toBeTruthy());
    screen.getByLabelText(dict.wordListenLabel).click();
    await vi.waitFor(() => expect(playingNow.size).toBe(1));

    // Главное число долга: одновременно играющих дорожек не больше одной.
    expect(maxConcurrent).toBe(1);

    // Клип слова кончился — рассказ обязан продолжиться сам. В живом
    // браузере `ended` означает, что дорожка УЖЕ не играет, поэтому
    // прибор снимает её со счёта до события, а не после: иначе он
    // насчитал бы наложение там, где его нет.
    const wordClip = [...playingNow][0];
    playingNow.delete(wordClip);
    wordClip.dispatchEvent(new Event("ended"));
    await vi.waitFor(() => expect(storyPlays).toBeGreaterThan(playsBefore));
    expect(maxConcurrent).toBe(1);
  });

  it("возврат переживает отказ озвучки слова: закрыли карточку — рассказ продолжился", async () => {
    const { container } = draw();
    screen.getByLabelText(dict.playLabel).click();
    await vi.waitFor(() => expect(playingNow.size).toBe(1));
    const playsBefore = storyPlays;
    container.querySelector<HTMLElement>('button[data-word="года"]')!.click();
    await vi.waitFor(() => expect(screen.getByTestId("translation-popover")).toBeTruthy());
    screen.getByLabelText(dict.closeLabel).click();
    await vi.waitFor(() => expect(storyPlays).toBeGreaterThan(playsBefore));
    expect(maxConcurrent).toBe(1);
  });

  it("негативный контроль: рассказ НЕ играл — тап ничего не запускает и не возобновляет", async () => {
    const { container } = draw();
    container.querySelector<HTMLElement>('button[data-word="года"]')!.click();
    await vi.waitFor(() => expect(screen.getByTestId("translation-popover")).toBeTruthy());
    screen.getByLabelText(dict.closeLabel).click();
    expect(storyPlays).toBe(0);
    expect(playingNow.size).toBe(0);
  });
});
