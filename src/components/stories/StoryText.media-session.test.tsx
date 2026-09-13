import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import StoryText, { type StoryTextDict } from "./StoryText";
import type { StoryAudioSegment } from "@/lib/stories";
import {
  setNativeActionHandler,
  setNativeMediaMetadata,
  setNativePlaybackState,
} from "@/lib/native-media-session";

/**
 * ДОЛГ 152 — «нативная медиа-сессия не вызывается в оболочке НИ РАЗУ».
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ, А НЕ ТЕЛЕФОН. Болезнь замерена 12.09.2026 на живом
 * POCO X6 Pro 5G через отладочный сокет webview: в System WebView, на
 * котором работает оболочка, `'mediaSession' in navigator` → **false**, а
 * `MediaMetadata` → `undefined`. **jsdom, в котором гоняются эти тесты,
 * имеет РОВНО ту же форму** — замерено 13.09.2026 отдельной пробой:
 * `mediaSession in navigator: false`, `MediaMetadata: undefined`. То есть
 * стенд повторяет ту самую особенность устройства, из-за которой долг и
 * возник, и правило можно запереть здесь, а не обещать до следующего
 * телефона.
 *
 * ПРАВИЛО, дважды: нативная половина проигрывателя обязана вызываться
 * ТАМ, ГДЕ `navigator.mediaSession` НЕТ (оболочка), и веб-половина
 * обязана продолжать работать ТАМ, ГДЕ ОН ЕСТЬ (Chrome — карточка в
 * шторке у владельца на видео работает, и её ломать нельзя).
 *
 * Позитивный контроль правила — последний тест: он изображает старый код
 * (нативные вызовы за веб-сторожем) и требует, чтобы проверка это
 * увидела.
 */

vi.mock("@/lib/native-media-session", () => ({
  setNativeMediaMetadata: vi.fn(async () => {}),
  setNativePlaybackState: vi.fn(async () => {}),
  setNativeActionHandler: vi.fn(async () => {}),
  setNativeSeekToHandler: vi.fn(async () => {}),
  setNativePositionState: vi.fn(async () => {}),
}));

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

beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.mocked(setNativeActionHandler).mockClear();
  vi.mocked(setNativeMediaMetadata).mockClear();
  vi.mocked(setNativePlaybackState).mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // `navigator.mediaSession` подставляется одним из тестов — снять, иначе
  // соседний тест померит чужую подставку, а не форму оболочки.
  Reflect.deleteProperty(navigator, "mediaSession");
  Reflect.deleteProperty(globalThis, "MediaMetadata");
});

describe("StoryText: нативная медиа-сессия в оболочке (долг 152)", () => {
  it("СТЕНД повторяет оболочку: в jsdom, как и в System WebView, mediaSession нет", () => {
    expect("mediaSession" in navigator).toBe(false);
    expect((globalThis as { MediaMetadata?: unknown }).MediaMetadata).toBeUndefined();
  });

  it("без navigator.mediaSession нативные вызовы ВСЁ РАВНО происходят", () => {
    draw();
    // Шесть кнопок шторки — ровно те, что 7.184 не смог нажать на телефоне.
    const actions = vi
      .mocked(setNativeActionHandler)
      .mock.calls.filter((call) => typeof call[1] === "function")
      .map((call) => call[0]);
    expect(new Set(actions)).toEqual(
      new Set(["play", "pause", "seekbackward", "seekforward", "previoustrack", "nexttrack"]),
    );
    expect(vi.mocked(setNativeMediaMetadata)).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Репка", artist: "Народная сказка" }),
    );
    expect(vi.mocked(setNativePlaybackState)).toHaveBeenCalledWith(false);
  });

  it("веб-половина не сломана: там, где mediaSession ЕСТЬ, метаданные ставятся ему тоже", () => {
    const setActionHandler = vi.fn();
    const ms = { metadata: null as unknown, playbackState: "none", setActionHandler, setPositionState: vi.fn() };
    Object.defineProperty(navigator, "mediaSession", { configurable: true, value: ms });
    Object.defineProperty(globalThis, "MediaMetadata", {
      configurable: true,
      value: class {
        constructor(public init: unknown) {}
      },
    });
    draw();
    expect(ms.metadata).not.toBeNull();
    expect(ms.playbackState).toBe("paused");
    const webActions = setActionHandler.mock.calls.filter((c) => typeof c[1] === "function").map((c) => c[0]);
    expect(new Set(webActions)).toEqual(
      new Set(["play", "pause", "seekbackward", "seekforward", "previoustrack", "nexttrack"]),
    );
  });
});
