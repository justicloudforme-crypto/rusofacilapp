"use client";

/**
 * ОЧЕРЕДЬ ОТВЕТОВ БЕЗ СЕТИ — ЗАХОД 7.236 (ОФЛАЙН-3б).
 *
 * ====================================================================
 * ЧТО БЫЛО ДО ПРАВКИ — ЗАМЕРЫ 7.236 (сборка main f6d1261)
 * ====================================================================
 *
 * Очередь уже была — `src/lib/progress-client.ts`, одна запись на урок в
 * localStorage. Прогоны показали четыре дыры:
 *
 *   1. ЧУЖОЙ АККАУНТ. Записи без владельца: выход A → вход B → попытка A
 *      (24 %) легла на сервер под B.
 *   2. ДУБЛЬ. Сервер записал, ответ до телефона не дошёл → запись осталась
 *      в очереди → сервер обработал ту же попытку ВТОРОЙ раз. Ключа нет.
 *   3. НЕ ТОТ ДЕНЬ. Записи без времени действия — день занятия ставился
 *      по часам приёма: ответ в воскресенье без сети, ушедший в
 *      понедельник, отмечал понедельник.
 *   4. НЕ УХОДИТ САМА. Отправка — только при монтировании вкладки
 *      «Ejercicios»: на эмуляторе запись пролежала 15 с после возврата
 *      сети и ушла, лишь когда человек снова открыл упражнения урока.
 *
 * ====================================================================
 * КАК ТЕПЕРЬ
 * ====================================================================
 *
 *  - ХРАНЕНИЕ. Отдельная база IndexedDB `rf-progress-outbox`, хранилище
 *    `outbox`, ключ — автоинкремент: порядок — свойство хранилища, а не
 *    поле записи (посадка 7.233, строка 2). НЕ Cache Storage: кеши
 *    офлайна уносит выход из учётной записи и выкат, очередь — нет.
 *    IndexedDB переживает убийство приложения — проверено на эмуляторе.
 *  - КЛЮЧ, ВРЕМЯ, ВЛАДЕЛЕЦ у каждой записи (`src/lib/offline-record.ts`).
 *    Дубли давит СЕРВЕР: повтор ключа — пустая операция.
 *  - ОТПРАВКА — `postReliablyForResult` (`src/lib/reliable-post.ts`), без
 *    маячка: маячок не подтверждает доставку, а запись живёт до
 *    подтверждения. Моменты: сразу после ответа, при запуске страницы
 *    (`ProgressOutboxSync` в разметке), по `online` и по собственной пробе
 *    раз в 20 с, пока очередь не пуста (`online` на Android приходит не
 *    всегда — посадка 7.233, строка 4).
 *  - ПРАВИЛО ВЛАДЕЛЬЦА. Уходят только записи ТЕКУЩЕГО владельца. Запись
 *    другого аккаунта остаётся на телефоне и уйдёт, когда тот войдёт
 *    снова; сервер при этом сам сверяет владельца с сессией (409).
 *    Гость (`anon`) в очередь не пишет — прогресс гостя как был: только
 *    отметка «пройдено» на телефоне.
 *  - ПОТОЛОК — `OUTBOX_LIMIT` записей. Больше — честный отказ `full`, а не
 *    молчаливое выбрасывание (посадка 7.233, строка 9).
 */

import { postReliablyForResult } from "./reliable-post";

export const OUTBOX_LIMIT = 200;
/** Владелец гостя — то же значение, что `ANONYMOUS_OWNER_SCOPE` в
 *  `src/lib/recordings-owner.ts` (тот модуль серверный и сюда не
 *  импортируется; равенство держит `progress-outbox.test.ts`). */
export const GUEST_OWNER = "anon";
export const OUTBOX_CHANGE_EVENT = "rf-outbox-change";
const PROGRESS_URL = "/api/progress";

export interface OutboxBody {
  level: string;
  lesson: string;
  score: number;
  passed: boolean;
  mistakes: unknown[];
  answers: Record<string, unknown>;
  key: string;
  at: number;
  owner: string;
}

export interface OutboxRecord {
  id?: number;
  owner: string;
  at: number;
  body: OutboxBody;
}

/** Хранилище очереди. Настоящее — IndexedDB ниже; в примерах — память. */
export interface OutboxStore {
  add(record: OutboxRecord): Promise<number>;
  all(): Promise<OutboxRecord[]>;
  remove(id: number): Promise<void>;
}

export type EnqueueOutcome = "queued" | "full" | "unavailable";

export type SendVerdict = "sent" | "duplicate" | "dropped" | "keep" | "stop";

/**
 * Что делать с записью по ответу сервера. Одно место, потому что ошибка
 * здесь — либо потеря ответа, либо вечная запись.
 *
 *   2xx                → ушла (или повтор ушедшей) — убрать;
 *   409                → чужая для этой сессии — ОСТАВИТЬ, идти дальше;
 *   401                → сессии нет — оставить и остановиться;
 *   400 / 403 / 404    → сервер не примет никогда — убрать;
 *   429 / 5xx / сеть   → оставить и остановиться: порядок важен, а
 *                        следующая попытка будет по пробе.
 */
export function verdictOf(outcome: "ok" | "rejected" | "lost", status: number | null, body: unknown): SendVerdict {
  if (outcome === "ok") {
    return (body as { duplicate?: unknown } | null)?.duplicate === true ? "duplicate" : "sent";
  }
  if (outcome === "lost") return "stop";
  if (status === 409) return "keep";
  if (status === 401) return "stop";
  return "dropped";
}

export function newRecordKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function announce() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OUTBOX_CHANGE_EVENT));
}

export async function enqueueWith(store: OutboxStore, body: OutboxBody): Promise<EnqueueOutcome> {
  try {
    if ((await store.all()).length >= OUTBOX_LIMIT) return "full";
    await store.add({ owner: body.owner, at: body.at, body });
    announce();
    return "queued";
  } catch {
    return "unavailable";
  }
}

export interface FlushReport {
  sent: number;
  duplicate: number;
  dropped: number;
  /** Остались ждать — у этого владельца. */
  waiting: number;
  /** Чужие записи, которые лежат на телефоне и не отправлялись. */
  foreign: number;
  stoppedBy: "empty" | "network" | "session" | null;
}

type Send = typeof postReliablyForResult;

/**
 * Отправить записи владельца `owner` по порядку. Первая же сетевая
 * неудача останавливает проход: отправлять следующую раньше предыдущей —
 * значит переставить попытки урока местами.
 */
export async function flushWith(store: OutboxStore, owner: string, send: Send = postReliablyForResult): Promise<FlushReport> {
  const report: FlushReport = { sent: 0, duplicate: 0, dropped: 0, waiting: 0, foreign: 0, stoppedBy: null };
  let records: OutboxRecord[];
  try {
    records = await store.all();
  } catch {
    return report;
  }
  const mine = records.filter((r) => r.owner === owner);
  report.foreign = records.length - mine.length;
  if (owner === GUEST_OWNER || mine.length === 0) {
    report.waiting = 0;
    report.stoppedBy = "empty";
    return report;
  }
  let changed = false;
  for (let i = 0; i < mine.length; i++) {
    const record = mine[i];
    const result = await send(PROGRESS_URL, record.body, { beacon: false, attempts: 2, backoffMs: 300 });
    const verdict = verdictOf(result.outcome, result.status, result.body);
    if (verdict === "sent" || verdict === "duplicate" || verdict === "dropped") {
      if (record.id !== undefined) await store.remove(record.id).catch(() => {});
      report[verdict === "sent" ? "sent" : verdict === "duplicate" ? "duplicate" : "dropped"] += 1;
      changed = true;
      continue;
    }
    if (verdict === "keep") {
      report.waiting += 1;
      continue;
    }
    report.waiting += mine.length - i;
    report.stoppedBy = result.status === 401 ? "session" : "network";
    break;
  }
  if (changed) announce();
  return report;
}

export async function countWith(store: OutboxStore, owner: string, level?: string, lesson?: string): Promise<number> {
  try {
    const records = await store.all();
    return records.filter(
      (r) => r.owner === owner && (level === undefined || (r.body.level === level && r.body.lesson === lesson)),
    ).length;
  } catch {
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/* IndexedDB                                                           */
/* ------------------------------------------------------------------ */

const DB_NAME = "rf-progress-outbox";
const DB_VERSION = 1;
const STORE = "outbox";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexeddb-unavailable"));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("indexeddb-blocked"));
  }).catch((error) => {
    // Неудачное открытие не запоминается: хранилище может вернуться.
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = work(tx.objectStore(STORE));
        let value: T;
        request.onsuccess = () => {
          value = request.result as T;
        };
        tx.oncomplete = () => resolve(value);
        tx.onabort = tx.onerror = () => reject(tx.error ?? request.error);
      }),
  );
}

export const indexedDbOutbox: OutboxStore = {
  add: (record) => run<number>("readwrite", (s) => s.add(record)),
  all: () => run<OutboxRecord[]>("readonly", (s) => s.getAll()),
  remove: (id) => run<undefined>("readwrite", (s) => s.delete(id)).then(() => undefined),
};

/* ------------------------------------------------------------------ */
/* То, что зовут компоненты                                            */
/* ------------------------------------------------------------------ */

export function enqueueProgress(body: OutboxBody): Promise<EnqueueOutcome> {
  return enqueueWith(indexedDbOutbox, body);
}

let flushing: Promise<FlushReport> | null = null;

/** Одна отправка за раз на вкладку; вторая просьба ждёт первую. Две
 *  вкладки могут отправить одно и то же — сервер повтор ключа не примет. */
export function flushProgress(owner: string): Promise<FlushReport> {
  if (!flushing) {
    flushing = flushWith(indexedDbOutbox, owner).finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

export function pendingProgress(owner: string, level?: string, lesson?: string): Promise<number> {
  return countWith(indexedDbOutbox, owner, level, lesson);
}
