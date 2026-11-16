import { afterEach, describe, expect, it, vi } from "vitest";
import {
  askWordAudio,
  preloadWordClip,
  resetWordAudioAnswersForTests,
  takePreloadedWordClip,
  wordAudioKey,
} from "./word-audio-answers";

/** Долг 172 (7.285): память ответов `/api/word-audio` и предзагрузка клипа. */
afterEach(() => {
  resetWordAudioAnswersForTests();
  vi.unstubAllGlobals();
});

describe("word-audio-answers", () => {
  it("ключ обычного слова не зависит от места, у омографа — зависит", () => {
    expect(wordAudioKey("дед", "s1", "0-0-0")).toBe(wordAudioKey("дед", "s1", "3-1-2"));
    expect(wordAudioKey("замок", "s1", "0-0-2")).not.toBe(wordAudioKey("замок", "s1", "0-1-3"));
    // Без места омограф спрашивается как раньше — по слову.
    expect(wordAudioKey("замок", null, null)).toBe("замок");
  });

  it("одновременные и повторные вопросы по ключу — один запрос; 502 не запоминается", async () => {
    let status = 200;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ audioUrl: status === 200 ? "u.mp3" : null }), { status }));
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([askWordAudio("k", "/x"), askWordAudio("k", "/x")]);
    expect([a, b]).toEqual(["u.mp3", "u.mp3"]);
    await askWordAudio("k", "/x");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    status = 502;
    await expect(askWordAudio("other", "/y")).rejects.toThrow();
    await Promise.resolve();
    status = 200;
    expect(await askWordAudio("other", "/y")).toBe("u.mp3");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("«клипа нет» (200 и null) запоминается как ответ", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ audioUrl: null }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await askWordAudio("k", "/x")).toBeNull();
    expect(await askWordAudio("k", "/x")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("предзагруженный проигрыватель отдаётся кнопке ровно один раз, второй закачки нет", () => {
    preloadWordClip("https://blob.example/a.mp3");
    preloadWordClip("https://blob.example/a.mp3");
    const first = takePreloadedWordClip("https://blob.example/a.mp3");
    expect(first).toBeInstanceOf(HTMLAudioElement);
    expect(first?.preload).toBe("auto");
    expect(first?.getAttribute("src") ?? first?.src).toContain("a.mp3");
    expect(takePreloadedWordClip("https://blob.example/a.mp3")).toBeNull();
    // Отданный адрес повторно не предзагружается: повтор берёт файл из кеша браузера.
    preloadWordClip("https://blob.example/a.mp3");
    expect(takePreloadedWordClip("https://blob.example/a.mp3")).toBeNull();
    expect(takePreloadedWordClip("https://blob.example/never.mp3")).toBeNull();
  });
});
