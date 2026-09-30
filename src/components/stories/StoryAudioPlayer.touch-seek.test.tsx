import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import StoryAudioPlayer from "./StoryAudioPlayer";

/**
 * ПЕРЕМОТКА ПАЛЬЦЕМ ПО ПОЛОСКЕ — ЗАХОД 7.254.
 *
 * 7.253 (долг 362) отключил палец совсем: невидимый ползунок перематывал
 * на каждом шаге движения, и палец держащей руки уводил рассказ лесенкой
 * в ноль. Решение владельца 30.09.2026: перемотка пальцем нужна. Теперь
 * жестом правит `seekGestureStep` — и здесь обе стороны правила на живом
 * компоненте: тап и перетаскивание перематывают (один раз, при
 * отпускании), прокрутка с полоски, лежащая ладонь и второй палец — нет;
 * мышь и клавиатура — как раньше.
 *
 * На коде 7.253 падают тесты «тап» и «перетаскивание» (палец не
 * перематывал вовсе); на коде до 7.253 — «прокрутка» и «лесенка» (каждый
 * шаг — переход).
 */

const dict = {
  playLabel: "Escuchar",
  pauseLabel: "Pausa",
  skipBackLabel: "Atrás",
  skipForwardLabel: "Adelante",
  seekLabel: "Ir a la frase",
};

// Полоска: 140 px от x = 0. Доля = clientX / 140.
const WIDTH = 140;

function renderPlayer(onSeek: (index: number) => void, extra: Partial<Parameters<typeof StoryAudioPlayer>[0]> = {}) {
  const view = render(
    <StoryAudioPlayer
      dict={dict}
      navOffset={0}
      sticky={false}
      hasRealAudio
      playing
      progress={9 / 14}
      rate={1}
      queueLength={14}
      readingQueueIndex={8}
      onSkipBack={() => {}}
      onSkipForward={() => {}}
      onPlayPause={() => {}}
      onSeek={onSeek}
      onRateChange={() => {}}
      {...extra}
    />,
  );
  const zone = view.container.querySelector<HTMLElement>('[data-rf-player="seek-zone"]');
  const slider = view.container.querySelector<HTMLInputElement>('input[type="range"]');
  const bar = view.container.querySelector<HTMLElement>('[data-rf-player="bar"]');
  expect(zone, "зоны касания у полоски нет — проба смотрит не туда").not.toBeNull();
  return { zone: zone!, slider: slider!, bar: bar!, view };
}

const at = (x: number, y = 600, id = 1, primary = true) => ({ pointerId: id, pointerType: "touch", isPrimary: primary, clientX: x, clientY: y, button: 0 });

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 590, width: WIDTH, height: 6, right: WIDTH, bottom: 596, x: 0, y: 590, toJSON: () => ({}) } as DOMRect);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("палец по полоске плеера", () => {
  it("тап по полоске — переход в эту точку", () => {
    const onSeek = vi.fn();
    const { zone } = renderPlayer(onSeek);
    fireEvent.pointerDown(zone, at(30));
    fireEvent.pointerUp(zone, at(30));
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(Math.round((30 / WIDTH) * 13));
  });

  it("перетаскивание — один переход при отпускании, в точку отпускания", () => {
    const onSeek = vi.fn();
    const { zone, bar } = renderPlayer(onSeek);
    fireEvent.pointerDown(zone, at(120));
    fireEvent.pointerMove(zone, at(100, 601));
    fireEvent.pointerMove(zone, at(60, 602));
    expect(onSeek, "перетаскивание перемотало до отпускания").not.toHaveBeenCalled();
    expect(bar.style.width, "бегунок не едет за пальцем").toBe(`${(60 / WIDTH) * 100}%`);
    fireEvent.pointerUp(zone, at(20, 602));
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(Math.round((20 / WIDTH) * 13));
  });

  it("лесенка 7.253: палец ведут влево и отпускают за полоской по вертикали — переход один", () => {
    const onSeek = vi.fn();
    const { zone } = renderPlayer(onSeek);
    fireEvent.pointerDown(zone, at(120));
    for (const x of [105, 90, 75, 60, 45, 30, 15, 0]) fireEvent.pointerMove(zone, at(x, 603));
    expect(onSeek).not.toHaveBeenCalled();
    fireEvent.pointerUp(zone, at(0, 603));
    expect(onSeek.mock.calls).toEqual([[0]]);
  });

  it("прокрутка страницы, начатая на полоске, не перематывает", () => {
    const onSeek = vi.fn();
    const { zone } = renderPlayer(onSeek);
    fireEvent.pointerDown(zone, at(70, 600));
    fireEvent.pointerMove(zone, at(72, 615));
    fireEvent.pointerMove(zone, at(74, 660));
    fireEvent.pointerCancel(zone, at(74, 660));
    fireEvent.pointerUp(zone, at(74, 700));
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("второй палец (ладонь) — перемотки нет", () => {
    const onSeek = vi.fn();
    const { zone } = renderPlayer(onSeek);
    fireEvent.pointerDown(zone, at(70, 600, 1));
    fireEvent.pointerDown(zone, at(5, 610, 2, false));
    fireEvent.pointerUp(zone, at(5, 610, 2, false));
    fireEvent.pointerUp(zone, at(70, 600, 1));
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("зона касания 44 px, вертикальная прокрутка отдана браузеру, ползунок указателю недоступен", () => {
    const { zone, slider } = renderPlayer(vi.fn());
    expect(zone.className).toMatch(/\bh-11\b/);
    expect(zone.className).toMatch(/\btouch-pan-y\b/);
    expect(slider.className).toMatch(/\bpointer-events-none\b/);
  });
});

describe("контроль: мышь и клавиатура — как раньше", () => {
  it("мышь перематывает сразу и на каждом шаге", () => {
    const onSeek = vi.fn();
    const { zone } = renderPlayer(onSeek);
    const mouse = (x: number) => ({ pointerId: 7, pointerType: "mouse", isPrimary: true, clientX: x, clientY: 600, button: 0 });
    fireEvent.pointerDown(zone, mouse(0));
    fireEvent.pointerMove(zone, mouse(70));
    fireEvent.pointerUp(zone, mouse(70));
    expect(onSeek.mock.calls).toEqual([[0], [Math.round(0.5 * 13)]]);
  });

  it("клавиатура (и TalkBack) — через ползунок", () => {
    const onSeek = vi.fn();
    const { slider } = renderPlayer(onSeek);
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.change(slider, { target: { value: "9" } });
    expect(onSeek).toHaveBeenCalledWith(9);
  });
});

describe("полоска по времени, как шторка", () => {
  it("у рассказа с одной дорожкой ширина — время / длина, а не номер строки", () => {
    const audio = document.createElement("audio");
    Object.defineProperty(audio, "duration", { value: 89.208, configurable: true });
    audio.currentTime = 24.925;
    const audioRef = createRef<HTMLAudioElement>() as { current: HTMLAudioElement | null };
    audioRef.current = audio;
    const offsets = [0, 2.616, 7.584, 13.9, 17.064, 23.976, 27.432, 35.448, 38.352, 50, 60, 70, 78, 85];
    // Видео 01.10: пауза на 24,9 с — шторка 28 %, а страница рисовала
    // (строка 5 + 1) / 14 ≈ 43 % (на POCO — ≈ 45–50 %).
    const { bar } = renderPlayer(vi.fn(), { audioRef, sentenceOffsets: offsets, readingQueueIndex: 5, progress: 6 / 14 });
    expect(parseFloat(bar.style.width)).toBeCloseTo((24.925 / 89.208) * 100, 1);
  });
});
