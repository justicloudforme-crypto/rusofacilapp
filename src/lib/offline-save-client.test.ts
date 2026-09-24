import { describe, expect, it } from "vitest";
import { indexUrl, saveCopy, type CacheNames } from "./offline-save-client";
import { maxEntriesFor, parseIndex } from "./offline-save";

/**
 * ЗАХОД 7.230 (ОФЛАЙН-2б, строка 309). Правило «страница кладёт копию
 * сама» проверяется на ПОДСТАВНЫХ кешах, а не на настоящих: браузера
 * здесь нет, а правило от браузера не зависит.
 *
 * Каждое утверждение двустороннее. «Закрытое не легло» без «открытое
 * легло» не значит ничего: класть могло быть нечего.
 */
class FakeCache {
  readonly store = new Map<string, Response>();
  async match(request: RequestInfo, _options?: CacheQueryOptions): Promise<Response | undefined> {
    const key = typeof request === "string" ? request : (request as Request).url;
    const hit = this.store.get(key);
    return hit ? hit.clone() : undefined;
  }
  async put(request: RequestInfo, response: Response): Promise<void> {
    const key = typeof request === "string" ? request : (request as Request).url;
    this.store.set(key, response);
  }
  async delete(request: RequestInfo, _options?: CacheQueryOptions): Promise<boolean> {
    const key = typeof request === "string" ? request : (request as Request).url;
    return this.store.delete(key);
  }
}

class FakeCaches {
  readonly caches = new Map<string, FakeCache>();
  async open(name: string): Promise<FakeCache> {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new FakeCache();
      this.caches.set(name, cache);
    }
    return cache;
  }
  async keys(): Promise<string[]> {
    return [...this.caches.keys()];
  }
}

const NAMES: CacheNames = {
  fingerprint: "abc123",
  content: "rf-pages-content-abc123",
  section: "rf-pages-section-abc123",
};

const ORIGIN = "https://rusofacilapp.com";
const OPEN_HTML = '<!doctype html><html><head><title>Урок 1 — RusoFácilapp</title></head><body>теория</body></html>';
const CLOSED_HTML = '<!doctype html><html><head><title>Урок 2</title><script type="application/ld+json">{"isAccessibleForFree":false}</script></head><body>витрина</body></html>';

function deps(over: Partial<Parameters<typeof saveCopy>[0]> = {}) {
  const store = new FakeCaches();
  return {
    store,
    args: {
      caches: store as unknown as CacheStorage,
      names: NAMES,
      url: `${ORIGIN}/ru/courses/a1/1`,
      pathname: "/ru/courses/a1/1",
      html: OPEN_HTML,
      title: "Урок 1 — RusoFácilapp",
      lang: "ru" as const,
      now: 1_800_000_000_000,
      ...over,
    },
  };
}

async function indexOf(store: FakeCaches) {
  const cache = await store.open(NAMES.content);
  const hit = await cache.match(indexUrl(ORIGIN));
  return hit ? parseIndex(await hit.json()) : [];
}

describe("saveCopy", () => {
  it("кладёт копию открытого урока и заводит на неё строку описи", async () => {
    const { store, args } = deps();
    expect(await saveCopy(args)).toBe("saved");
    const cache = await store.open(NAMES.content);
    expect(await cache.match(args.url)).toBeTruthy();
    const rows = await indexOf(store);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "lesson", title: "Урок 1", lang: "ru" });
  });

  it("ЗАКРЫТОЕ этому посетителю не кладётся — и обратный контроль тут же", async () => {
    const closed = deps({ html: CLOSED_HTML });
    expect(await saveCopy(closed.args)).toBe("removed-closed");
    expect((await closed.store.open(NAMES.content)).store.size).toBe(1); // только опись
    expect(await indexOf(closed.store)).toHaveLength(0);

    const open = deps();
    expect(await saveCopy(open.args)).toBe("saved");
    expect(await indexOf(open.store)).toHaveLength(1);
  });

  it("подписка кончилась — лежащая копия СТИРАЕТСЯ при первом же заходе с сетью", async () => {
    const { store, args } = deps();
    await saveCopy(args);
    expect(await (await store.open(NAMES.content)).match(args.url)).toBeTruthy();

    expect(await saveCopy({ ...args, html: CLOSED_HTML, now: args.now + 1000 })).toBe("removed-closed");
    expect(await (await store.open(NAMES.content)).match(args.url)).toBeUndefined();
    expect(await indexOf(store)).toHaveLength(0);
  });

  it("корень раздела ложится в СВОЙ кеш, а не в кеш содержания", async () => {
    const { store, args } = deps({ url: `${ORIGIN}/ru/courses`, pathname: "/ru/courses" });
    expect(await saveCopy(args)).toBe("saved");
    expect(await (await store.open(NAMES.section)).match(args.url)).toBeTruthy();
    expect(await (await store.open(NAMES.content)).match(args.url)).toBeUndefined();
  });

  it("потолок держится ПРОГОНОМ: запись сверх потолка выбрасывает самую старую, и из кеша тоже", async () => {
    const { store, args } = deps();
    const cap = maxEntriesFor("lesson");
    for (let i = 0; i <= cap; i += 1) {
      await saveCopy({
        ...args,
        url: `${ORIGIN}/ru/courses/a1/${i}`,
        pathname: `/ru/courses/a1/${i}`,
        now: args.now + i * 1000,
      });
    }
    const rows = await indexOf(store);
    expect(rows).toHaveLength(cap);
    const cache = await store.open(NAMES.content);
    expect(await cache.match(`${ORIGIN}/ru/courses/a1/0`)).toBeUndefined();
    expect(await cache.match(`${ORIGIN}/ru/courses/a1/${cap}`)).toBeTruthy();
  });

  it("страница, которую без сети не читают, не трогает ничего вовсе", async () => {
    const { store, args } = deps({ url: `${ORIGIN}/ru/profile`, pathname: "/ru/profile" });
    expect(await saveCopy(args)).toBe("skipped-not-content");
    expect(store.caches.size).toBe(0);
  });
});
