import { describe, it, expect, afterEach, vi } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * СПИСОК «GUARDADO» КАРКАСА БЕЗ СЕТИ — ЗАХОД 7.248 (Ж.3 и Р16 аудита 7.241).
 *
 * Исполняется НАСТОЯЩИЙ `public/offline.html` в своём окне jsdom (таймеры
 * каркаса переживают `document.open()` — см. `offline-screen.test.ts`) с
 * подставным Cache Storage: опись, копии, лист стилей, скачанное — ровно
 * то, что лежало на эмуляторе 28.09.2026.
 *
 *   * Р16: `/es/vocabulary` + два перехода поиска на идиомы
 *     (`?mode=idioms#idiom-…`) → на 1.0.12 три одинаковые строки.
 *   * Ж.3: вкладка без своих строк при непустом «Descargado» → на 1.0.12
 *     «Aún no hay nada guardado en este teléfono».
 *
 * `RF_OFFLINE_HTML` — путь к другому каркасу, чтобы тот же тест прогнать
 * на коде ДО правки (он обязан там падать).
 */
type IsolatedDom = { window: Window & { close(): void } };
const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (
    html: string,
    options: { url: string; runScripts: "dangerously"; beforeParse(win: Window): void },
  ) => IsolatedDom;
};

const HTML = readFileSync(process.env.RF_OFFLINE_HTML ?? join(process.cwd(), "public", "offline.html"), "utf8");
const O = "https://rusofacilapp.com";
const TITLE = "Vocabulario ruso por temas, con traducción";
const SHEET = "/_next/static/css/a.css";

const page = (title: string) =>
  `<!doctype html><html lang="es"><head><title>${title} | RusoFácilapp</title><link rel="stylesheet" href="${SHEET}"></head><body><main>copia</main></body></html>`;

type Entry = () => Response;
/** Cache Storage в памяти: ключ — адрес без `#…`, как у настоящего. */
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

/** Телефон с эмулятора: словарь трижды (Р16) и скачанная «Репка». */
function phoneFromEmulator() {
  return {
    "rf-pages-downloads": {
      [`${O}/__rf-downloads-index`]: json([
        { url: `${O}/es/stories/abc`, path: "/es/stories/abc", title: "Репка", savedAt: 5, bytes: 1_677_000, clips: [], sheets: [SHEET] },
      ]),
      [`${O}/es/stories/abc`]: html(page("Репка")),
    },
    "rf-pages-content-abc123": {
      [`${O}/__rf-offline-index`]: json([
        { url: `${O}/es/vocabulary?mode=idioms#idiom-bbb`, path: "/es/vocabulary", kind: "vocabulary", title: TITLE, savedAt: 4 },
        { url: `${O}/es/vocabulary?mode=idioms#idiom-aaa`, path: "/es/vocabulary", kind: "vocabulary", title: TITLE, savedAt: 3 },
        { url: `${O}/es/vocabulary`, path: "/es/vocabulary", kind: "vocabulary", title: TITLE, savedAt: 2 },
      ]),
      [`${O}/es/vocabulary`]: html(page(TITLE)),
      [`${O}/es/vocabulary?mode=idioms`]: html(page(TITLE)),
    },
    "rf-pages-sheets-abc123": { [`${O}${SHEET}`]: () => new Response("body{}", { status: 200 }) },
  };
}

const opened: IsolatedDom[] = [];
afterEach(() => {
  for (const dom of opened.splice(0)) dom.window.close();
});

async function offlineAt(path: string, phone: Record<string, Record<string, Entry>>): Promise<Document> {
  const dom = new JSDOM(HTML, {
    url: `${O}${path}`,
    runScripts: "dangerously",
    beforeParse(win) {
      Object.defineProperty(win.navigator, "onLine", { configurable: true, get: () => false });
      const w = win as unknown as Record<string, unknown>;
      w.caches = fakeCaches(phone);
      w.Response = Response;
      w.TextDecoder = TextDecoder;
      w.fetch = () => Promise.reject(new TypeError("нет сети"));
    },
  });
  opened.push(dom);
  const doc = dom.window.document;
  await vi.waitFor(
    () => {
      const gauge = doc.querySelector("[data-saved-gauge]")?.textContent ?? "";
      if (!/Guardado: \d/.test(gauge)) throw new Error("каркас ещё не нарисовал список");
    },
    { timeout: 5_000, interval: 20 },
  );
  return doc;
}

const savedRows = (doc: Document) => [...doc.querySelectorAll("[data-saved-list] li")].map((li) => li.textContent ?? "");
const visible = (doc: Document, selector: string) => {
  const el = doc.querySelector<HTMLElement>(selector);
  return Boolean(el) && !el!.hidden;
};

describe("каркас без сети: список «Guardado» (7.248)", () => {
  it("Р16: одна страница словаря — одна строка, а не три", async () => {
    const doc = await offlineAt("/es", phoneFromEmulator());
    const rows = savedRows(doc);
    expect(rows.filter((r) => r.startsWith(TITLE)), JSON.stringify(rows)).toHaveLength(1);
    // Контроль: скачанный рассказ никуда не делся.
    expect(rows.some((r) => r.startsWith("Репка")), JSON.stringify(rows)).toBe(true);
  });

  it("Ж.3: вкладка без своих строк не говорит «на телефоне ничего нет», когда ниже лежит скачанное", async () => {
    const doc = await offlineAt("/es", phoneFromEmulator());
    const tab = doc.querySelector<HTMLAnchorElement>('nav.tabs [data-href="/courses"]');
    expect(tab, "вкладки «Cursos» нет").not.toBeNull();
    tab!.dispatchEvent(new doc.defaultView!.MouseEvent("click", { bubbles: true, cancelable: true }));
    await vi.waitFor(
      () => {
        if (savedRows(doc).length !== 0) throw new Error("список вкладки ещё не перерисован");
      },
      { timeout: 5_000, interval: 20 },
    );
    expect(visible(doc, "[data-downloads]"), "блок «Descargado» пропал").toBe(true);
    expect(visible(doc, "[data-saved-empty]"), "фраза «на телефоне ничего нет» при скачанной «Репке»").toBe(false);
    expect(visible(doc, "[data-saved-empty-tab]"), "нет фразы «в этом разделе пусто»").toBe(true);
    expect(doc.querySelector("[data-saved-empty-tab]")?.textContent).toContain("En esta sección aún no hay nada guardado.");
  });

  it("контроль: на пустом телефоне — прежняя фраза про телефон", async () => {
    const doc = await offlineAt("/es", {});
    expect(visible(doc, "[data-saved-empty]")).toBe(true);
    expect(visible(doc, "[data-saved-empty-tab]")).toBe(false);
  });
});
