import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import StoryAudioPlayer from "./StoryAudioPlayer";

/**
 * ДОЛГ 362, ЗАХОД 7.253 — палец по полоске плеера не перематывает.
 *
 * Видео владельца 30.09.2026 (POCO, 1.0.13): «▶» с 64 %, через 4 с
 * рассказ прыгает в ноль. Журнал телефона: касание длиной 950 мс поверх
 * полоски и за 90 мс лесенка позиций назад по началам строк 8…0 — это
 * невидимый ползунок `<input type="range">` поверх полоски, `onChange`
 * на каждом шаге движения пальца. На эмуляторе мазок влево по полоске
 * дал 42,28 → 0,13 с. Разбор — PROGRESS.md, заход 7.253.
 *
 * Обе стороны правила в одном файле: касание (палец, стилус) — перемотки
 * нет; мышь и клавиатура — перемотка есть (позитивный контроль: без него
 * «не перематывает» читалось бы и тогда, когда ползунок сломан вовсе).
 * На коде до правки первый тест падает: `onSeek` зовётся с 0.
 */

const dict = {
  playLabel: "Escuchar",
  pauseLabel: "Pausa",
  skipBackLabel: "Atrás",
  skipForwardLabel: "Adelante",
  seekLabel: "Ir a la frase",
};

function renderPlayer(onSeek: (index: number) => void) {
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
    />,
  );
  const slider = view.container.querySelector<HTMLInputElement>('input[type="range"]');
  expect(slider, "ползунка поверх полоски нет — проба смотрит не туда").not.toBeNull();
  return slider!;
}

afterEach(cleanup);

describe("ползунок поверх полоски плеера", () => {
  it("движение пальца по полоске не перематывает рассказ (лесенка 8 → 0 с видео POCO)", () => {
    const onSeek = vi.fn();
    const slider = renderPlayer(onSeek);
    fireEvent.pointerDown(slider, { pointerType: "touch" });
    for (const step of [7, 6, 5, 4, 2, 1, 0]) fireEvent.change(slider, { target: { value: String(step) } });
    fireEvent.pointerUp(slider, { pointerType: "touch" });
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("стилус — тоже касание, перемотки нет", () => {
    const onSeek = vi.fn();
    const slider = renderPlayer(onSeek);
    fireEvent.pointerDown(slider, { pointerType: "pen" });
    fireEvent.change(slider, { target: { value: "0" } });
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("контроль: мышь перематывает, как раньше", () => {
    const onSeek = vi.fn();
    const slider = renderPlayer(onSeek);
    fireEvent.pointerDown(slider, { pointerType: "mouse" });
    fireEvent.change(slider, { target: { value: "3" } });
    expect(onSeek).toHaveBeenCalledWith(3);
  });

  it("контроль: клавиатура перематывает и после касания пальцем", () => {
    const onSeek = vi.fn();
    const slider = renderPlayer(onSeek);
    fireEvent.pointerDown(slider, { pointerType: "touch" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.change(slider, { target: { value: "9" } });
    expect(onSeek).toHaveBeenCalledWith(9);
  });
});
