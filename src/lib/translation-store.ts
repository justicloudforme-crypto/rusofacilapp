"use client";

import { normalizeBankWord } from "./translation-normalize";
import { readSession, sessionStorageOrNull, writeSession } from "@/lib/safe-storage";

/**
 * Кэш переводов на стороне ЧИТАТЕЛЯ — шаг 2 долга 169 (заход 7.188).
 *
 * ЗАЧЕМ. Человек в одном рассказе тапает одни и те же слова по многу
 * раз, а ответ на слово не меняется. До 7.188 каждый такой повтор стоил
 * двух вызовов функции Vercel и одного знака чужой суточной квоты.
 * Замер по живому рассказу «Снегурочка»: 126 тапаемых мест, но всего 93
 * РАЗЛИЧНЫХ словоформы — то есть треть тапов была повтором ещё до того,
 * как человек второй раз перечитал абзац.
 *
 * ДВА СЛОЯ, и оба нужны:
 *
 *  1. `Map` в памяти вкладки — переживает перерисовку и переход между
 *     рассказами внутри одного захода, стоит 0 мс.
 *  2. `sessionStorage` — переживает перезагрузку страницы. Именно
 *     СЕССИОННОЕ, а не `localStorage`: словарь пополняется рукой, и
 *     запирать перевод в телефоне ученика навсегда мы права не имеем.
 *     Срок жизни между сеансами держит `Cache-Control` на самом адресе,
 *     и там он честный и управляемый нами.
 *
 * ОТКАЗ ХРАНИЛИЩА НЕ ЛОМАЕТ НИЧЕГО. `sessionStorage` бросает в приватном
 * режиме Safari и при переполнении квоты; каждое обращение обёрнуто, и
 * при отказе остаётся слой 1. Тот же обмен, что у `activity-cache.ts`.
 *
 * ЧЕГО ЗДЕСЬ НЕТ: отрицательных записей («этого слова нет»). Кэшировать
 * отказ значило бы запереть чужую аварию в телефоне ученика — ровно то,
 * от чего `no-store` стоит на ошибке в `translation-cache.ts`.
 */
const STORAGE_KEY = "rf.wordTranslations.v1";
/** Потолок хранимого словаря. 600 слов — это 4–5 прочитанных рассказов. */
const MAX_ENTRIES = 600;

let memory: Map<string, string> | null = null;

function load(): Map<string, string> {
  if (memory) return memory;
  memory = new Map();
  try {
    const raw = readSession(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value === "string" && value) memory.set(key, value);
        }
      }
    }
  } catch {
    /* испорченная или недоступная запись — начинаем с пустого словаря */
  }
  return memory;
}

function persist(map: Map<string, string>): void {
  // Обрезается ХВОСТ вставки: `Map` хранит порядок добавления, и
  // выброшенным оказывается то, что положено раньше всего.
  const entries = [...map.entries()].slice(-MAX_ENTRIES);
  // Квота хранилища кончилась или хранилище запрещено — слой в памяти
  // остаётся рабочим, и `writeSession` об этом молчит намеренно.
  writeSession(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
}

/** Перевод слова, если он уже известен этой вкладке. */
export function readCachedTranslation(word: string): string | null {
  const key = normalizeBankWord(word);
  if (!key) return null;
  return load().get(key) ?? null;
}

/** Запомнить перевод слова. Пустая строка не запоминается никогда. */
export function cacheTranslation(word: string, translation: string): void {
  const key = normalizeBankWord(word);
  const text = translation.trim();
  if (!key || !text) return;
  const map = load();
  map.set(key, text);
  if (map.size > MAX_ENTRIES) {
    for (const oldest of map.keys()) {
      map.delete(oldest);
      if (map.size <= MAX_ENTRIES) break;
    }
  }
  persist(map);
}

/** Запомнить пачку — ответ предзагрузки видимого абзаца. */
export function cacheTranslations(entries: Record<string, string>): void {
  const map = load();
  let changed = false;
  for (const [word, translation] of Object.entries(entries)) {
    const key = normalizeBankWord(word);
    const text = typeof translation === "string" ? translation.trim() : "";
    if (!key || !text || map.get(key) === text) continue;
    map.set(key, text);
    changed = true;
  }
  if (!changed) return;
  while (map.size > MAX_ENTRIES) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
  persist(map);
}

/** Какие из слов вкладке ещё неизвестны — то, что имеет смысл спрашивать. */
export function unknownWords(words: readonly string[]): string[] {
  const map = load();
  const out = new Set<string>();
  for (const word of words) {
    const key = normalizeBankWord(word);
    if (key && !map.has(key)) out.add(key);
  }
  return [...out];
}

/** Только для тестов: забыть всё, что вкладка успела узнать. */
export function resetTranslationStoreForTests(): void {
  memory = null;
  sessionStorageOrNull()?.removeItem(STORAGE_KEY);
}
