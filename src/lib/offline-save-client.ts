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
  sheetUrlsInHtml,
  parseIndex,
  type SavedRow,
  savedKindOf,
  tidyTitle,
  titleFromHtml,
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
  /** Кеш листов стилей этой сборки (строка 314). Почему свой, а не место
   *  в `content`, — в `sw-cache-names.ts`. */
  sheets: string;
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
  /**
   * КОПИЮ УНЕСЛО ПРЯМО ПОД РУКАМИ — ЗАХОД 7.231, СТРОКА 310.
   *
   * Уборщик выхода (`SignedOutCachePurge`) стирает кеш ЦЕЛИКОМ
   * (`caches.delete(name)`), и делает это своим собственным «потом»,
   * не спрашивая никого. Если он успел между `cache.put` и записью
   * описи, то `caches.open` на следующей строке СОЗДАЁТ кеш заново —
   * пустой, — и опись ложится в него со строкой, под которой копии
   * больше нет. Так и получалось «No disponible» у владельца.
   *
   * Этот исход — не отказ: страница сделала всё правильно, а копию
   * унесли. Правильный ответ — не заводить строку (и снять её, если
   * успела лечь), а не делать вид, что сохранено.
   */
  | "lost-race"
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


/**
 * ЛЕЖИТ ЛИ КОПИЯ ПРЯМО СЕЙЧАС — ЗАХОД 7.231, СТРОКА 310.
 *
 * Кеш открывается ЗАНОВО намеренно: у `Cache` нет способа спросить «а
 * меня ещё не удалили», а `caches.open` на удалённом имени молча создаёт
 * пустой кеш. Пустой ответ на `match` — это и есть ответ «унесло».
 */
async function copyIsThere(store: CacheStorage, cacheName: string, url: string): Promise<boolean> {
  try {
    const fresh = await store.open(cacheName);
    return Boolean(await fresh.match(url, { ignoreVary: true }));
  } catch {
    return false;
  }
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

    const copyCacheName = cacheNameFor(deps.names, kind);
    const cache = await deps.caches.open(copyCacheName);
    await cache.put(
      deps.url,
      new Response(deps.html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );

    // СТРОКА ОПИСИ ЗАВОДИТСЯ ТОЛЬКО ПОД РЕАЛЬНО ЛЕЖАЩУЮ КОПИЮ (строка
    // 310). Спрашивается СВЕЖИЙ дескриптор кеша, а не тот, в который
    // только что положили: удалённый кеш `caches.open` создаёт заново, и
    // именно этой разницей отличается «копия на месте» от «кеш унесло, а
    // мы пишем в его пустого двойника».
    if (!(await copyIsThere(deps.caches, copyCacheName, deps.url))) return "lost-race";

    // ЛИСТЫ СТИЛЕЙ — ПОСЛЕ ТОГО, КАК КОПИЯ ПОДТВЕРЖДЕНА, И НИ МИНУТОЙ
    // РАНЬШЕ. Порядок измерен, а не выбран: уборщик выхода стирает кеши
    // ЦЕЛИКОМ, а любой `put` заводит их заново — и заход, писавший стили
    // до проверки, ВОСКРЕШАЛ три кеша сразу после выхода из учётной
    // записи. Поймано пробой `e2e/offline-orphan-row.spec.ts` («после
    // выхода кешей rf-pages*: ожидалось 0, получено 3»).
    await keepSheetsBeside(deps.caches, deps.names.sheets, deps.html, deps.url);

    const row: SavedRow = {
      url: deps.url,
      path: deps.pathname,
      kind,
      // НАЗВАНИЕ БЕРЁТСЯ ИЗ РАЗМЕТКИ, ЕСЛИ ЕГО НЕТ У ДОКУМЕНТА (строка
      // 312). Переход клиентским роутером Next снимает прежний `<title>`
      // до того, как поставит новый, и сохранение, попавшее в этот
      // промежуток, заводило строку с пустым названием — список потом
      // показывал вместо неё адрес. Разметка, которую мы кладём, своё
      // название знает всегда.
      title: tidyTitle(deps.title) || titleFromHtml(deps.html),
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

    // И ЕЩЁ РАЗ ПОСЛЕ ОПИСИ. Между проверкой выше и этой строкой окно
    // остаётся — маленькое, но существующее, а цена ему та самая серая
    // строка «No disponible». Если копии больше нет, опись обязана
    // вернуться к правде немедленно, тем же заходом.
    if (!(await copyIsThere(deps.caches, copyCacheName, deps.url))) {
      const after = await readIndex(deps.caches, deps.names, deps.url);
      await writeIndex(deps.caches, deps.names, deps.url, withoutUrl(after, deps.url));
      return "lost-race";
    }
    return "saved";
  } catch {
    return "failed";
  }
}

/**
 * ЛИСТЫ СТИЛЕЙ ЛОЖАТСЯ РЯДОМ С КОПИЕЙ — ЗАХОД 7.233, СТРОКА 314.
 *
 * ====================================================================
 * ЧТО ЭТО ЧИНИТ
 * ====================================================================
 *
 * Строку, которая ПОЯВИЛАСЬ И ИСЧЕЗЛА. Правило 7.232 верное: строка
 * показывается только тогда, когда телефон и правда может показать
 * копию, а без единого листа стилей показать её нельзя. Но лист стилей
 * лежал в precache — в кеше, которым распоряжается не эта копия, а
 * текущая сборка сайта. Один и тот же вопрос «можно ли показать» давал
 * при первой отрисовке «да», а через несколько секунд или после
 * возврата в список «нет», потому что между двумя ответами менялся
 * precache. Владелец снял это трижды на видео 26.09.2026 (1:15→1:30,
 * 4:45→4:55, 6:05→6:25) на строке «Curso de ruso online · Sección», и
 * серой она при этом не становилась ни разу — она просто пропадала
 * вместе с единицей в приборе.
 *
 * ЦЕНА. Два файла, 174 КиБ на сборку (замер 26.09.2026: 167 861 + 6 506
 * байт), и кладутся они ОДИН раз: ключ записи — адрес, а адрес листа
 * один на весь сайт. Не на копию, не на локаль — на кеш. Против потолка
 * содержания в 36 записей это меньше двух процентов его веса.
 *
 * ПОЧЕМУ БЕРЁТСЯ ИЗ ХРАНИЛИЩА, А НЕ ИЗ СЕТИ. Сохранение идёт следом за
 * показом страницы, то есть эти листы браузер уже получил и они уже
 * лежат в precache. Сеть тут была бы вторым запросом за тем же файлом.
 * Если же в хранилище их нет — идём в сеть, но отказ НЕ роняет
 * сохранение: копия без одного из двух листов читается, а потерять из-за
 * него весь урок было бы платой не по счёту.
 */
async function keepSheetsBeside(store: CacheStorage, cacheName: string, html: string, origin: string): Promise<void> {
  try {
    const sheets = sheetUrlsInHtml(html, origin);
    if (sheets.length === 0) return;
    const cache = await store.open(cacheName);
    for (const sheet of sheets) {
      try {
        if (await cache.match(sheet, { ignoreVary: true })) continue;
        const known = await store.match(sheet, { ignoreVary: true });
        const response = known ?? (await fetch(sheet, { credentials: "omit", cache: "no-store" }));
        if (!response.ok) continue;
        await cache.put(sheet, response.clone());
      } catch {
        // Один лист — не вся копия; молча дальше.
      }
    }
  } catch {
    // Хранилище могло уехать целиком — это ловит `copyIsThere` ниже.
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
          if (
            !data ||
            data.type !== "rf-cache-names" ||
            typeof data.content !== "string" ||
            typeof data.section !== "string" ||
            typeof data.sheets !== "string"
          ) {
            finish(null);
            return;
          }
          finish({
            fingerprint: typeof data.fingerprint === "string" ? data.fingerprint : "",
            content: data.content,
            section: data.section,
            sheets: data.sheets,
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
