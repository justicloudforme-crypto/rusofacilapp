"use client";

import { isHomograph } from "./story-word-pick";

/**
 * Ответы `/api/word-audio` на стороне читателя — долг 172 (заход 7.285).
 *
 * ЗАЧЕМ. До 7.285 каждый тап по слову спрашивал наш сервер заново, даже
 * если это слово тапали секунду назад. Замер 16.11.2026 (Playwright,
 * эмуляция Slow 3G): три тапа по слову «дед» — три запроса
 * `/api/word-audio`, и каждый повтор ждал звука ≈2,1 с только ради ответа
 * «адрес клипа тот же». Ответ на слово внутри захода не меняется: клип
 * лежит в Blob под постоянным адресом, переозвучка даёт новый адрес и
 * доезжает со следующей загрузкой страницы.
 *
 * КЛЮЧ — СЛОВО, А У ОМОГРАФА — МЕСТО. Обычному слову сервер отвечает одно и
 * то же с местом и без него (см. комментарий маршрута), поэтому второй тап
 * по тому же слову в ДРУГОМ предложении тоже бесплатен. У омографа клип —
 * вырезка из СВОЕГО предложения (заход 7.168), и ключ без места отдал бы
 * ему чужое ударение — ровно то, что заходы 7.166 и 7.168 запрещали.
 *
 * В ПАМЯТИ ВКЛАДКИ, без `sessionStorage`: ответ стоит одного короткого
 * запроса, а хранить его дольше захода — значит пережить переозвучку.
 *
 * ОТКАЗ НЕ ЗАПОМИНАЕТСЯ. Запрос, упавший или ответивший не 200, из карты
 * удаляется — следующий тап спросит снова. «Клипа нет» (200 и `null`) —
 * штатный ответ, он запоминается так же, как адрес.
 *
 * Один и тот же незавершённый запрос делят все тапы, пришедшие до ответа:
 * двойной тап по слову на медленной сети стоит одного запроса, а не двух.
 */

/** Потолок карты: в самом длинном рассказе меньше 600 различных словоформ. */
const MAX_ENTRIES = 600;

const answers = new Map<string, Promise<string | null>>();

/** Ключ ответа: слово целиком, у омографа — ещё и его место. */
export function wordAudioKey(word: string, storyId: string | null | undefined, at: string | null): string {
  if (isHomograph(word) && storyId && at) return `${word}\u0000${storyId}\u0000${at}`;
  return word;
}

/**
 * Адрес клипа (или `null` — «клипа нет») для слова. Повтор того же ключа
 * не уходит в сеть. Бросает, если запрос не удался, — и тогда ответ не
 * запоминается.
 */
export function askWordAudio(key: string, url: string): Promise<string | null> {
  const known = answers.get(key);
  if (known) return known;
  const pending = (async () => {
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`word-audio ${res.status}`);
    return typeof data?.audioUrl === "string" && data.audioUrl ? (data.audioUrl as string) : null;
  })();
  answers.set(key, pending);
  if (answers.size > MAX_ENTRIES) {
    const oldest = answers.keys().next().value;
    if (oldest !== undefined) answers.delete(oldest);
  }
  pending.catch(() => {
    if (answers.get(key) === pending) answers.delete(key);
  });
  return pending;
}

/** Предзагруженные проигрыватели по адресу; `null` — уже отданы кнопке. */
const preloaded = new Map<string, HTMLAudioElement | null>();

/**
 * Первый тап: файл клипа начинает качаться СРАЗУ, как только стал известен
 * его адрес, — а не тогда, когда человек нажмёт 🔊. Качает его тот самый
 * проигрыватель, который потом зазвучит: `SpeakButton` забирает его через
 * `takePreloadedWordClip`. Отдельный «прогревающий» элемент не годится —
 * замер 16.11.2026 (Slow 3G): кнопка создавала второй и качала файл ЕЩЁ раз
 * (mp3 2 запроса вместо 1), а две закачки делили канал, и первый звук
 * приходил позже, чем без предзагрузки (6,1 с против 4,6 с). Каждый адрес
 * предзагружается один раз за жизнь вкладки; повтор потом берёт файл из
 * кеша браузера.
 */
export function preloadWordClip(url: string): void {
  if (preloaded.has(url) || typeof Audio === "undefined") return;
  try {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = url;
    preloaded.set(url, audio);
  } catch {
    /* предзагрузка — ускорение, а не путь: без неё клип скачается по 🔊 */
  }
}

/** Забрать предзагруженный проигрыватель для адреса — один раз. */
export function takePreloadedWordClip(url: string): HTMLAudioElement | null {
  const audio = preloaded.get(url) ?? null;
  if (audio) preloaded.set(url, null);
  return audio;
}

/** Только для тестов: начать с пустой карты. */
export function resetWordAudioAnswersForTests(): void {
  answers.clear();
  preloaded.clear();
}
