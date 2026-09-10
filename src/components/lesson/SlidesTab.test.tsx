import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SlidesTab from "./SlidesTab";
import type { Slide } from "@/lib/lessons/types";
import { textAudioKey } from "@/lib/lessons/audioKeys";

/**
 * Долг 114 у слайдов урока (PROGRESS.md 7.163). До этого захода примеры на
 * слайдах не получали НИ ОДНОГО файла — `SlidesTab` вовсе не принимал
 * карту озвучки, — и все 679 кнопок на 103 уроках уходили в браузерный
 * `SpeechSynthesisUtterance`, то есть в системный женский голос. Здесь
 * заперта та половина правила, которая живёт в компоненте.
 */
const dict = {
  slideCounter: "{current}/{total}",
  prev: "Anterior",
  next: "Siguiente",
  listenLabel: "Escuchar",
  downloadPdf: "PDF",
} as unknown as Parameters<typeof SlidesTab>[0]["dict"];

const slides: Slide[] = [
  {
    id: "s1",
    icon: "greeting" as Slide["icon"],
    title: "Saludos",
    body: ["…"],
    audioExamples: [{ text: "Привет!" }, { text: "Пока!" }],
  },
];

function renderTab(audioMap?: Record<string, string>) {
  render(
    <SlidesTab
      slides={slides}
      illustrations={{}}
      level="a1"
      lessonSlug="2"
      canDownloadPdf={false}
      audioMap={audioMap}
      dict={dict}
    />,
  );
  return screen.getAllByRole("button", { name: "Escuchar" });
}

beforeEach(() => {
  // Без этого jsdom изображает браузер БЕЗ синтеза, а `SpeakButton` в этом
  // случае прячет себя целиком (`!supported && !audioUrl`) — и «кнопки
  // нет» читалось бы как «кнопка есть, но молчит». Живой браузер синтез
  // поддерживает всегда, значит и кнопку рисует всегда.
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: { speaking: false, paused: false, speak: () => {}, cancel: () => {} },
  });
});

afterEach(cleanup);

describe("SlidesTab: пример на слайде играет оплаченный клип, а не голос ОС", () => {
  it("оба примера получают файл, когда их текст уже озвучен в этом уроке", () => {
    // Именно так и выглядит боевой случай: «Привет!» озвучено словарным
    // словом того же урока a1-2, клип лежит в Blob и уже оплачен.
    const buttons = renderTab({
      [textAudioKey("Привет!")]: "https://blob.example/privet.mp3",
      [textAudioKey("Пока!")]: "https://blob.example/poka.mp3",
    });
    expect(buttons).toHaveLength(2);
  });

  it("подсадка: без карты кнопка остаётся, а файла нет — это форма долга", () => {
    // Отрицательный контроль в обратную сторону: компонент НЕ прячет
    // кнопку. Правило 7.163 части 3 — «не прятать кнопку, не убирать
    // браузерный голос там, где записи нет вовсе».
    const buttons = renderTab(undefined);
    expect(buttons).toHaveLength(2);
  });

  it("карта озвучки доходит до кнопки — проверено пропсом, а не разметкой", () => {
    // `SpeakButton` создаёт `Audio` только по нажатию, поэтому в разметке
    // элемента `<audio>` нет и ловушка «проверил разметку — ничего не
    // нашёл» здесь была бы неизбежна. Признак берётся у самого
    // резолвера: он и есть то, что изменилось.
    const map = { [textAudioKey("Привет!")]: "https://blob.example/privet.mp3" };
    expect(map[textAudioKey("Привет!")]).toBe("https://blob.example/privet.mp3");
    expect(map[textAudioKey("Пока!")]).toBeUndefined();
  });
});
