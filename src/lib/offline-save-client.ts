/**
 * СОХРАНЕНИЕ КОПИИ СТРАНИЦЫ СО СТОРОНЫ СТРАНИЦЫ — ЗАХОД 7.230.
 *
 * Разбор «почему это делает страница, а не воркер» — в
 * `src/lib/offline-save.ts`. Здесь только исполнение, и вынесено оно из
 * компонента намеренно: у правила есть примеры с подставными кешами
 * (`src/lib/offline-save-client.test.ts`), а у компонента React их без
 * настоящего браузера быть не может.
 */
import {
  OFFLINE_INDEX_PATH,
  parseIndex,
  type SavedRow,
  savedKindOf,
  tidyTitle,
  trimIndex,
  withRow,
  withoutUrl,
} from "./offline-save";
import { looksClosedForThisVisitor } from "./sw-cache-policy";

/** Имена, которые воркер назвал своими. */
export interface CacheNames {
  fingerprint: string;
  content: string;
  section: string;
}

export interface SaveDeps {
  caches: CacheStorage;
  names: CacheNames;
  /** Полный адрес страницы. */
  url: string;
  pathname: string;
  /** Разметка страницы целиком, как она сейчас на экране. */
  html: string;
  title: string;
  lang: "es" | "ru";
  now: number;
}

export type SaveOutcome =
  | "saved"
  | "removed-closed"
  | "skipped-not-content"
  | "skipped-no-caches"
  | "failed";

function cacheNameFor(names: CacheNames, kind: string): string {
  return kind === "section" ? names.section : names.content;
}

/** Адрес описи — НА ТОМ ЖЕ ИСТОЧНИКЕ, что и страница. Иначе каркас,
 *  который ищет её как `new URL(OFFLINE_INDEX_PATH, location.href)`, не
 *  нашёл бы ни разу: ключ записи в кеше — это полный адрес. */
export function indexUrl(sameOriginAs: string): string {
  return new URL(OFFLINE_INDEX_PATH, sameOriginAs).toString();
}

async function readIndex(store: CacheStorage, names: CacheNames, origin: string): Promise<SavedRow[]> {
  try {
    const cache = await store.open(names.content);
    const hit = await cache.match(indexUrl(origin), { ignoreVary: true });
    if (!hit) return [];
    return parseIndex(await hit.json());
  } catch {
    return [];
  }
}

async function writeIndex(store: CacheStorage, names: CacheNames, origin: string, rows: SavedRow[]): Promise<void> {
  const cache = await store.open(names.content);
  await cache.put(
    indexUrl(origin),
    new Response(JSON.stringify(rows), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    }),
  );
}

/**
 * ОДИН ЗАХОД СОХРАНЕНИЯ.
 *
 * Порядок утверждений тот же, что у воркерного плагина, и это не
 * совпадение: правило одно, а рубежа два.
 *   1. страница не из тех, что читают без сети → не трогаем ничего;
 *   2. страница ЗАКРЫТА этому посетителю → копию СТИРАЕМ (подписка
 *      кончилась — сохранённое обязано исчезнуть при первом же заходе
 *      с сетью);
 *   3. иначе кладём копию и переписываем опись, выбрасывая по потолку и
 *      по сроку.
 */
export async function saveCopy(deps: SaveDeps): Promise<SaveOutcome> {
  const kind = savedKindOf(deps.pathname);
  if (!kind) return "skipped-not-content";
  if (!deps.caches) return "skipped-no-caches";

  try {
    const rows = await readIndex(deps.caches, deps.names, deps.url);

    if (looksClosedForThisVisitor(deps.html)) {
      for (const name of [deps.names.content, deps.names.section]) {
        const cache = await deps.caches.open(name);
        await cache.delete(deps.url, { ignoreVary: true });
      }
      await writeIndex(deps.caches, deps.names, deps.url, withoutUrl(rows, deps.url));
      return "removed-closed";
    }

    const cache = await deps.caches.open(cacheNameFor(deps.names, kind));
    await cache.put(
      deps.url,
      new Response(deps.html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );

    const row: SavedRow = {
      url: deps.url,
      path: deps.pathname,
      kind,
      title: tidyTitle(deps.title),
      lang: deps.lang,
      savedAt: deps.now,
      bytes: deps.html.length,
    };
    const { keep, drop } = trimIndex(withRow(rows, row), deps.now);
    for (const dropped of drop) {
      const dropCache = await deps.caches.open(cacheNameFor(deps.names, dropped.kind));
      await dropCache.delete(dropped.url, { ignoreVary: true });
    }
    await writeIndex(deps.caches, deps.names, deps.url, keep);
    return "saved";
  } catch {
    return "failed";
  }
}

/**
 * СПРОСИТЬ ИМЕНА У ВОРКЕРА. Сообщение уходит на `registration.active`, а
 * НЕ на `navigator.serviceWorker.controller`: в оболочке контроля над
 * документом у воркера нет (на то и весь этот заход), а отвечать на
 * сообщения это ему не мешает.
 */
export function askCacheNames(timeoutMs = 4000): Promise<CacheNames | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return Promise.resolve(null);
  return new Promise<CacheNames | null>((resolve) => {
    let done = false;
    const finish = (value: CacheNames | null) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    navigator.serviceWorker.ready
      .then((registration) => {
        const worker = registration.active;
        if (!worker) {
          clearTimeout(timer);
          finish(null);
          return;
        }
        const channel = new MessageChannel();
        channel.port1.onmessage = (event: MessageEvent) => {
          clearTimeout(timer);
          const data = event.data as Partial<CacheNames> & { type?: string };
          if (!data || data.type !== "rf-cache-names" || typeof data.content !== "string" || typeof data.section !== "string") {
            finish(null);
            return;
          }
          finish({
            fingerprint: typeof data.fingerprint === "string" ? data.fingerprint : "",
            content: data.content,
            section: data.section,
          });
        };
        worker.postMessage({ type: "rf-cache-names" }, [channel.port2]);
      })
      .catch(() => {
        clearTimeout(timer);
        finish(null);
      });
  });
}
