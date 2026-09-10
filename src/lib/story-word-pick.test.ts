import { describe, expect, it } from "vitest";
import { pickWordClip, isHomograph, HOMOGRAPH_COUNT } from "./story-word-pick";
import { pickReusableClips, type ReusableClipRow } from "./audio-reuse-pick";

/**
 * Долг 123, заход 7.166. Тап по слову внутри рассказа звучал браузерным
 * голосом у всех — включая анонима на двух бесплатных рассказах, — при
 * 56 642 тапаемых местах и 14 375 словоформах. Здесь заперты границы
 * правила, которым тап выбирает оплаченный клип.
 */
const own: ReusableClipRow = { contentType: "word", contentId: "репка", itemKey: "word", text: "репка", audioUrl: "/paid/word.mp3" };
const card: ReusableClipRow = { contentType: "flashcard", contentId: "c1", itemKey: "word", text: "репка", audioUrl: "/paid/card.mp3" };
const story: ReusableClipRow = { contentType: "story", contentId: "s1", itemKey: "seg-0", text: "репка", audioUrl: "/paid/story.mp3" };

describe("pickWordClip", () => {
  it("свой клип слова главнее уже оплаченного клипа другой поверхности", () => {
    expect(pickWordClip([own, card, story], "репка")).toBe("/paid/word.mp3");
  });

  it("своего клипа нет — играет оплаченный клип того же текста", () => {
    expect(pickWordClip([card, story], "репка")).toBe("/paid/card.mp3");
  });

  it("регистр складывается: «Репка» звучит клипом «репка»", () => {
    expect(pickWordClip([own], "Репка")).toBe("/paid/word.mp3");
  });

  it("рассказ не отдаётся никогда — он озвучен кастом из пяти голосов", () => {
    expect(pickWordClip([story], "репка")).toBeNull();
  });

  it("омограф не озвучивается изолированным клипом", () => {
    expect(
      pickWordClip([{ ...own, contentId: "замок", text: "замок", audioUrl: "/paid/zamok.mp3" }], "замок"),
    ).toBeNull();
  });

  it("ё и е — разные слова и разные клипы", () => {
    expect(pickWordClip([{ ...own, contentId: "все", text: "все", audioUrl: "/paid/vse.mp3" }], "всё")).toBeNull();
  });

  it("чужой текст не звучит чужим клипом", () => {
    expect(pickWordClip([own], "морковка")).toBeNull();
  });

  it("список омографов не пуст — иначе правило молча выключено", () => {
    expect(HOMOGRAPH_COUNT).toBeGreaterThan(100);
    expect(isHomograph("Замок")).toBe(true);
    expect(isHomograph("морковка")).toBe(false);
  });
});

describe("банк слов не задевает кнопки вне рассказов", () => {
  it("clipsByText-правило пропускает contentType='word'", () => {
    const lesson: ReusableClipRow = { contentType: "lesson", contentId: "a1-1", itemKey: "vocab-0", text: "репка", audioUrl: "/paid/lesson.mp3" };
    expect(pickReusableClips([lesson, own])["репка"]).toBe("/paid/lesson.mp3");
  });

  it("кроме банка слов другого клипа нет — кнопка остаётся без записи", () => {
    expect(pickReusableClips([own])["репка"]).toBeUndefined();
  });
});
