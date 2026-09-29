import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import StoryText, { type StoryTextDict } from "./StoryText";
import type { StoryAudioSegment } from "@/lib/stories";
import { saveStoryProgress } from "@/lib/reading-progress";
import { clearNativeMediaSession, setNativePlaybackState } from "@/lib/native-media-session";

/**
 * ЗАХОД 7.240, ЗАДАЧИ 2 И 5 — плеер рассказа говорит правду.
 *
 * Что видел владелец (видео 28.09, POCO 1.0.11): ушёл с рассказа в
 * «Mi perfil» — в шторке осталась полоса без кнопок; вернулся — «▶» и
 * пустая шкала. Замер на эмуляторе: после ухода шторка `PLAYING`,
 * `actions=0`, время бежит. И отдельно: если элемент остановил не наш
 * код, кнопка оставалась «⏸».
 *
 * У каждого правила — обе стороны: состояние ДО события (вызова нет,
 * кнопка прежняя) и ПОСЛЕ (вызов есть, кнопка сменилась). Сравнение
 * «до/после» на пустых выборках здесь упало бы: до события проверяется,
 * что нужного вызова ещё НЕТ.
 */

vi.mock("@/lib/native-media-session", () => ({
  setNativeMediaMetadata: vi.fn(async () => {}),
  setNativePlaybackState: vi.fn(async () => {}),
  setNativeActionHandler: vi.fn(async () => {}),
  setNativeSeekToHandler: vi.fn(async () => {}),
  setNativePositionState: vi.fn(async () => {}),
  clearNativeMediaSession: vi.fn(async () => {}),
  nativeArtworkSrc: vi.fn(async () => "data:image/png;base64,AAAA"),
}));

const dict: StoryTextDict = {
  translationLoading: "…",
  translationError: "!",
  translationOffline: "!",
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

const paragraphs = [
  "Дети сидят за одним большим столом. У каждого ребёнка лист бумаги!",
  "Соня складывает журавлика, а потом — лягушку?",
];

const segments: StoryAudioSegment[] = [
  { paragraphIndex: 0, sentenceIndex: 0, url: "https://blob.example/0-0.mp3", durationSeconds: 4 },
  { paragraphIndex: 0, sentenceIndex: 1, url: "https://blob.example/0-1.mp3", durationSeconds: 4 },
  { paragraphIndex: 1, sentenceIndex: 0, url: "https://blob.example/1-0.mp3", durationSeconds: 4 },
];

function draw() {
  return render(
    <StoryText
      storyId="story-truth"
      audioStoryId="story-truth"
      title="Кружок оригами"
      author="RusoFácil (relato original)"
      paragraphs={paragraphs}
      audioSegments={segments}
      fullAudioUrl={null}
      sentenceOffsets={null}
      dict={dict}
    />,
  );
}

const playButton = () => document.querySelector<HTMLButtonElement>('[data-rf-player="play"]')!;
const audioEl = () => document.querySelector("audio")!;

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.mocked(clearNativeMediaSession).mockClear();
  vi.mocked(setNativePlaybackState).mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("шторка гаснет вместе со звуком", () => {
  it("уход со страницы (размонтирование) убирает карточку из шторки", () => {
    const view = draw();
    fireEvent.click(playButton());
    expect(vi.mocked(clearNativeMediaSession)).not.toHaveBeenCalled();
    view.unmount();
    expect(vi.mocked(clearNativeMediaSession)).toHaveBeenCalledTimes(1);
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("смерть документа (pagehide — перезагрузка, переход в копию без сети) тоже", () => {
    draw();
    expect(vi.mocked(clearNativeMediaSession)).not.toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(vi.mocked(clearNativeMediaSession)).toHaveBeenCalledTimes(1);
  });
});

describe("кнопка верит самому элементу <audio>", () => {
  it("чужая пауза (система забрала звук) переводит кнопку в «▶» и шторку в паузу", () => {
    draw();
    fireEvent.click(playButton());
    expect(playButton().getAttribute("aria-label")).toBe(dict.pauseLabel);
    vi.mocked(setNativePlaybackState).mockClear();
    act(() => {
      audioEl().dispatchEvent(new Event("pause"));
    });
    expect(playButton().getAttribute("aria-label")).toBe(dict.playLabel);
    expect(vi.mocked(setNativePlaybackState)).toHaveBeenCalledWith(false);
  });

  it("конец клипа между предложениями — не пауза: кнопка остаётся «⏸»", () => {
    draw();
    fireEvent.click(playButton());
    Object.defineProperty(audioEl(), "ended", { configurable: true, get: () => true });
    act(() => {
      audioEl().dispatchEvent(new Event("pause"));
    });
    expect(playButton().getAttribute("aria-label")).toBe(dict.pauseLabel);
  });

  it("чужой запуск переводит кнопку в «⏸»", () => {
    draw();
    expect(playButton().getAttribute("aria-label")).toBe(dict.playLabel);
    act(() => {
      audioEl().dispatchEvent(new Event("play"));
    });
    expect(playButton().getAttribute("aria-label")).toBe(dict.pauseLabel);
  });
});

describe("возврат на страницу — настоящее место", () => {
  it("шкала показывает сохранённое место, «▶» продолжает с него", () => {
    saveStoryProgress("story-truth", { currentPage: 2, totalPages: 3, queueIndex: 1 });
    draw();
    const bar = document.querySelector<HTMLElement>('[data-rf-player="bar"]')!;
    // 2 из 3 предложений — а не пустая шкала, как на видео владельца.
    expect(bar.style.width).toBe(`${(2 / 3) * 100}%`);
    fireEvent.click(playButton());
    expect(audioEl().getAttribute("src") ?? audioEl().src).toContain("0-1.mp3");
  });

  it("контроль: без сохранённого места шкала пуста и «▶» начинает с первого", () => {
    draw();
    const bar = document.querySelector<HTMLElement>('[data-rf-player="bar"]')!;
    expect(bar.style.width).toBe("0%");
    fireEvent.click(playButton());
    expect(audioEl().src).toContain("0-0.mp3");
  });
});

describe("задача 5: знак препинания не отрывается от слова", () => {
  it("«столом.» — слово и точка в одном неразрывном блоке, номера токенов прежние", () => {
    draw();
    const word = screen.getByText("столом", { selector: "button" });
    const glue = word.closest("[data-rf-glued]");
    expect(glue).not.toBeNull();
    expect(glue!.className).toContain("whitespace-nowrap");
    expect(glue!.textContent).toBe("столом.");
    // «Дети сидят за одним большим столом.»: слова идут через токен-пробел,
    // «столом» — 11-й токен (0..10), как у вырезки омографа.
    expect(word.getAttribute("data-token")).toBe("10");
    // Во всём тексте нет «слово ␠знак».
    expect(document.body.textContent).not.toMatch(/[а-яё] [.,!?:;]/i);
  });

  it("контроль: пробел между словами остаётся, склеиваются только знаки", () => {
    draw();
    const word = screen.getByText("журавлика", { selector: "button" });
    expect(word.closest("[data-rf-glued]")!.textContent).toBe("журавлика,");
    const next = screen.getByText("лягушку", { selector: "button" });
    expect(next.closest("[data-rf-glued]")!.textContent).toBe("лягушку?");
    const plain = screen.getByText("Дети", { selector: "button" });
    expect(plain.closest("[data-rf-glued]")).toBeNull();
  });
});
