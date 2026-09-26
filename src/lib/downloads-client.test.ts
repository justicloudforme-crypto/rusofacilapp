import { describe, expect, it, vi } from "vitest";
import {
  DOWNLOADS_CACHE_NAME,
  DOWNLOADS_MAX_BYTES,
  formatWeight,
  langMark,
  langOfPath,
  parseDownloads,
  totalBytes,
  urlsOf,
  withoutDuplicates,
} from "./downloads";
import { sheetUrlsInHtml } from "./offline-save";
import {
  copyMarkupOf,
  downloadPage,
  healDownloads,
  withSheetLinks,
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

/**
 * СНИМОК СТРАНИЦЫ — ЗАХОД 7.232, СТРОКА 313.
 *
 * Владелец 25.09.2026 открыл скачанную «Снегурочку» без сети и увидел на
 * кнопке «↓ 0 / 13» — состояние начала скачивания, застывшее навсегда.
 * Живой документ здесь настоящий (jsdom), и первое утверждение каждой
 * пары — позитивный контроль: на СТАРОМ способе (`outerHTML` как есть)
 * промежуточная надпись в снимок попадает.
 */
function pageWithButton(label: string): Document {
  document.documentElement.innerHTML = `
    <head><title>Снегурочка — cuento en ruso (A1) | RusoFácilapp</title></head>
    <body>
      <div data-rf-download>
        <button type="button" data-rf-download-button aria-busy="true">
          <span aria-hidden="true">↓</span><span data-rf-download-label>${label}</span>
        </button>
        <p data-rf-download-note>Página y 12 audios</p>
      </div>
      <p>texto</p>
    </body>`;
  return document;
}

describe("снимок скачанной страницы", () => {
  it("промежуточное «0 / 13» в снимок не попадает, а «✓ Descargado» попадает", () => {
    const doc = pageWithButton("0 / 13");

    // ПОЗИТИВНЫЙ КОНТРОЛЬ: прежний способ уносил в копию ровно это.
    expect(doc.documentElement.outerHTML, "надпись «0 / 13» на живой странице не стоит — мерить нечего").toContain(
      "0 / 13",
    );

    const copy = copyMarkupOf(doc, "Descargado");
    expect(copy, "в скачанную копию легло состояние начала скачивания").not.toContain("0 / 13");
    expect(copy).toContain("Descargado");
    expect(copy).toContain("✓</span>");
    // ОДНА ГАЛОЧКА (заход 7.235, находка 2 захода 7.234): значок кнопки
    // уже ставит «✓», и строка «done» второй галочки не несёт.
    expect(copy.match(/✓/g)?.length, "на кнопке скачанной копии две галочки — «✓ Descargado ✓»").toBe(1);
    expect(copy).toContain("disabled");
    expect(copy, "заметка «Página y 12 audios» — про нажатие, а не про материал").not.toContain("Página y 12 audios");
    expect(copy.startsWith("<!doctype html>\n<html")).toBe(true);
  });

  it("у просто сохранённой копии кнопки нет вовсе", () => {
    const doc = pageWithButton("Descargar 1,4 MB");
    const copy = copyMarkupOf(doc, null);
    expect(copy).not.toContain("data-rf-download-button");
    expect(copy).not.toContain("Descargar 1,4 MB");
    expect(copy, "вместе с кнопкой унесли и саму страницу").toContain("texto");
  });

  it("живой документ снимком НЕ портится", () => {
    const doc = pageWithButton("0 / 13");
    copyMarkupOf(doc, "Descargado");
    expect(doc.querySelector("[data-rf-download-label]")?.textContent).toBe("0 / 13");
  });
});

describe("название строки скачанного", () => {
  it("пустое название берётся из самой копии (а непустое остаётся своим)", async () => {
    const own = args();
    expect(await downloadPage(own.args)).toBe("downloaded");
    expect((await readDownloads(own.args.caches, STORY))[0].title).toBe("Snegúrochka");

    const blank = args({ title: "" });
    expect(await downloadPage(blank.args)).toBe("downloaded");
    const rows = await readDownloads(blank.args.caches, STORY);
    expect(rows[0].title, "строка без названия — список показал бы адрес").toBe("Snegúrochka");
  });

  it("опись, УЖЕ лежащая с пустым названием, дополняется при чтении — и не переписывается", async () => {
    // Такая опись лежит на телефонах, где скачивали ДО этой правки:
    // название там пустое, и список показывал вместо него адрес.
    const { args: a, store } = args();
    expect(await downloadPage(a)).toBe("downloaded");
    const cache = await store.open(DOWNLOADS_CACHE_NAME);
    const raw = (await (await cache.match(indexUrlFor(STORY)))!.json()) as { title: string }[];
    raw[0].title = "";
    await cache.put(indexUrlFor(STORY), new Response(JSON.stringify(raw)));

    // ПОЗИТИВНЫЙ КОНТРОЛЬ: на диске названия и правда нет.
    expect((await (await cache.match(indexUrlFor(STORY)))!.json())[0].title).toBe("");

    const rows = await readDownloads(a.caches, STORY);
    expect(rows[0].title, "название не подобрано у копии — на экран пошёл бы адрес").toBe("Snegúrochka");
    expect(rows[0].title).not.toContain("/");
    // Чтение не пишет: опись на диске осталась прежней.
    expect((await (await cache.match(indexUrlFor(STORY)))!.json())[0].title).toBe("");
  });
});


/**
 * ЛИСТЫ СТИЛЕЙ ЛОЖАТСЯ ВМЕСТЕ СО СКАЧАННЫМ — ЗАХОД 7.233, СТРОКА 314.
 *
 * Что это чинит, дословно по видео владельца 26.09.2026 (1.0.8, POCO):
 * гостем скачаны «Снегурочка» и урок A1/1, приложение убито, Wi-Fi
 * выключен, запуск — «Aún no hay nada guardado», «Guardado: 0», блока
 * «Descargado» нет; а копии при этом лежат (в 2:47 с сетью кнопка
 * говорит «Descargado ✓»). Прогон 26.09.2026 `.run7233/repro2.mjs
 * css-gone` показал это состояние знак в знак: четырнадцать записей в
 * кеше скачанного, опись из одной строки — и пустой экран, потому что
 * из ЧУЖОГО кеша пропали два файла `/_next/static/css/…`.
 */
const STYLED_HTML =
  '<!doctype html><html lang="es"><head><title>Snegúrochka — RusoFácilapp</title>' +
  '<link rel="stylesheet" href="/_next/static/css/aaa.css"/>' +
  '<link rel="stylesheet" href="/_next/static/css/bbb.css"/>' +
  '<link rel="stylesheet" href="https://fonts.example.com/x.css"/>' +
  "</head><body>texto</body></html>";
const SHEETS = [`${ORIGIN}/_next/static/css/aaa.css`, `${ORIGIN}/_next/static/css/bbb.css`];
const STYLED_SIZES = { ...SIZES, [SHEETS[0]]: 6_506, [SHEETS[1]]: 167_861 };

describe("скачанное несёт свои листы стилей", () => {
  it("они ложатся в кеш скачанного, попадают в опись и входят в «лежит целиком»", async () => {
    const { store, args: a } = args({ html: STYLED_HTML, fetch: fakeNet(STYLED_SIZES) });
    expect(await downloadPage(a)).toBe("downloaded");

    const cache = await store.open(DOWNLOADS_CACHE_NAME);
    for (const sheet of SHEETS) {
      expect(await cache.match(sheet), `листа стилей ${sheet} нет рядом со скачанным`).toBeTruthy();
    }
    const rows = await readDownloads(a.caches, ORIGIN);
    expect(rows[0].sheets).toEqual(SHEETS);
    // ЧУЖОЙ ИСТОЧНИК НЕ БЕРЁТСЯ: платить мегабайтами за чужие шрифты
    // скачивание не подписывалось. Это и отрицательный контроль разбора.
    expect(rows[0].sheets.some((url) => url.includes("fonts.example.com"))).toBe(false);
    expect(urlsOf(rows[0])).toEqual(expect.arrayContaining(SHEETS));
    expect(await isComplete(a.caches, rows[0])).toBe(true);

    // ПОЗИТИВНЫЙ КОНТРОЛЬ ТОГО ЖЕ УТВЕРЖДЕНИЯ: убери лист — и «целиком»
    // честно станет ложью. Без этой строки предыдущая не значит ничего.
    await cache.delete(SHEETS[0]);
    expect(await isComplete(a.caches, rows[0])).toBe(false);
  });

  it("лист не качается второй раз, если уже лежит рядом", async () => {
    const { args: a } = args({ html: STYLED_HTML, fetch: fakeNet(STYLED_SIZES) });
    expect(await downloadPage(a)).toBe("downloaded");
    const net = fakeNet(STYLED_SIZES);
    const second = args({
      html: STYLED_HTML,
      fetch: net,
      url: `${ORIGIN}/es/courses/a1/1`,
      pathname: "/es/courses/a1/1",
      clipUrls: [],
    });
    // тот же кеш, что и у первой строки
    const shared = { ...second.args, caches: a.caches };
    expect(await downloadPage(shared)).toBe("downloaded");
    expect(net.mock.calls.some(([url]) => SHEETS.includes(url as string))).toBe(false);
  });

  it("отказ сети НА ЛИСТЕ не роняет скачивание — рассказ дороже стиля", async () => {
    const { args: a } = args({
      html: STYLED_HTML,
      fetch: fakeNet(STYLED_SIZES, [SHEETS[1]]),
    });
    expect(await downloadPage(a)).toBe("downloaded");
    const rows = await readDownloads(a.caches, ORIGIN);
    expect(rows[0].sheets).toEqual([SHEETS[0]]);
  });

  it("удаление одного материала НЕ уносит лист, нужный соседу", async () => {
    const first = args({ html: STYLED_HTML, fetch: fakeNet(STYLED_SIZES) });
    expect(await downloadPage(first.args)).toBe("downloaded");
    const second = {
      ...first.args,
      url: `${ORIGIN}/es/courses/a1/1`,
      pathname: "/es/courses/a1/1",
      clipUrls: [],
      html: STYLED_HTML,
    };
    expect(await downloadPage(second)).toBe("downloaded");

    await removeDownload(first.args.caches, STORY);
    const cache = await first.store.open(DOWNLOADS_CACHE_NAME);
    for (const sheet of SHEETS) {
      expect(await cache.match(sheet), `лист ${sheet} унесён вместе с соседом`).toBeTruthy();
    }
    expect(await cache.match(STORY), "сама страница не удалена").toBeFalsy();

    // ПОЗИТИВНЫЙ КОНТРОЛЬ: когда соседа больше нет, лист уходит.
    await removeDownload(first.args.caches, `${ORIGIN}/es/courses/a1/1`);
    expect(await cache.match(SHEETS[0])).toBeFalsy();
  });

  it("разбор листов из разметки берёт только свой источник", () => {
    expect(sheetUrlsInHtml(STYLED_HTML, STORY)).toEqual(SHEETS);
    expect(sheetUrlsInHtml("<link rel=icon href=/x.ico>", STORY)).toEqual([]);
  });
});

/**
 * ОПИСЬ ПУСТА, А КЕШ ПОЛОН — ЗАХОД 7.233, СТРОКА 315.
 *
 * Прогон 26.09.2026 `.run7233/repro2.mjs index-gone` на коде ДО правки:
 * стёрта одна запись описи при тринадцати живых записях кеша — блок
 * «Descargado» исчезает целиком, вес не назван, удалять нечего, а
 * рассказ лежит и открывается.
 */
describe("опись потеряна, а скачанное лежит", () => {
  it("строка восстанавливается из самого кеша — и честно без веса из описи", async () => {
    const { store, args: a } = args();
    expect(await downloadPage(a)).toBe("downloaded");
    const cache = await store.open(DOWNLOADS_CACHE_NAME);

    // ПОЗИТИВНЫЙ КОНТРОЛЬ: с описью строка приходит со своим весом.
    const listed = await readDownloads(a.caches, ORIGIN);
    expect(listed).toHaveLength(1);
    expect(listed[0].bytes).toBeGreaterThan(300_000);
    expect(listed[0].clips).toHaveLength(3);

    await cache.delete(indexUrlFor(ORIGIN));
    const restored = await readDownloads(a.caches, ORIGIN);
    expect(restored, "строка не восстановлена — список бы опустел").toHaveLength(1);
    expect(restored[0].url).toBe(STORY);
    expect(restored[0].title).toBe("Snegúrochka");
    // Ни веса материала, ни клипов у восстановленной строки нет: без
    // описи связать клип с рассказом нечем, и приписывать наугад значило
    // бы соврать в «удалить».
    expect(restored[0].clips).toEqual([]);
    expect(restored[0].bytes).toBe(new TextEncoder().encode(OPEN_HTML).length);
    // Чтение не пишет: описи на диске по-прежнему нет.
    expect(await cache.match(indexUrlFor(ORIGIN))).toBeFalsy();
  });

  it("чужие записи кеша строками не становятся", async () => {
    const { store, args: a } = args();
    expect(await downloadPage(a)).toBe("downloaded");
    const cache = await store.open(DOWNLOADS_CACHE_NAME);
    await cache.delete(indexUrlFor(ORIGIN));
    const rows = await readDownloads(a.caches, ORIGIN);
    // Клипы лежат в том же кеше, но материалами они не являются.
    expect(rows).toHaveLength(1);
    expect(rows.every((row) => !row.url.includes(".mp3"))).toBe(true);
  });
});

/**
 * ДВЕ ЛОКАЛИ ОДНОЙ СТРАНИЦЫ — ЗАХОД 7.233, СТРОКА 316.
 *
 * Владелец получил в списке две строки «Снегурочка · Cuento · Descargado
 * · 1,4 MB», различить которые нечем: адреса разные, название одно.
 */
describe("пометка языка у строки", () => {
  it("берётся из адреса, а не из описи", () => {
    expect(langOfPath("/ru/stories/snegurochka")).toBe("ru");
    expect(langOfPath("/es/stories/snegurochka")).toBe("es");
    expect(langOfPath("/rules/x")).toBe("es");
    expect(langMark("ru")).toBe("RU");
    expect(langMark("es")).toBe("ES");
  });

  it("две локали одного рассказа — две РАЗНЫЕ строки с разными пометками", async () => {
    const first = args();
    expect(await downloadPage(first.args)).toBe("downloaded");
    expect(
      await downloadPage({
        ...first.args,
        url: `${ORIGIN}/ru/stories/snegurochka`,
        pathname: "/ru/stories/snegurochka",
        lang: "ru",
      }),
    ).toBe("downloaded");
    const rows = await readDownloads(first.args.caches, ORIGIN);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => langMark(langOfPath(row.path)))).size, "пометки одинаковые — строки не различить").toBe(2);
  });

  it("дубль одного адреса в списке не выживает", () => {
    const one = parseDownloads([
      { url: STORY, path: "/es/stories/snegurochka", kind: "story", savedAt: 2, title: "свежая" },
      { url: STORY, path: "/es/stories/snegurochka", kind: "story", savedAt: 1, title: "старая" },
    ]);
    expect(one).toHaveLength(2);
    const clean = withoutDuplicates(one);
    expect(clean).toHaveLength(1);
    expect(clean[0].title).toBe("свежая");
  });
});


/**
 * СКАЧАННОЕ ДО #412 ДОЛЕЧИВАЕТСЯ ПРИ ЗАХОДЕ С СЕТЬЮ — ЗАХОД 7.235.
 *
 * Видео владельца 26.09.2026: кабинет — две строки «Descargado», каркас без
 * сети — «Guardado: 0». Эмулятор 7.235: скачано кодом ДО мержа #412,
 * выкат, без сети — «кешей 2 · описей 2 · строк 2 · показано 0». Своих
 * листов стилей у такой строки нет, а её лист (`…css?dpl=<старый выкат>`)
 * жил только в кеше с отпечатком сборки и ушёл с выкатом.
 */
const OLD_SHEET = `${ORIGIN}/_next/static/css/old.css?dpl=dpl_OLD`;
const NEW_SHEETS = [`${ORIGIN}/_next/static/css/new1.css?dpl=dpl_NEW`, `${ORIGIN}/_next/static/css/new2.css?dpl=dpl_NEW`];
const LEGACY_HTML =
  '<!doctype html><html lang="es"><head><title>Snegúrochka — RusoFácilapp</title>' +
  '<link rel="stylesheet" href="/_next/static/css/old.css?dpl=dpl_OLD" data-precedence="next"/>' +
  "</head><body>texto</body></html>";

/** Скачанное кодом до #412: страница, клипы и опись БЕЗ листов стилей. */
async function legacyDownload(store: FakeCaches): Promise<FakeCache> {
  const cache = await store.open(DOWNLOADS_CACHE_NAME);
  await cache.put(STORY, new Response(LEGACY_HTML, { status: 200 }));
  for (const clip of CLIPS) await cache.put(clip, new Response(new Uint8Array(10), { status: 200 }));
  const row = {
    url: STORY,
    path: "/es/stories/snegurochka",
    kind: "story",
    title: "Снегурочка",
    lang: "es",
    savedAt: 1,
    pageBytes: LEGACY_HTML.length,
    clips: CLIPS.map((url) => ({ url, bytes: 10 })),
    bytes: LEGACY_HTML.length + 30,
  };
  await cache.put(indexUrlFor(ORIGIN), new Response(JSON.stringify([row]), { status: 200 }));
  return cache;
}

/** Тот же вопрос, что задаёт каркас (`keepPresent`): лежит ли хоть один
 *  лист стилей, объявленный самой копией. */
async function shellWouldShow(store: FakeCaches): Promise<boolean> {
  const cache = await store.open(DOWNLOADS_CACHE_NAME);
  const page = await cache.match(STORY);
  if (!page) return false;
  for (const sheet of sheetUrlsInHtml(await page.text(), STORY)) if (await cache.match(sheet)) return true;
  return false;
}

function serverAfterDeploy(servesOld: boolean) {
  return vi.fn(async (url: string) => {
    if (NEW_SHEETS.includes(url) || (servesOld && url === OLD_SHEET)) return new Response("body{}", { status: 200 });
    return new Response("not found", { status: 404 });
  });
}

describe("долечивание скачанного после выката (заход 7.235)", () => {
  it("старого листа на сервере нет — копия переходит на листы текущей сборки и снова видна каркасу", async () => {
    const store = new FakeCaches();
    await legacyDownload(store);
    // ПОЗИТИВНЫЙ КОНТРОЛЬ: это и есть экран владельца — каркасу показать нечем.
    expect(await shellWouldShow(store), "стенд не воспроизводит «Guardado: 0» — мерить нечего").toBe(false);

    const net = serverAfterDeploy(false);
    const outcome = await healDownloads({
      caches: store as unknown as CacheStorage,
      fetch: net,
      origin: ORIGIN,
      currentSheets: NEW_SHEETS,
    });
    expect(outcome).toEqual({ rows: 1, healed: 0, rewritten: 1, failed: 0 });
    expect(await shellWouldShow(store), "после лечения каркас всё ещё не видит скачанное").toBe(true);

    const rows = await readDownloads(store as unknown as CacheStorage, ORIGIN);
    expect(rows[0].sheets).toEqual(NEW_SHEETS);
    expect(rows[0].clips).toHaveLength(CLIPS.length);
    expect(await isComplete(store as unknown as CacheStorage, rows[0])).toBe(true);
    // Клипы не качались заново: только листы стилей.
    expect(net.mock.calls.every(([url]) => url.includes("/_next/static/css/"))).toBe(true);

    // Второй заход ничего не трогает.
    const again = await healDownloads({
      caches: store as unknown as CacheStorage,
      fetch: net,
      origin: ORIGIN,
      currentSheets: NEW_SHEETS,
    });
    expect(again).toEqual({ rows: 1, healed: 0, rewritten: 0, failed: 0 });
  });

  it("старый лист сервер ещё отдаёт — он и докладывается, разметка не меняется", async () => {
    const store = new FakeCaches();
    const cache = await legacyDownload(store);
    const outcome = await healDownloads({
      caches: store as unknown as CacheStorage,
      fetch: serverAfterDeploy(true),
      origin: ORIGIN,
      currentSheets: NEW_SHEETS,
    });
    expect(outcome).toEqual({ rows: 1, healed: 1, rewritten: 0, failed: 0 });
    expect(await (await cache.match(STORY))!.text()).toBe(LEGACY_HTML);
    expect((await readDownloads(store as unknown as CacheStorage, ORIGIN))[0].sheets).toEqual([OLD_SHEET]);
  });

  it("сеть отказала на всём — ничего не портится и строка остаётся как была", async () => {
    const store = new FakeCaches();
    const cache = await legacyDownload(store);
    const outcome = await healDownloads({
      caches: store as unknown as CacheStorage,
      fetch: vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
      origin: ORIGIN,
      currentSheets: NEW_SHEETS,
    });
    expect(outcome.failed).toBe(1);
    expect(await (await cache.match(STORY))!.text()).toBe(LEGACY_HTML);
  });

  it("кеша скачанного нет — лечение его не заводит", async () => {
    const store = new FakeCaches();
    await healDownloads({
      caches: store as unknown as CacheStorage,
      fetch: serverAfterDeploy(false),
      origin: ORIGIN,
      currentSheets: NEW_SHEETS,
    });
    expect(await store.keys()).toEqual([]);
  });

  it("withSheetLinks меняет только листы стилей", () => {
    const out = withSheetLinks(LEGACY_HTML.replace("</head>", '<link rel="icon" href="/i.png"/></head>'), NEW_SHEETS);
    expect(out).not.toContain("old.css");
    expect(out).toContain('rel="icon"');
    expect(sheetUrlsInHtml(out, STORY)).toEqual(NEW_SHEETS);
  });
});

/**
 * ПРЕЗЕНТАЦИЯ ЛИСТАЕТСЯ В КОПИИ БЕЗ СКРИПТОВ — ЗАХОД 7.235.
 */
function pageWithDeck(): Document {
  document.documentElement.innerHTML = `
    <head><title>Lección</title></head>
    <body>
      <div data-rf-deck>
        ${[0, 1, 2]
          .map(
            (i) => `<div data-rf-slide="${i}" class="flex"${i === 0 ? "" : " hidden"}>
              <button type="button" data-rf-slide-go="${Math.max(0, i - 1)}"${i === 0 ? " disabled" : ""} aria-label="Anterior">←</button>
              <button type="button" data-rf-slide-go="${Math.min(2, i + 1)}"${i === 2 ? " disabled" : ""} aria-label="Siguiente">→</button>
              <span>Diapositiva ${i + 1} de 3</span>
            </div>`,
          )
          .join("")}
      </div>
    </body>`;
  return document;
}

describe("колода слайдов в скачанной копии (заход 7.235)", () => {
  it("все слайды в копии, и каждый достижим переключателем без скриптов", () => {
    const doc = pageWithDeck();
    // ПОЗИТИВНЫЙ КОНТРОЛЬ: живая страница листается React-кнопками, а два
    // слайда из трёх спрятаны атрибутом — в копии это был бы тупик.
    expect(doc.querySelectorAll("[data-rf-slide][hidden]").length).toBe(2);
    expect(doc.querySelectorAll("button[data-rf-slide-go]").length).toBe(6);

    const copy = new DOMParser().parseFromString(copyMarkupOf(doc, null), "text/html");
    expect(copy.querySelectorAll("[data-rf-slide][hidden]").length, "в копии слайды спрятаны атрибутом").toBe(0);
    expect(copy.querySelectorAll("button[data-rf-slide-go]").length, "в копии остались мёртвые кнопки").toBe(0);
    const radios = copy.querySelectorAll<HTMLInputElement>("input[data-rf-deck-radio]");
    expect(radios.length).toBe(3);
    expect(radios[0].hasAttribute("checked")).toBe(true);
    const targets = new Set([...copy.querySelectorAll("label[data-rf-slide-go]")].map((l) => l.getAttribute("for")));
    for (const radio of radios) expect(targets.has(radio.id), `к слайду ${radio.id} не ведёт ни одна стрелка`).toBe(true);
    const css = copy.querySelector("[data-rf-deck] > style")?.textContent ?? "";
    for (let i = 0; i < 3; i++) expect(css).toContain(`:checked~[data-rf-slide="${i}"]`);
    // Живая страница не тронута: копия снималась с клона.
    expect(doc.querySelectorAll("button[data-rf-slide-go]").length).toBe(6);
  });
});
