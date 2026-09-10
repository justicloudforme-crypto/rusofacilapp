import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import StoryText, { type StoryTextDict } from "./StoryText";
import type { StoryAudioSegment } from "@/lib/stories";

// Долг 114 (PROGRESS.md 7.160/7.161). Бесплатный отрывок закрытого
// рассказа много лет читал системный голос ОС: страница не отдавала
// непокупателю ни одного клипа, а кнопка «слушать» оставалась и уходила в
// `SpeechSynthesisUtterance`. Здесь заперта та половина правила, которая
// живёт в компоненте: **синтез не подставляется вместо записи там, где он
// запрещён**. Вторая половина — что клипы видимого абзаца вообще отданы —
// стоит на странице (`[id]/page.tsx`) и проверяется `check:silent-listen`.

const dict: StoryTextDict = {
  translationLoading: "…",
  translationError: "!",
  wordListenLabel: "Escuchar palabra",
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

beforeEach(() => {
  // jsdom не реализует Web Speech API вовсе — а именно его наличие и
  // включало аварийный путь в браузере. Подставляем движок, чтобы тест
  // мерил НАШЕ правило, а не отсутствие API в jsdom.
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: { cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(), speak: vi.fn(), speaking: false, paused: false },
  });
  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    configurable: true,
    value: class {
      lang = "";
      rate = 1;
      volume = 1;
      constructor(public text: string) {}
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StoryText: аварийный браузерный синтез", () => {
  it("превью без клипов не показывает органа «слушать» вовсе — а не показывает и говорит системным голосом", () => {
    render(
      <StoryText
        storyId={null}
        title="Чужими словами"
        author="—"
        paragraphs={paragraphs}
        audioSegments={[]}
        fullAudioUrl={null}
        sentenceOffsets={null}
        allowTtsFallback={false}
        dict={dict}
      />
    );
    expect(screen.queryByLabelText(dict.playLabel)).toBeNull();
  });

  it("превью с клипами видимого абзаца показывает орган и настоящий <audio>", () => {
    const { container } = render(
      <StoryText
        storyId={null}
        title="Чужими словами"
        author="—"
        paragraphs={paragraphs}
        audioSegments={segments}
        fullAudioUrl={null}
        sentenceOffsets={null}
        allowTtsFallback={false}
        dict={dict}
      />
    );
    expect(screen.queryByLabelText(dict.playLabel)).not.toBeNull();
    expect(container.querySelector("audio")).not.toBeNull();
  });

  it("отрицательный контроль: полноправному читателю откат на синтез остаётся — без клипов орган на месте", () => {
    const { container } = render(
      <StoryText
        storyId="story-1"
        title="Чужими словами"
        author="—"
        paragraphs={paragraphs}
        audioSegments={[]}
        fullAudioUrl={null}
        sentenceOffsets={null}
        allowTtsFallback
        dict={dict}
      />
    );
    expect(screen.queryByLabelText(dict.playLabel)).not.toBeNull();
    // Записи нет — значит и <audio> быть не должно: играет синтез.
    expect(container.querySelector("audio")).toBeNull();
  });

  it("нажатие на предложение в превью без клипов не запускает синтез", async () => {
    const speak = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(), speak, speaking: false, paused: false },
    });
    const { container } = render(
      <StoryText
        storyId={null}
        title="Чужими словами"
        author="—"
        paragraphs={paragraphs}
        audioSegments={[]}
        fullAudioUrl={null}
        sentenceOffsets={null}
        allowTtsFallback={false}
        dict={dict}
      />
    );
    // Текст разбит на токены-слова, поэтому предложение берётся его
    // собственной обёрткой, а не поиском по строке.
    const sentences = container.querySelectorAll("p > span");
    expect(sentences.length).toBeGreaterThan(0);
    (sentences[0] as HTMLElement).click();
    expect(speak).not.toHaveBeenCalled();
  });
});
