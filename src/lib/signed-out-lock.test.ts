import { describe, expect, it } from "vitest";
import { createSignedOutLock, type CacheStorageLike } from "./signed-out-lock";

/**
 * ДОЛГ 318 (7.291): замок на уборку после выхода — на подставном
 * хранилище, где порядок событий задаётся тестом, а не часами браузера.
 * Каждый случай — один порядок «запрос начат / выход / ответ ложится».
 */

type Entries = Map<string, Set<string>>;

function fakeStorage(names: string[]): { storage: CacheStorageLike; entries: Entries } {
  const entries: Entries = new Map(names.map((name) => [name, new Set(["/es/profile"])]));
  const storage: CacheStorageLike = {
    keys: async () => [...entries.keys()],
    has: async (name) => entries.has(name),
    open: async (name) => {
      if (!entries.has(name)) entries.set(name, new Set());
      const set = entries.get(name)!;
      return { delete: async (request) => set.delete(typeof request === "string" ? request : new URL(request.url).pathname) };
    },
    delete: async (name) => entries.delete(name),
  };
  return { storage, entries };
}

/** Один запрос стратегии: своё `state`, как у Serwist на каждый вызов. */
function startRequest(lock: ReturnType<typeof createSignedOutLock>) {
  const state: Record<string, unknown> = {};
  const p = lock.plugin as Required<typeof lock.plugin>;
  const request = new Request("https://rusofacilapp.com/es/profile");
  const response = new Response("личная страница");
  return {
    started: (p.handlerWillStart as (x: unknown) => Promise<void>)({ state, request, event: {} }),
    willUpdate: () => (p.cacheWillUpdate as (x: unknown) => Promise<Response | null>)({ state, request, response, event: {} }),
    didUpdate: (cacheName: string) =>
      (p.cacheDidUpdate as (x: unknown) => Promise<void>)({ state, request, cacheName, newResponse: response, event: {} }),
  };
}

describe("замок выхода (долг 318)", () => {
  const PERSONAL = ["rf-pages-abc", "rf-pages-rsc-abc", "rf-pages-content-abc", "apis"];
  const SHARED = ["static-audio-assets", "rf-audio", "serwist-precache-v2-x"];

  it("выход стирает кеши документов и `apis`, общие не трогает", async () => {
    const { storage, entries } = fakeStorage([...PERSONAL, ...SHARED]);
    const lock = createSignedOutLock(storage);
    const deleted = await lock.signOut();
    expect(deleted.sort()).toEqual([...PERSONAL].sort());
    expect([...entries.keys()].sort()).toEqual([...SHARED].sort());
  });

  it("запрос, начатый ДО выхода, после выхода в кеш не ложится", async () => {
    const { storage } = fakeStorage(PERSONAL);
    const lock = createSignedOutLock(storage);
    const old = startRequest(lock);
    await old.started;
    await lock.signOut();
    expect(await old.willUpdate()).toBeNull();
  });

  it("ответ, проскочивший проверку до выхода и легший после, стирается", async () => {
    const { storage, entries } = fakeStorage(PERSONAL);
    const lock = createSignedOutLock(storage);
    const old = startRequest(lock);
    await old.started;
    expect(await old.willUpdate()).not.toBeNull(); // проверка прошла ДО выхода
    await lock.signOut();
    // `cache.put` старого запроса создал кеш заново — так делает `caches.open`.
    entries.set("rf-pages-abc", new Set(["/es/profile"]));
    await old.didUpdate("rf-pages-abc");
    expect(entries.get("rf-pages-abc")!.size).toBe(0);
  });

  it("стёртый кеш `cacheDidUpdate` заново не заводит", async () => {
    const { storage, entries } = fakeStorage(PERSONAL);
    const lock = createSignedOutLock(storage);
    const old = startRequest(lock);
    await old.started;
    await lock.signOut();
    await old.didUpdate("rf-pages-abc");
    expect(entries.has("rf-pages-abc")).toBe(false);
  });

  it("запрос, начатый ПОСЛЕ выхода (гость), ложится как обычно — офлайн гостю нужен", async () => {
    const { storage, entries } = fakeStorage(PERSONAL);
    const lock = createSignedOutLock(storage);
    await lock.signOut();
    const guest = startRequest(lock);
    await guest.started;
    expect(await guest.willUpdate()).not.toBeNull();
    entries.set("rf-pages-abc", new Set(["/es/profile"]));
    await guest.didUpdate("rf-pages-abc");
    expect(entries.get("rf-pages-abc")!.size).toBe(1);
  });

  it("без выхода замок ничего не меняет (вошедший ученик кеширует как раньше)", async () => {
    const { storage } = fakeStorage(PERSONAL);
    const lock = createSignedOutLock(storage);
    const r = startRequest(lock);
    await r.started;
    expect(await r.willUpdate()).not.toBeNull();
    expect(lock.epoch()).toBe(0);
  });
});
