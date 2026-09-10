import { describe, expect, it } from "vitest";
import { pickClip, textAudioKey, vocabAudioKey } from "./audioKeys";
import { pickReusableClips } from "@/lib/audio-reuse-pick";

/**
 * Заход 7.163. Правило владельца: звучит только оплаченная запись, и
 * браузерного `speechSynthesis` не должно быть нигде. Замер по боевой базе
 * 10.09.2026 нашёл 2128 кнопок «слушать» вне рассказов, у которых записи
 * не находилось; 1031 из них уже была оплачена — тот же текст озвучен
 * рядом. Здесь заперты оба правила выбора клипа: приоритет позиции и
 * приоритет своего урока.
 */
describe("pickClip: позиция главнее текста", () => {
  const map = {
    [vocabAudioKey(0)]: "/paid/position.mp3",
    [textAudioKey("пять")]: "/paid/text.mp3",
    [textAudioKey("шесть")]: "/paid/other.mp3",
  };

  it("берёт позиционный клип, даже когда текст тоже озвучен", () => {
    // Иначе правка текста в админке уводила бы урок на чужой клип — тот
    // самый инцидент на 14 элементов, из-за которого ключ и стал
    // позиционным (шапка audioKeys.ts).
    expect(pickClip(map, vocabAudioKey(0), "шесть")).toBe("/paid/position.mp3");
  });

  it("при промахе по позиции подхватывает текстовый ключ", () => {
    expect(pickClip(map, vocabAudioKey(9), "пять")).toBe("/paid/text.mp3");
  });

  it("работает там, где позиционного ключа нет вовсе (примеры на слайдах)", () => {
    expect(pickClip(map, null, "пять")).toBe("/paid/text.mp3");
  });

  it("отрицательный контроль: незнакомый текст не подменяется чужим клипом", () => {
    expect(pickClip(map, vocabAudioKey(9), "семь")).toBeUndefined();
  });

  it("отрицательный контроль: совпадение побуквенное", () => {
    expect(pickClip(map, null, "Пять?")).toBeUndefined();
  });

  it("отрицательный контроль: пустая карта ничего не выдумывает", () => {
    expect(pickClip({}, vocabAudioKey(0), "пять")).toBeUndefined();
    expect(pickClip(undefined, vocabAudioKey(0), "пять")).toBeUndefined();
  });

  it("подсадка формы «до 7.163»: чистый audioMap[key] слайдам не даёт ничего", () => {
    const before = (m: Record<string, string>, key: string | null) => (key ? m[key] : undefined);
    expect(before(map, null)).toBeUndefined();
  });
});

describe("pickReusableClips: чей клип берётся, когда текст озвучен дважды", () => {
  const rows = [
    { contentType: "flashcard", contentId: "card-1", itemKey: "word", text: "пять", audioUrl: "/card.mp3" },
    { contentType: "lesson", contentId: "a1-4", itemKey: "vocab-0", text: "пять", audioUrl: "/a1-4.mp3" },
    { contentType: "lesson", contentId: "a1-9", itemKey: "vocab-3", text: "пять", audioUrl: "/a1-9.mp3" },
  ];

  it("клип своего урока главнее чужого", () => {
    expect(pickReusableClips(rows, "a1-9")["пять"]).toBe("/a1-9.mp3");
  });

  it("без своего урока выбор детерминирован, а не случаен", () => {
    expect(pickReusableClips(rows)["пять"]).toBe("/card.mp3");
    expect(pickReusableClips([...rows].reverse())["пять"]).toBe("/card.mp3");
  });

  it("рассказы исключены: их озвучивал каст из пяти голосов, включая женские", () => {
    // 437 клипов рассказов записаны не `onyx` (echo/ash/nova/shimmer,
    // замер 7.163 по боевой базе). Совпадение по тексту уронило бы
    // женский голос в урок — ровно тот брак, из-за которого завёлся
    // долг 114.
    const withStory = [
      { contentType: "story", contentId: "s1", itemKey: "0-0", text: "Привет!", audioUrl: "/nova.mp3" },
    ];
    expect(pickReusableClips(withStory)["Привет!"]).toBeUndefined();
  });
});
