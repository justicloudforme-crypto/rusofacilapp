import { describe, expect, it, vi } from "vitest";
import {
  DOWNLOADS_CACHE_NAME,
  DOWNLOADS_MAX_BYTES,
  formatWeight,
  parseDownloads,
  totalBytes,
} from "./downloads";
import {
  downloadPage,
  indexUrlFor,
  isComplete,
  measureClips,
  readDownloads,
  removeAllDownloads,
  removeDownload,
} from "./downloads-client";
import { PAGE_CACHE_PREFIX, buildFingerprint, pageCacheNames, staleCacheNames } from "./sw-cache-names";
import { personalPageCaches } from "./signed-out";

/**
 * СКАЧИВАНИЕ — ЗАХОД 7.231 (ОФЛАЙН-3). Проверяется на ПОДСТАВНЫХ кешах и
 * подставной сети: браузера здесь нет, а правило от браузера не зависит.
 *
 * Каждое утверждение двустороннее. «Частичное не легло» без «целое легло»
 * не значит ничего: класть могло быть нечего.
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
  async keys(): Promise<Request[]> {
    return [...this.store.keys()].map((url) => ({ url }) as Request);
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
  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name);
  }
  async keys(): Promise<string[]> {
    return [...this.caches.keys()];
  }
}

const ORIGIN = "https://rusofacilapp.com";
const STORY = `${ORIGIN}/es/stories/snegurochka`;
const CLIPS = [
  "https://x.public.blob.vercel-storage.com/a.mp3",
  "https://x.public.blob.vercel-storage.com/b.mp3",
  "https://x.public.blob.vercel-storage.com/c.mp3",
];
const OPEN_HTML = "<!doctype html><html lang=\"es\"><head><title>Snegúrochka — RusoFácilapp</title></head><body>texto</body></html>";
const CLOSED_HTML =
  '<!doctype html><html lang="es"><head><title>Cuento</title><script type="application/ld+json">{"isAccessibleForFree":false}</script></head><body>vitrina</body></html>';

/** Подставная сеть: HEAD называет вес, GET отдаёт тело этого веса. */
function fakeNet(bytesByUrl: Record<string, number>, failOn: string[] = []) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (failOn.includes(url)) throw new TypeError("Failed to fetch");
    const bytes = bytesByUrl[url] ?? 0;
    if (init?.method === "HEAD") {
      return new Response(null, { status: 200, headers: { "content-length": String(bytes) } });
    }
    return new Response(new Uint8Array(bytes), { status: 200, headers: { "content-length": String(bytes) } });
  });
}

const SIZES = { [CLIPS[0]]: 117_120, [CLIPS[1]]: 72_192, [CLIPS[2]]: 131_328 };

function args(over: Partial<Parameters<typeof downloadPage>[0]> = {}) {
  const store = new FakeCaches();
  return {
    store,
    args: {
      caches: store as unknown as CacheStorage,
      fetch: fakeNet(SIZES),
      url: STORY,
      pathname: "/es/stories/snegurochka",
      html: OPEN_HTML,
      title: "Snegúrochka — RusoFácilapp",
      lang: "es" as const,
      clipUrls: CLIPS,
      now: 1_800_000_000_000,
      ...over,
    },
  };
}

describe("вес считается из настоящих ответов, а не из среднего", () => {
  it("HEAD называет каждый клип своим весом", async () => {
    const net = fakeNet(SIZES);
    const measured = await measureClips(CLIPS, net);
    expect(measured.unknown).toBe(0);
    expect(measured.clips.map((c) => c.bytes)).toEqual([117_120, 72_192, 131_328]);
    // Именно замер, а не среднее: три числа разные, и подмена средним
    // (по 106 880 на каждый) провалила бы эту строку.
    expect(new Set(measured.clips.map((c) => c.bytes)).size).toBe(3);
  });

  it("клип, о котором источник промолчал, считается неизвестным, а не средним", async () => {
    const measured = await measureClips(CLIPS, fakeNet({ ...SIZES, [CLIPS[1]]: 0 }));
    expect(measured.unknown).toBe(1);
    expect(measured.clips.find((c) => c.url === CLIPS[1])?.bytes).toBe(0);
  });

  it("запрос уходит без единого лишнего заголовка — иначе источник отвечает 405 на OPTIONS", async () => {
    const net = fakeNet(SIZES);
    await measureClips([CLIPS[0]], net);
    const init = net.mock.calls[0][1]!;
    expect(init.mode).toBe("cors");
    expect(init.credentials).toBe("omit");
    expect((init as { headers?: unknown }).headers).toBeUndefined();
  });
});

describe("downloadPage", () => {
  it("кладёт страницу И все клипы, заводит строку описи и считает вес", async () => {
    const { store, args: a } = args();
    const progress: string[] = [];
    expect(await downloadPage({ ...a, onProgress: (d, t) => progress.push(`${d}/${t}`) })).toBe("downloaded");

    const cache = await store.open(DOWNLOADS_CACHE_NAME);
    expect(await cache.match(STORY), "разметки страницы в кеше скачанного нет").toBeTruthy();
    for (const clip of CLIPS) expect(await cache.match(clip), `клип ${clip} не скачан`).toBeTruthy();

    const rows = await readDownloads(a.caches, ORIGIN);
    expect(rows).toHaveLength(1);
    expect(rows[0].clips).toHaveLength(3);
    expect(rows[0].bytes).toBe(117_120 + 72_192 + 131_328 + new TextEncoder().encode(OPEN_HTML).length);
    expect(rows[0].title).toBe("Snegúrochka");
    expect(progress.at(0)).toBe("1/4");
    expect(progress.at(-1)).toBe("4/4");
  });

  it("второе нажатие не качает заново", async () => {
    const { args: a } = args();
    expect(await downloadPage(a)).toBe("downloaded");
    const net = fakeNet(SIZES);
    expect(await downloadPage({ ...a, fetch: net })).toBe("already");
    expect(net).not.toHaveBeenCalled();
  });

  it("ОБРЫВ СЕТИ НА СЕРЕДИНЕ: частичное стирается целиком и за готовое не выдаётся", async () => {
    const { store, args: a } = args({ fetch: fakeNet(SIZES, [CLIPS[1]]) });
    expect(await downloadPage(a)).toBe("network-failed");
    const cache = await store.open(DOWNLOADS_CACHE_NAME);
    expect(await cache.match(STORY), "разметка осталась лежать после отката").toBeUndefined();
    expect(await cache.match(CLIPS[0]), "первый клип остался лежать после отката").toBeUndefined();
    expect(await readDownloads(a.caches, ORIGIN), "строка описи заведена под недокачанное").toHaveLength(0);

    // Позитивный контроль на том же месте: без обрыва тот же заход кладёт всё.
    const ok = args();
    expect(await downloadPage(ok.args)).toBe("downloaded");
    expect(await readDownloads(ok.args.caches, ORIGIN)).toHaveLength(1);
  });

  it("отказ источника (403/404) — это тоже обрыв, а не «скачано»", async () => {
    const net = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": "1000" } });
      return url === CLIPS[2] ? new Response("no", { status: 403 }) : new Response(new Uint8Array(1000), { status: 200 });
    });
    const { store, args: a } = args({ fetch: net });
    expect(await downloadPage(a)).toBe("network-failed");
    expect((await store.open(DOWNLOADS_CACHE_NAME)).store.size).toBe(0);
  });

  it("не хватило места — честный отказ и откат, а не половина рассказа", async () => {
    const store = new FakeCaches();
    const real = store.open.bind(store);
    let puts = 0;
    store.open = async (name: string) => {
      const cache = await real(name);
      const put = cache.put.bind(cache);
      cache.put = async (request: RequestInfo, response: Response) => {
        puts += 1;
        if (puts === 3) {
          const error = new Error("quota");
          error.name = "QuotaExceededError";
          throw error;
        }
        return put(request, response);
      };
      return cache;
    };
    const a = { ...args().args, caches: store as unknown as CacheStorage };
    expect(await downloadPage(a)).toBe("no-space");
    expect((await store.open(DOWNLOADS_CACHE_NAME)).store.size, "после отказа по месту что-то осталось лежать").toBe(0);
  });

  it("не влезает в потолок веса — отказ ДО первого запроса", async () => {
    const { store, args: a } = args();
    await downloadPage(a);
    // Заполняем опись почти до потолка руками — так же, как это сделали бы
    // девяносто настоящих скачиваний.
    const cache = await store.open(DOWNLOADS_CACHE_NAME);
    await cache.put(
      indexUrlFor(ORIGIN),
      new Response(
        JSON.stringify([
          {
            url: `${ORIGIN}/es/courses/a1/9`,
            path: "/es/courses/a1/9",
            kind: "lesson",
            title: "x",
            lang: "es",
            savedAt: 1,
            pageBytes: DOWNLOADS_MAX_BYTES,
            clips: [],
            bytes: DOWNLOADS_MAX_BYTES,
          },
        ]),
      ),
    );
    const net = fakeNet(SIZES);
    expect(await downloadPage({ ...a, url: `${ORIGIN}/es/courses/a1/1`, pathname: "/es/courses/a1/1", fetch: net })).toBe(
      "too-big",
    );
    expect(net, "вес спрашивали, хотя отказ был предрешён").toHaveBeenCalledTimes(CLIPS.length);
  });

  it("ЗАКРЫТОЕ этому посетителю не качается, а лежащее стирается", async () => {
    const { store, args: a } = args();
    expect(await downloadPage(a)).toBe("downloaded");
    expect(await downloadPage({ ...a, html: CLOSED_HTML })).toBe("closed");
    const cache = await store.open(DOWNLOADS_CACHE_NAME);
    expect(await cache.match(STORY)).toBeUndefined();
    expect(await cache.match(CLIPS[0]), "клипы закрывшегося материала остались на телефоне").toBeUndefined();
    expect(await readDownloads(a.caches, ORIGIN)).toHaveLength(0);
  });

  it("корень раздела не качается вовсе — качать там нечего", async () => {
    const { args: a } = args({ url: `${ORIGIN}/es/courses`, pathname: "/es/courses" });
    expect(await downloadPage(a)).toBe("skipped-not-content");
  });
});

describe("удаление скачанного", () => {
  it("удаление одного уносит и страницу, и её клипы, и строку", async () => {
    const { store, args: a } = args();
    await downloadPage(a);
    const other = { ...a, url: `${ORIGIN}/es/courses/a1/1`, pathname: "/es/courses/a1/1", clipUrls: [CLIPS[0]] };
    await downloadPage(other);
    expect(await readDownloads(a.caches, ORIGIN)).toHaveLength(2);

    expect(await removeDownload(a.caches, STORY)).toBe(4);
    const rows = await readDownloads(a.caches, ORIGIN);
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe(other.url);
    const cache = await store.open(DOWNLOADS_CACHE_NAME);
    expect(await cache.match(STORY)).toBeUndefined();
    // Клип, общий с оставшимся материалом, удалён вместе с рассказом — и это
    // честно названное последствие: опись оставшегося перестанет быть
    // целой, и `isComplete` скажет об этом прямо.
    expect(await isComplete(a.caches, rows[0])).toBe(false);
  });

  it("удалить всё — кеш уносится целиком, вместе с описью", async () => {
    const { store, args: a } = args();
    await downloadPage(a);
    expect(await removeAllDownloads(a.caches)).toBe(true);
    expect(store.caches.has(DOWNLOADS_CACHE_NAME)).toBe(false);
    expect(await readDownloads(a.caches, ORIGIN)).toHaveLength(0);
  });
});

describe("имя кеша скачанного держит два обещания сразу", () => {
  it("выкат сайта его НЕ уносит — при любом отпечатке (а кеш содержания уносит: контроль)", () => {
    const live = [pageCacheNames("aaa").content, pageCacheNames("aaa").downloads];
    expect(staleCacheNames(live, "bbb")).toEqual([pageCacheNames("aaa").content]);
    expect(staleCacheNames(live, "aaa")).toEqual([]);
    expect(pageCacheNames("bbb").downloads).toBe(pageCacheNames("aaa").downloads);
  });

  it("выход из учётной записи его уносит — он начинается с rf-pages", () => {
    expect(DOWNLOADS_CACHE_NAME.startsWith(PAGE_CACHE_PREFIX)).toBe(true);
    expect(personalPageCaches([DOWNLOADS_CACHE_NAME, "rf-audio"])).toEqual([DOWNLOADS_CACHE_NAME]);
  });

  it("в имени нет отпечатка сборки — иначе обещание «скачано» жило бы до первого выката", () => {
    // Утверждение прогоном, а не по виду строки: имя строится тремя
    // разными отпечатками и обязано выйти одним и тем же, тогда как имя
    // кеша содержания на тех же трёх — тремя разными (контроль рядом).
    const fps = ["aaa111", "bbb222", buildFingerprint(["/x.js"])];
    expect(new Set(fps.map((fp) => pageCacheNames(fp).downloads)).size).toBe(1);
    expect(new Set(fps.map((fp) => pageCacheNames(fp).content)).size).toBe(3);
    for (const fp of fps) expect(DOWNLOADS_CACHE_NAME).not.toContain(fp);
  });
});

describe("вес человеческими словами", () => {
  it("запятая как разделитель дроби в обеих локалях", () => {
    expect(formatWeight(1_735_593, "es")).toBe("1,7 MB");
    expect(formatWeight(1_735_593, "ru")).toBe("1,7 МБ");
    expect(formatWeight(0, "es")).toBe("0,0 MB");
    expect(formatWeight(1000, "es")).toBe("0,1 MB");
    expect(formatWeight(157_286_400, "ru")).toBe("150 МБ");
  });

  it("общий вес складывается из строк, а не выдумывается", () => {
    const rows = parseDownloads([
      { url: "a", path: "/es/stories/a", kind: "story", savedAt: 1, pageBytes: 100, clips: [{ url: "c", bytes: 900 }] },
      { url: "b", path: "/es/courses/a1/1", kind: "lesson", savedAt: 2, pageBytes: 50, clips: [] },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].bytes).toBe(1000);
    expect(totalBytes(rows)).toBe(1050);
  });
});
