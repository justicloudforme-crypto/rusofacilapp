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
  /**
   * УБОРЩИК ВЫХОДА, ПОДСТАВЛЕННЫЙ В ТОЧКУ (заход 7.231, строка 310).
   *
   * `caches.delete(name)` у настоящего браузера уносит кеш ЦЕЛИКОМ, и
   * следующий `caches.open(name)` создаёт пустого двойника. Здесь то же
   * самое, и наступает оно ровно на N-м вызове `open` — то есть гонка
   * воспроизводится не «иногда», а каждый раз.
   */
  wipeOnOpen: { after: number; name: string } | null = null;
  opens = 0;
  async open(name: string): Promise<FakeCache> {
    this.opens += 1;
    if (this.wipeOnOpen && this.opens > this.wipeOnOpen.after) {
      const victim = this.wipeOnOpen.name;
      this.wipeOnOpen = null;
      this.caches.delete(victim);
    }
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

/**
 * ====================================================================
 * СТРОКА 310: СТРОКА СПИСКА БЕЗ КОПИИ ПОД НЕЙ — ЗАХОД 7.231
 * ====================================================================
 *
 * Дословный сценарий владельца (видео 25.09.2026, 1.0.6, 7:10–7:12 по
 * часам POCO): вошёл под учётной записью, страницы сохранились, с сетью
 * открыл «Mi perfil» → «Cerrar sesión», дальше ГОСТЕМ с сетью открыл
 * «Снегурочку» (бесплатный рассказ A1, слушал звук), «Cuentos»,
 * «Vocabulario» и урок A1/1, убил приложение и включил самолётный режим.
 * Без сети в списке «Guardado en este teléfono» лежало 5 строк, и строка
 * «Снегурочка» была серой, с подписью «No disponible», — остальные
 * четыре открывались. Выката сайта между шагами не было, то есть долг
 * 308 тут не при чём.
 *
 * ПРИЧИНА, доказанная здесь прогоном: уборщик выхода стирает кеши
 * `rf-pages*` целиком и делает это своим фоновым «потом»
 * (`SignedOutCachePurge`, `void (async () => …)()`). Первая страница,
 * которую гость открывает после выхода, сохраняется ОДНОВРЕМЕННО с этой
 * уборкой. Если уборка успевает между `cache.put` (копия легла) и
 * записью описи, то `caches.open` создаёт кеш ЗАНОВО, пустым, и опись
 * ложится в него строкой, под которой копии нет. Первой страницей после
 * выхода была ровно «Снегурочка».
 */
describe("строка 310: опись не заводит строк без копии", () => {
  it("уборка между копией и описью — строки НЕ появляется (а без уборки появляется: позитивный контроль)", async () => {
    // Позитивный контроль ПЕРВЫМ: без уборки тот же самый заход обязан
    // дать строку. Иначе «строки нет» доказывало бы лишь то, что
    // сохранение сломано вообще.
    const control = deps();
    expect(await saveCopy(control.args)).toBe("saved");
    expect(await indexOf(control.store)).toHaveLength(1);

    // А теперь та же страница, но уборщик успевает между `put` и описью.
    // `open` вызывается так: 1 — readIndex, 2 — кеш под копию, 3 —
    // проверка «копия на месте». Уносим кеш после второго.
    const raced = deps();
    raced.store.wipeOnOpen = { after: 2, name: NAMES.content };
    expect(await saveCopy(raced.args)).toBe("lost-race");
    const rows = await indexOf(raced.store);
    expect(rows, "строка заведена под копию, которой нет, — это и есть «No disponible»").toHaveLength(0);
  });

  it("уборка ПОСЛЕ описи — строка снимается тем же заходом", async () => {
    const raced = deps();
    // 1 readIndex, 2 кеш копии, 3 проверка до описи, 4 writeIndex →
    // уносим после четвёртого, то есть сразу после записи описи.
    raced.store.wipeOnOpen = { after: 4, name: NAMES.content };
    expect(await saveCopy(raced.args)).toBe("lost-race");
    expect(await indexOf(raced.store), "опись осталась со строкой без копии").toHaveLength(0);
  });

  /**
   * СТРОКА 312 — НАЗВАНИЕ, КОТОРОГО НЕ БЫЛО У ДОКУМЕНТА.
   *
   * Переход клиентским роутером Next снимает прежний `<title>` до того,
   * как поставит новый. Сохранение, попавшее в этот промежуток, заводило
   * строку с пустым названием, и список показывал вместо неё адрес —
   * ровно «/es/stories · Sección» с видео владельца 25.09.2026 (прогон
   * поймал такую строку прямо в описи, `.run7232/live.mjs`).
   */
  it("пустое название берётся из разметки (а непустое остаётся своим: позитивный контроль)", async () => {
    const own = deps({ title: "Урок 1 — RusoFácilapp" });
    expect(await saveCopy(own.args)).toBe("saved");
    expect((await indexOf(own.store))[0].title, "название документа перестало доходить до описи").toBe("Урок 1");

    const blank = deps({ title: "", html: OPEN_HTML.replace("<head>", "<head><title>Снегурочка — cuento en ruso (A1) | RusoFácilapp</title>") });
    expect(await saveCopy(blank.args)).toBe("saved");
    expect(
      (await indexOf(blank.store))[0].title,
      "название пустое — список показал бы человеку адрес",
    ).toBe("Снегурочка");
  });

  it("названия нет ни у документа, ни в разметке — в опись не попадает адрес", async () => {
    const nothing = deps({ title: "", html: "<!doctype html><html><head></head><body>теория</body></html>" });
    expect(await saveCopy(nothing.args)).toBe("saved");
    const row = (await indexOf(nothing.store))[0];
    expect(row.title).toBe("");
    expect(row.title, "в название подставили адрес").not.toContain("/");
  });

  it("каждая строка описи после обычного прогона и правда подкреплена копией", async () => {
    const { store, args } = deps();
    for (const path of ["/ru/courses/a1/1", "/ru/stories/snegurochka", "/ru/courses", "/ru/vocabulary"]) {
      await saveCopy({ ...args, url: `${ORIGIN}${path}`, pathname: path });
    }
    const rows = await indexOf(store);
    expect(rows.length, "сохранять было нечего — сравнивать нечего").toBe(4);
    for (const row of rows) {
      const where = row.kind === "section" ? NAMES.section : NAMES.content;
      expect(await (await store.open(where)).match(row.url), `строка ${row.path} без копии`).toBeTruthy();
    }
  });
});
