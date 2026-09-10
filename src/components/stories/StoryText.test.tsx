import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import StoryText, { type StoryTextDict } from "./StoryText";
import type { StoryAudioSegment } from "@/lib/stories";

// Долг 114 (PROGRESS.md 7.160/7.161) и заход 7.168. Бесплатный отрывок
// закрытого рассказа много лет читал системный голос ОС: страница не
// отдавала непокупателю ни одного клипа, а кнопка «слушать» оставалась и
// уходила в браузерный синтез. В 7.161 синтез запретили превью, в 7.168 —
// сняли из кода целиком. Здесь заперта та половина правила, которая живёт
// в компоненте: **орган управления «слушать» рисуется ровно тогда, когда
// есть настоящая запись, и подставить вместо неё нечего**. Вторая
// половина — что клипы видимого абзаца вообще отданы — стоит на странице
// (`[id]/page.tsx`) и проверяется `check:silent-listen`.

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

let speak: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // jsdom не реализует Web Speech API вовсе — а именно его наличие и
  // включало аварийный путь в браузере. Движок подставляется НАРОЧНО:
  // тест обязан мерить наше правило, а не отсутствие API в jsdom. Если
  // где-то в компоненте синтез вернётся, этот шпион его увидит.
  // jsdom не реализует воспроизведение вовсе: без этой заглушки клик по
  // предложению падает не на нашем правиле, а на `play() is not implemented`.
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  speak = vi.fn();
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: { cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(), speak, speaking: false, paused: false },
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

describe("StoryText: браузерного синтеза нет ни на одном пути", () => {
  it("без клипов органа «слушать» нет вовсе — ни у превью, ни у полноправного читателя", () => {
    for (const storyId of [null, "story-1"]) {
      const { container } = render(
        <StoryText
          storyId={storyId}
          title="Чужими словами"
          author="—"
          paragraphs={paragraphs}
          audioSegments={[]}
          fullAudioUrl={null}
          sentenceOffsets={null}
          dict={dict}
        />
      );
      expect(screen.queryByLabelText(dict.playLabel)).toBeNull();
      expect(container.querySelector("audio")).toBeNull();
      cleanup();
    }
  });

  it("с клипами видимого абзаца орган есть и <audio> настоящий", () => {
    const { container } = render(
      <StoryText
        storyId={null}
        title="Чужими словами"
        author="—"
        paragraphs={paragraphs}
        audioSegments={segments}
        fullAudioUrl={null}
        sentenceOffsets={null}
        dict={dict}
      />
    );
    expect(screen.queryByLabelText(dict.playLabel)).not.toBeNull();
    expect(container.querySelector("audio")).not.toBeNull();
  });

  it("нажатие на предложение без клипов не запускает синтез", () => {
    const { container } = render(
      <StoryText
        storyId="story-1"
        title="Чужими словами"
        author="—"
        paragraphs={paragraphs}
        audioSegments={[]}
        fullAudioUrl={null}
        sentenceOffsets={null}
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

  it("тап по слову спрашивает клип адресом МЕСТА, а не одной словоформой (7.168)", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ audioUrl: null }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(
      <StoryText
        storyId="story-1"
        audioStoryId="story-1"
        title="Чужими словами"
        author="—"
        paragraphs={paragraphs}
        audioSegments={segments}
        fullAudioUrl={null}
        sentenceOffsets={null}
        dict={dict}
      />
    );
    const word = container.querySelector<HTMLElement>('button[data-word="года"]');
    expect(word).not.toBeNull();
    word!.click();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const urls = (fetchMock.mock.calls as unknown as unknown[][]).map((c) => String(c[0]));
    const audioCall = urls.find((u) => u.startsWith("/api/word-audio"));
    expect(audioCall).toBeDefined();
    expect(audioCall).toContain("story=story-1");
    // «года» — третий словесный токен, но токенов ВСЕГО он четвёртый по
    // счёту (между словами стоят пробелы), и адрес обязан назвать именно
    // общий номер — им же называется `itemKey` вырезки.
    expect(audioCall).toMatch(/&at=0-0-\d+$/);
    expect(speak).not.toHaveBeenCalled();
  });
});
