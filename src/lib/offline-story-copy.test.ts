import { describe, it, expect, afterEach, vi } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * СКАЧАННЫЙ РАССКАЗ БЕЗ СЕТИ — ЗАХОД 7.263 (ДОЛГИ 361, 363, 364).
 *
 * Исполняется НАСТОЯЩИЙ `public/offline.html` в своём окне jsdom (как в
 * `offline-saved-list.test.ts`) с подставными Cache Storage, `Audio`,
 * `blob:` и плагином шторки — ровно то, что было на эмуляторе 11.10.2026:
 * «Репка» скачана, место сохранено на середине.
 *
 *   * 361: на 1.0.13 копия за всю игру не зовёт `setPositionState` ни разу —
 *     шторка «00:00 / 00:00». Теперь длина = сумма клипов, позиция = место.
 *   * 363: на 1.0.13 «▶» в копии — всегда с первой фразы, место не читается
 *     и не пишется. Теперь — с сохранённой фразы, как у живой страницы.
 *   * 364: на 1.0.13 копия из списка открывается `replaceState` —
 *     `history.length` = 1, «Назад» не делает ничего. Теперь — своя запись
 *     в истории, а возврат по ней перезапрашивает адрес списка.
 *
 * `RF_OFFLINE_HTML` — путь к другому каркасу, чтобы тот же тест прогнать
 * на коде ДО правки (он обязан там падать).
 */
type IsolatedDom = { window: Window & { close(): void } };
type VirtualConsole = { on(event: string, cb: (e: Error) => void): void };
const jsdom = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (
    html: string,
    options: { url: string; runScripts: "dangerously"; virtualConsole: VirtualConsole; beforeParse(win: Window): void },
  ) => IsolatedDom;
  VirtualConsole: new () => VirtualConsole;
};

const HTML = readFileSync(process.env.RF_OFFLINE_HTML ?? join(process.cwd(), "public", "offline.html"), "utf8");
const O = "https://rusofacilapp.com";
const SHEET = "/_next/static/css/a.css";
const STORY = "/es/stories/abc";
const CLIP = (n: number) => `https://cdn.example/story/abc/${n}.mp3`;
/** Длины клипов, с: очередь фраз 0..4, у фразы 1 клипа нет. */
const LENGTHS = [2, 3, 4, 5];
const TOTAL = 14;

function storyPage({ paywall = false } = {}): string {
  const sentence = (clip: number | null, text: string) =>
    `<span role="button" tabindex="0"${clip === null ? "" : ` data-rf-clip="${CLIP(clip)}"`}>${text}</span>`;
  return `<!doctype html><html lang="es"><head><title>Репка | RusoFácilapp</title><link rel="stylesheet" href="${SHEET}"></head><body><main>
<div data-rf-story-title="Репка" data-rf-story-author="Cuento popular ruso" data-rf-selectable>
  <div>
    <button type="button" data-rf-player="back">⏪</button>
    <button type="button" data-rf-player="play" data-rf-play-label="Escuchar" data-rf-pause-label="Pausa"><span>▶</span></button>
    <button type="button" data-rf-player="forward">⏩</button>
    <div><div data-rf-player="bar" style="width:0%"></div></div>
  </div>
  <div>
    <div><p>${sentence(0, "Посадил дед репку.")} ${sentence(null, "Выросла репка большая.")}</p><p class="italic">El abuelo plantó un nabo.</p></div>
    <div><p>${sentence(1, "Стал дед репку тянуть.")} ${sentence(2, "Тянет-потянет.")} ${sentence(3, "Вытащить не может.")}</p></div>
  </div>
</div>
${paywall ? '<div class="paywall-lock"><h2>Material Premium</h2></div>' : ""}
</main></body></html>`;
}

type Entry = () => Response;
function fakeCaches(seed: Record<string, Record<string, Entry>>) {
  const store = new Map<string, Map<string, Entry>>();
  for (const [name, entries] of Object.entries(seed)) store.set(name, new Map(Object.entries(entries)));
  const keyOf = (req: string | { url: string }) => new URL(typeof req === "string" ? req : req.url, O).href.split("#")[0];
  const cacheOf = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const entries = store.get(name)!;
    return {
      match: async (req: string | { url: string }) => entries.get(keyOf(req))?.(),
      keys: async () => [...entries.keys()].map((url) => ({ url })),
      put: async () => undefined,
      delete: async () => false,
    };
  };
  return {
    keys: async () => [...store.keys()],
    open: async (name: string) => cacheOf(name),
    match: async (req: string | { url: string }) => {
      for (const name of store.keys()) {
        const hit = await cacheOf(name).match(req);
        if (hit) return hit;
      }
      return undefined;
    },
    delete: async (name: string) => store.delete(name),
  };
}
const html = (text: string) => () => new Response(text, { status: 200, headers: { "content-type": "text/html" } });
const json = (value: unknown) => () => new Response(JSON.stringify(value), { status: 200 });

function phone(page: string) {
  const clips: Record<string, Entry> = {};
  LENGTHS.forEach((_, n) => {
    clips[CLIP(n)] = () => new Response(`clip:${n}`, { status: 200, headers: { "content-type": "audio/mpeg" } });
  });
  return {
    "rf-pages-downloads": {
      [`${O}/__rf-downloads-index`]: json([
        { url: `${O}${STORY}`, path: STORY, title: "Репка", savedAt: 5, bytes: 1_677_000, clips: [], sheets: [SHEET] },
      ]),
      [`${O}${STORY}`]: html(page),
      [`${O}${SHEET}`]: () => new Response("body{}", { status: 200 }),
    },
    "rf-audio": clips,
  };
}

/** `Audio` эмулятора без звука: длина — по номеру клипа в теле `blob:`. */
type Fake = {
  src: string;
  currentTime: number;
  duration: number;
  paused: boolean;
  ended: boolean;
  clip: number | null;
  onplay: null | (() => void);
  onpause: null | (() => void);
  onended: null | (() => void);
  onloadedmetadata: null | (() => void);
  onerror: null | (() => void);
};
function installMedia(win: Window, blobs: Map<string, Blob>, played: Fake[]) {
  let seq = 0;
  const w = win as unknown as Record<string, unknown>;
  const url = (win as unknown as { URL: Record<string, unknown> }).URL;
  url.createObjectURL = (blob: Blob) => {
    const id = `blob:${O}/${++seq}`;
    blobs.set(id, blob);
    return id;
  };
  url.revokeObjectURL = () => undefined;
  class FakeAudio implements Fake {
    currentTime = 0;
    duration = NaN;
    paused = true;
    ended = false;
    clip: number | null = null;
    preload = "";
    onplay: null | (() => void) = null;
    onpause: null | (() => void) = null;
    onended: null | (() => void) = null;
    onloadedmetadata: null | (() => void) = null;
    onerror: null | (() => void) = null;
    ontimeupdate: null | (() => void) = null;
    private _src = "";
    constructor(src?: string) {
      if (src) this.src = src;
    }
    get src() {
      return this._src;
    }
    set src(value: string) {
      this._src = value;
      const blob = blobs.get(value);
      if (!blob) return;
      void blob.text().then((text) => {
        if (this._src !== value) return;
        this.clip = Number(text.replace("clip:", ""));
        this.duration = LENGTHS[this.clip];
        this.onloadedmetadata?.();
      });
    }
    removeAttribute() {
      this._src = "";
    }
    load() {}
    play() {
      this.paused = false;
      played.push(this);
      setTimeout(() => this.onplay?.(), 0);
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
      setTimeout(() => this.onpause?.(), 0);
    }
  }
  w.Audio = FakeAudio;
}

type Call = { duration: number; position: number };
type Handler = (details?: { seekTime?: number }) => void;
type Opened = {
  doc: Document;
  win: Window;
  positions: Call[];
  handlers: Map<string, Handler>;
  played: Fake[];
  reloads: () => number;
};

const opened: IsolatedDom[] = [];
afterEach(() => {
  for (const dom of opened.splice(0)) dom.window.close();
});

async function offlineAt(path: string, page: string, progress?: Record<string, unknown>): Promise<Opened> {
  const positions: Call[] = [];
  const handlers = new Map<string, Handler>();
  const played: Fake[] = [];
  const blobs = new Map<string, Blob>();
  let reloads = 0;
  const virtualConsole = new jsdom.VirtualConsole();
  // jsdom не умеет настоящую перезагрузку и говорит об этом сюда — это и
  // есть счётчик `location.reload()`.
  virtualConsole.on("jsdomError", (e) => {
    if (/navigation/i.test(String(e?.message))) reloads += 1;
  });
  const dom = new jsdom.JSDOM(HTML, {
    url: `${O}${path}`,
    runScripts: "dangerously",
    virtualConsole,
    beforeParse(win) {
      Object.defineProperty(win.navigator, "onLine", { configurable: true, get: () => false });
      const w = win as unknown as Record<string, unknown>;
      w.caches = fakeCaches(phone(page));
      w.Response = Response;
      w.TextDecoder = TextDecoder;
      w.fetch = () => Promise.reject(new TypeError("нет сети"));
      if (progress) win.localStorage.setItem("rusofacil:story-progress", JSON.stringify(progress));
      installMedia(win, blobs, played);
      w.Capacitor = {
        isNativePlatform: () => true,
        Plugins: {
          MediaSession: {
            setPositionState: async (s: Call) => void positions.push(s),
            setPlaybackState: async () => undefined,
            setMetadata: async () => undefined,
            setActionHandler: async (o: { action: string }, h: Handler) => void handlers.set(o.action, h),
          },
        },
      };
    },
  });
  opened.push(dom);
  return { doc: dom.window.document, win: dom.window, positions, handlers, played, reloads: () => reloads };
}

const until = (check: () => void) => vi.waitFor(check, { timeout: 5_000, interval: 10 });
const lines = (doc: Document) => [...doc.querySelectorAll<HTMLElement>("span[data-rf-clip]")];
const click = (doc: Document, selector: string) =>
  doc.querySelector(selector)!.dispatchEvent(new doc.defaultView!.MouseEvent("click", { bubbles: true, cancelable: true }));
const saved = (win: Window) => JSON.parse(win.localStorage.getItem("rusofacil:story-progress") ?? "{}").abc;
/** Последняя НЕНУЛЕВАЯ шкала, которую копия отдала шторке. */
const lastScale = (o: Opened) => [...o.positions].reverse().find((p) => p.duration > 0);

const MIDDLE = { abc: { currentPage: 4, queueIndex: 3, totalPages: 5, percent: 80, isCompleted: false, updatedAt: 1 } };

async function copyReady(path: string, page = storyPage(), progress: Record<string, unknown> | undefined = MIDDLE) {
  const o = await offlineAt(path, page, progress);
  await until(() => {
    if (o.doc.body.getAttribute("data-offline-copy") !== "1") throw new Error("копия ещё не открыта");
    if (!lines(o.doc)[0]?.hasAttribute("data-rf-clip-armed")) throw new Error("проигрыватель копии не ожил");
  });
  return o;
}

describe("скачанный рассказ без сети (7.263)", () => {
  it("361: шторка получает длину рассказа и место, а не «00:00 / 00:00»", async () => {
    const o = await copyReady(STORY);
    click(o.doc, '[data-rf-player="play"]');
    // Сохранена фраза 3 очереди = третий клип; до него 2 + 3 = 5 с.
    await until(() => expect(lastScale(o)).toEqual({ duration: TOTAL, position: 5, playbackRate: 1 }));

    // Ползунок шторки: 9,5 с — четвёртый клип, 0,5 с внутри.
    o.handlers.get("seekto")?.({ seekTime: 9.5 });
    await until(() => expect(lastScale(o)).toEqual({ duration: TOTAL, position: 9.5, playbackRate: 1 }));
    await until(() => expect(o.played.at(-1)?.clip).toBe(3));

    // ⏪ шторки — на 15 с назад, не дальше начала.
    o.handlers.get("seekbackward")?.();
    await until(() => expect(lastScale(o)).toEqual({ duration: TOTAL, position: 0, playbackRate: 1 }));
    await until(() => expect(o.played.at(-1)?.clip).toBe(0));
  });

  it("363: «▶» продолжает с сохранённой фразы и пишет место дальше", async () => {
    const o = await copyReady(STORY);
    // До «▶»: кольцо на сохранённой фразе, шкала копии — на месте.
    expect(lines(o.doc).findIndex((l) => l.hasAttribute("data-rf-resume"))).toBe(2);
    await until(() =>
      expect(o.doc.querySelector<HTMLElement>('[data-rf-player="bar"]')!.style.width).toBe(`${(5 / TOTAL) * 100}%`),
    );
    click(o.doc, '[data-rf-player="play"]');
    await until(() => expect(o.played[0]?.clip).toBe(2));
    // Фраза кончилась — следующая, и место записано, как у живой страницы.
    o.played[0].ended = true;
    o.played[0].onended?.();
    await until(() => expect(saved(o.win)).toMatchObject({ queueIndex: 4, currentPage: 5, totalPages: 5, isCompleted: true }));
  });

  it("363: ⏪ до «▶» переносит место от сохранённого, а не уводит в ноль и не играет", async () => {
    const o = await copyReady(STORY);
    await until(() => expect(o.doc.querySelector<HTMLElement>('[data-rf-player="bar"]')!.style.width).not.toBe("0%"));
    await new Promise((r) => setTimeout(r, 50));
    click(o.doc, '[data-rf-player="forward"]'); // 5 + 15 → у конца, не дальше длины
    expect(o.played).toHaveLength(0);
    expect(saved(o.win)).toMatchObject({ queueIndex: 4 });
    click(o.doc, '[data-rf-player="back"]'); // ≈13,75 − 15 → 0
    expect(saved(o.win)).toMatchObject({ queueIndex: 0 });
    click(o.doc, '[data-rf-player="play"]');
    await until(() => expect(o.played[0]?.clip).toBe(0));
  });

  it("контроль: превью за пейволом места не читает и не пишет", async () => {
    const o = await copyReady(STORY, storyPage({ paywall: true }));
    expect(lines(o.doc).some((l) => l.hasAttribute("data-rf-resume"))).toBe(false);
    click(o.doc, '[data-rf-player="play"]');
    await until(() => expect(o.played[0]?.clip).toBe(0));
    expect(saved(o.win)).toEqual(MIDDLE.abc);
  });

  it("контроль: дочитанный рассказ начинается сначала", async () => {
    const o = await copyReady(STORY, storyPage(), { abc: { ...MIDDLE.abc, currentPage: 5, queueIndex: 4, isCompleted: true } });
    click(o.doc, '[data-rf-player="play"]');
    await until(() => expect(o.played[0]?.clip).toBe(0));
  });

  it("364: копия из списка — своя запись в истории; «Назад» возвращает к списку", async () => {
    const o = await offlineAt("/es", storyPage(), MIDDLE);
    await until(() => {
      if (!o.doc.querySelector("[data-downloads-list] li button")) throw new Error("список скачанного ещё не нарисован");
    });
    expect(o.win.history.length).toBe(1);
    click(o.doc, "[data-downloads-list] li button");
    await until(() => expect(o.doc.body.getAttribute("data-offline-copy")).toBe("1"));
    expect(o.win.location.pathname).toBe(STORY);
    expect(o.win.history.length, "копия открыта без записи в истории — «Назад» стоит на месте").toBe(2);

    o.win.history.back();
    await until(() => expect(o.win.location.pathname).toBe("/es"));
    await until(() => expect(o.reloads(), "возврат к списку не перезапросил каркас").toBe(1));
  });
});
