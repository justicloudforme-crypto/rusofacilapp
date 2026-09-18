/**
 * ХРАНИЛИЩЕ БРАУЗЕРА ОТКАЗЫВАЕТ — И ЭТО ОБЫЧНОЕ ПОЛОЖЕНИЕ ДЕЛ.
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО
 * ====================================================================
 *
 * `window.localStorage` и `window.sessionStorage` бросают исключение не
 * в исключительных случаях, а в четырёх совершенно обычных:
 *
 *   1. приватное окно Safari (историческое поведение квоты 0);
 *   2. «блокировать данные сайтов» в настройках браузера — бросает уже
 *      САМО ОБРАЩЕНИЕ к свойству `window.localStorage`, до `getItem`;
 *   3. корпоративная политика устройства;
 *   4. переполнение квоты на записи (`QuotaExceededError`).
 *
 * Класс отказа от этого ровно тот же, что у инцидента №1 и у аварии
 * 29.08.2026: сервер отдаёт 200 и полный HTML, а страница гибнет ПОСЛЕ
 * гидрации и человек видит «Something went wrong». Ни один сторож по
 * кодам ответов этого не видит.
 *
 * Перепись 18.09.2026 (7.211): обращений к хранилищу в `src/` — 24, из
 * них под `try/catch` 18, без защиты 6 в трёх файлах (`lib/sound.ts`,
 * `components/lesson/ExercisesTab.tsx`, `components/DevServiceWorkerCleanup.tsx`).
 * Самое дорогое — `ExercisesTab.tsx:92`: оно стояло в эффекте НА
 * МОНТИРОВАНИИ страницы урока, то есть срабатывало у каждого посетителя,
 * а не только у нажавшего «Проверить».
 *
 * ====================================================================
 * ПОЧЕМУ ОДНА ОБЁРТКА, А НЕ try/catch В КАЖДОМ МЕСТЕ
 * ====================================================================
 *
 * Три разных `try/catch` — это три разных решения о том, что показывать
 * при отказе, и каждое новое место заводит четвёртое. Здесь решение
 * одно и записано один раз: **при отказе хранилища читатель получает
 * запасное значение, а писатель — `false`, и ничего не бросается
 * наружу никогда**. Поэтому же обращения к самим `localStorage` и
 * `sessionStorage` в `src/` разрешены ровно в этом файле — это
 * проверяет сторож `check:storage-guarded` (в `npm run verify` и в
 * `ci.yml`), а не соглашение.
 *
 * Оговорка, без которой обёртка врала бы: `try/catch` у ВЫЗЫВАЮЩЕГО
 * никуда не девается там, где внутри той же попытки стоит `JSON.parse`.
 * Обёртка отвечает за хранилище, а не за форму лежащих в нём данных.
 */

/** Сам объект хранилища или `null`, если к нему нельзя даже обратиться.
 *  Обращение к свойству вынесено внутрь `try` намеренно: в браузере с
 *  запрещёнными данными сайта бросает именно оно, а не `getItem`. */
function store(session: boolean): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return session ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

/** `localStorage`, если он доступен. Для случаев, где нужен сам объект
 *  (перечисление ключей), а не одно значение. */
export function localStorageOrNull(): Storage | null {
  return store(false);
}

/** `sessionStorage`, если он доступен. */
export function sessionStorageOrNull(): Storage | null {
  return store(true);
}

/** Значение ключа или `fallback` — и при отказе хранилища, и когда
 *  ключа просто нет. Различать эти два случая ни одному сегодняшнему
 *  читателю не нужно; когда понадобится, это будет отдельная функция, а
 *  не второй смысл у этой. */
export function readLocal(key: string, fallback: string | null = null): string | null {
  const s = store(false);
  if (!s) return fallback;
  try {
    const value = s.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

/** `true`, если запись действительно состоялась. Возвращаемое значение
 *  можно игнорировать — но нельзя не получить: молчаливый отказ записи
 *  это то, из-за чего заводят долги. */
export function writeLocal(key: string, value: string): boolean {
  const s = store(false);
  if (!s) return false;
  try {
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Удаление ключа. `true`, если удаление состоялось. */
export function removeLocal(key: string): boolean {
  const s = store(false);
  if (!s) return false;
  try {
    s.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Все ключи `localStorage`; при отказе — пустой список. */
export function localKeys(): string[] {
  const s = store(false);
  if (!s) return [];
  try {
    return Object.keys(s);
  } catch {
    return [];
  }
}

/** То же, что `readLocal`, но для сессионного хранилища. */
export function readSession(key: string, fallback: string | null = null): string | null {
  const s = store(true);
  if (!s) return fallback;
  try {
    const value = s.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

/** То же, что `writeLocal`, но для сессионного хранилища. */
export function writeSession(key: string, value: string): boolean {
  const s = store(true);
  if (!s) return false;
  try {
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
