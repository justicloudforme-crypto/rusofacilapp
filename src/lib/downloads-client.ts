/**
 * ИСПОЛНЕНИЕ СКАЧИВАНИЯ — ЗАХОД 7.231 (ОФЛАЙН-3).
 *
 * Правила и числа — в `src/lib/downloads.ts`. Здесь только исполнение, и
 * вынесено оно из компонента по той же причине, что и в 7.230: у правила
 * есть примеры с подставными кешами (`downloads-client.test.ts`), а у
 * компонента React их без настоящего браузера быть не может.
 *
 * ====================================================================
 * ЧЕТЫРЕ РЕШЕНИЯ, КОТОРЫЕ ЗДЕСЬ СТОИТ ПРОЧИТАТЬ ДОСЛОВНО
 * ====================================================================
 *
 * 1. ВЕС СЧИТАЕТСЯ ИЗ НАСТОЯЩИХ ОТВЕТОВ, А НЕ ИЗ СРЕДНЕГО. Замер
 *    26.09.2026: HEAD на blob-источник отвечает `200` и
 *    `access-control-allow-origin: *` — то есть спросить вес клипа можно
 *    с самого телефона, серверный посредник не нужен. Средний клип урока
 *    `a1-1` весит 22 816 байт, а рассказа «Снегурочка» — 101 632: разница
 *    вчетверо, и «средним» тут врали бы вчетверо.
 *
 * 2. КЛИП БЕРЁТСЯ ПРОСТЫМ ЗАПРОСОМ С CORS И БЕЗ КУК. Ровно как в воркере
 *    (`WHOLE_CLIP_WITH_CORS`, `src/app/sw.ts`), и по той же измеренной
 *    причине: источник отвечает на `OPTIONS` — 405, разрешённый заголовок
 *    у него один. Любой лишний заголовок делает запрос непростым, браузер
 *    идёт с предварительным `OPTIONS` и получает отказ.
 *
 * 3. ЧАСТИЧНОЕ СКАЧИВАНИЕ НЕ ВЫДАЁТСЯ ЗА ГОТОВОЕ. Оборвалась сеть или не
 *    хватило места — всё, что успело лечь в этом заходе, СТИРАЕТСЯ, и
 *    строка описи не заводится вовсе. Иначе человек увидел бы «Descargado
 *    ✓» под рассказом, у которого замолчит середина.
 *
 * 4. ОПИСЬ ПИШЕТСЯ ПОСЛЕДНЕЙ И ТОЛЬКО ПОД ПРОВЕРЕННО ЛЕЖАЩЕЕ. Это то же
 *    правило, что починило строку 310 в этом же заходе: строка есть
 *    только там, где есть копия.
 */
import {
  DOWNLOADS_CACHE_NAME,
  DOWNLOADS_INDEX_PATH,
  type DownloadedClip,
  type DownloadedRow,
  downloadableKindOf,
  fitsBudget,
  langOfPath,
  parseDownloads,
  urlsOf,
  withDownload,
  withoutDownload,
  withoutDuplicates,
} from "./downloads";
import { looksClosedForThisVisitor } from "./sw-cache-policy";
import { sheetUrlsInHtml, tidyTitle, titleFromHtml } from "./offline-save";

export type DownloadOutcome =
  | "downloaded"
  /** Уже лежит целиком — второе нажатие не качает заново. */
  | "already"
  /** Закрыто этому посетителю: качать нечего, и лежащее стёрто. */
  | "closed"
  /** Не влезает в потолок веса — честный отказ, без частичного. */
  | "too-big"
  /** Сеть оборвалась: всё, что успело лечь, откатано. */
  | "network-failed"
  /** Место кончилось на стороне браузера: то же, откатано. */
  | "no-space"
  | "skipped-not-content"
  | "skipped-no-caches"
  | "failed";

export interface ClipWeights {
  clips: DownloadedClip[];
  /** Сколько клипов вес назвать не смогли (источник не ответил на HEAD). */
  unknown: number;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function indexUrlFor(sameOriginAs: string): string {
  return new URL(DOWNLOADS_INDEX_PATH, sameOriginAs).toString();
}

/** Простой запрос без единого лишнего заголовка — см. решение 2 в шапке. */
function clipRequest(url: string, method: "GET" | "HEAD"): [string, RequestInit] {
  return [url, { method, mode: "cors", credentials: "omit", cache: "no-store" }];
}

/**
 * ВЕС КЛИПОВ ИЗ НАСТОЯЩИХ ОТВЕТОВ. Спрашивается по шесть за раз: у урока
 * их 65, и последовательные 65 запросов на телефоне — это секунды
 * ожидания за числом, которое человек и так ждёт.
 */
export async function measureClips(urls: readonly string[], fetchImpl: FetchLike, concurrency = 6): Promise<ClipWeights> {
  const unique = [...new Set(urls)];
  const clips: DownloadedClip[] = unique.map((url) => ({ url, bytes: 0 }));
  let next = 0;
  let unknown = 0;
  const worker = async () => {
    while (next < clips.length) {
      const mine = clips[next++];
      try {
        const [url, init] = clipRequest(mine.url, "HEAD");
        const response = await fetchImpl(url, init);
        const length = Number(response.headers.get("content-length") ?? "0");
        if (response.ok && Number.isFinite(length) && length > 0) mine.bytes = length;
        else unknown += 1;
      } catch {
        unknown += 1;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, clips.length) || 1 }, worker));
  return { clips, unknown };
}

async function openDownloads(store: CacheStorage): Promise<Cache> {
  return store.open(DOWNLOADS_CACHE_NAME);
}

/**
 * ЧТЕНИЕ НЕ ИМЕЕТ ПРАВА ЗАВОДИТЬ КЕШ, И ЭТО ЗАМЕР, А НЕ ОПРЯТНОСТЬ.
 *
 * `caches.open(name)` на несуществующем имени СОЗДАЁТ кеш. Кнопка
 * «Descargar» спрашивает опись при каждом показе (иначе «уже скачано» она
 * узнавала бы только внутри одной вкладки), и без этой проверки пустой
 * кеш `rf-pages-downloads` появлялся у каждого, кто просто открыл урок.
 * Поймано прогоном 26.09.2026: перепись кешей в `e2e/sw-cache-budget.spec.ts`
 * напечатала «кеш rf-pages-downloads: записей 0» на телефоне, где ничего
 * не качали. Само по себе это не стоит ничего, но перепись кешей — прибор,
 * и прибор не должен показывать то, чего человек не делал.
 */
async function downloadsCacheExists(store: CacheStorage): Promise<boolean> {
  try {
    return (await store.keys()).includes(DOWNLOADS_CACHE_NAME);
  } catch {
    return false;
  }
}

export async function readDownloads(store: CacheStorage, origin: string): Promise<DownloadedRow[]> {
  try {
    if (!(await downloadsCacheExists(store))) return [];
    const cache = await openDownloads(store);
    const hit = await cache.match(indexUrlFor(origin), { ignoreVary: true });
    const listed = hit ? parseDownloads(await hit.json()) : [];
    const whole = withoutDuplicates([...listed, ...(await rowsFromCache(cache, origin, listed))]);
    return await withTitles(cache, whole);
  } catch {
    return [];
  }
}

/**
 * ОПИСЬ ПУСТА, А КЕШ — НЕТ: ВОССТАНОВЛЕНИЕ ИЗ САМОГО ТЕЛЕФОНА — СТРОКА 315.
 *
 * ====================================================================
 * ПОЧЕМУ ЭТО НУЖНО, И ЧТО ИМЕННО ИЗМЕРЕНО
 * ====================================================================
 *
 * Опись — это УТВЕРЖДЕНИЕ о телефоне, а кеш — сам телефон, и правило
 * захода 7.231 говорит верить телефону. Но верили ему только в одну
 * сторону: строку без копии снимали, а копию без строки не замечали
 * вовсе. Прогон 26.09.2026 (`.run7233/repro2.mjs index-gone`): стёрта
 * ОДНА запись описи при тринадцати живых записях кеша — и блок
 * «Descargado» исчезает целиком, вес не назван, «Borrar» предложить
 * нечему; сам рассказ при этом лежит и открывается.
 *
 * Опись теряется дешевле, чем кажется: её пишет ОДНА запись, а стереть
 * её может и уборщик выхода, попавший между `put` и `put` (строка 310),
 * и любой отказ на последнем шаге скачивания.
 *
 * ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ. Восстановленная строка НЕ переписывает опись:
 * чтение не имеет права быть записью (то же правило, что у `withTitles`).
 * Вес её — настоящий вес лежащих записей, а не число из описи, потому
 * что описи как раз и нет; клипы и листы стилей в неё не собираются
 * поимённо — их адреса без описи ни с одним материалом не связаны, и
 * приписать их наугад значило бы соврать в «удалить».
 */
async function rowsFromCache(cache: Cache, origin: string, known: readonly DownloadedRow[]): Promise<DownloadedRow[]> {
  const seen = new Set(known.map((row) => row.url));
  const out: DownloadedRow[] = [];
  const indexUrl = indexUrlFor(origin);
  for (const request of await cache.keys()) {
    if (request.url === indexUrl || seen.has(request.url)) continue;
    let pathname: string;
    try {
      pathname = new URL(request.url).pathname;
    } catch {
      continue;
    }
    const kind = downloadableKindOf(pathname);
    if (!kind) continue;
    let bytes = 0;
    let title = "";
    try {
      const hit = await cache.match(request, { ignoreVary: true });
      if (!hit || !hit.ok) continue;
      const html = await hit.text();
      bytes = new TextEncoder().encode(html).length;
      title = titleFromHtml(html);
    } catch {
      continue;
    }
    out.push({
      url: request.url,
      path: pathname,
      kind,
      title,
      lang: langOfPath(pathname),
      savedAt: 0,
      pageBytes: bytes,
      clips: [],
      sheets: [],
      bytes,
    });
  }
  return out;
}

/**
 * СТРОКА БЕЗ НАЗВАНИЯ БЕРЁТ ЕГО У СВОЕЙ ЖЕ КОПИИ — ЗАХОД 7.232, СТРОКА 312.
 *
 * Адрес на экране — это не название. Владелец 25.09.2026 получил в списке
 * `/es/stories` и `/es/vocabulary` вместо «Cuentos en ruso con audio y
 * traducción» и «Vocabulario ruso por temas»; читать по-английски он не
 * обязан, и адрес не говорит ему ничего. Опись могла лечь без названия
 * (разбор — у `titleFromHtml`), но сама скачанная разметка своё название
 * знает всегда: её и спрашиваем. Описи при этом НЕ переписываем — чтение
 * не имеет права быть записью.
 */
async function withTitles(cache: Cache, rows: DownloadedRow[]): Promise<DownloadedRow[]> {
  const out: DownloadedRow[] = [];
  for (const row of rows) {
    if (row.title) {
      out.push(row);
      continue;
    }
    let title = "";
    try {
      const page = await cache.match(row.url, { ignoreVary: true });
      if (page) title = titleFromHtml(await page.text());
    } catch {
      // Копии может не быть вовсе — тогда названию просто неоткуда взяться.
    }
    out.push(title ? { ...row, title } : row);
  }
  return out;
}

async function writeDownloads(store: CacheStorage, origin: string, rows: DownloadedRow[]): Promise<void> {
  const cache = await openDownloads(store);
  await cache.put(
    indexUrlFor(origin),
    new Response(JSON.stringify(rows), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    }),
  );
}

/**
 * ЛЕЖИТ ЛИ СКАЧАННОЕ ЦЕЛИКОМ. Спрашивается о КАЖДОМ адресе строки, а не
 * о странице: рассказ без середины звука — не скачанный рассказ.
 */
export async function isComplete(store: CacheStorage, row: DownloadedRow): Promise<boolean> {
  try {
    if (!(await downloadsCacheExists(store))) return false;
    const cache = await openDownloads(store);
    for (const url of urlsOf(row)) {
      if (!(await cache.match(url, { ignoreVary: true }))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export interface DownloadArgs {
  caches: CacheStorage;
  fetch: FetchLike;
  url: string;
  pathname: string;
  html: string;
  title: string;
  lang: "es" | "ru";
  /** Адреса клипов со страницы (атрибуты `data-rf-clip`). */
  clipUrls: readonly string[];
  /** Адреса листов стилей, объявленных страницей (строка 314). Если не
   *  переданы — берутся из самой разметки снимка. */
  sheetUrls?: readonly string[];
  /** Веса, уже посчитанные `measureClips` до нажатия. */
  weights?: ClipWeights;
  now: number;
  onProgress?: (done: number, total: number) => void;
}

/**
 * ОДНО СКАЧИВАНИЕ.
 *
 * Порядок утверждений тот же, что у сохранения 7.230, и это не
 * совпадение: правило платности одно, а рубежей теперь три — воркер,
 * страница и кнопка.
 */
export async function downloadPage(args: DownloadArgs): Promise<DownloadOutcome> {
  const kind = downloadableKindOf(args.pathname);
  if (!kind) return "skipped-not-content";
  if (!args.caches) return "skipped-no-caches";

  try {
    const rows = await readDownloads(args.caches, args.url);

    // ЗАКРЫТОЕ НЕ КАЧАЕТСЯ И СТИРАЕТСЯ. Тот же признак из разметки, что
    // у воркера и у страницы (`looksClosedForThisVisitor`): подписка
    // кончилась — скачанное обязано уйти при первом же заходе с сетью.
    if (looksClosedForThisVisitor(args.html)) {
      await removeDownload(args.caches, args.url);
      return "closed";
    }

    const existing = rows.find((row) => row.url === args.url);
    if (existing && (await isComplete(args.caches, existing))) return "already";

    const pageBytes = new TextEncoder().encode(args.html).length;
    const weights = args.weights ?? (await measureClips(args.clipUrls, args.fetch));
    const sheets = [...(args.sheetUrls ?? sheetUrlsInHtml(args.html, args.url))];
    const wanted = pageBytes + weights.clips.reduce((sum, clip) => sum + clip.bytes, 0);
    if (!fitsBudget(rows, wanted, args.url)) return "too-big";

    const cache = await openDownloads(args.caches);
    /** Что легло ИМЕННО в этом заходе — только это и откатывается. */
    const laid: string[] = [];
    const rollback = async () => {
      for (const url of laid) {
        try {
          await cache.delete(url, { ignoreVary: true });
        } catch {
          // Откат — уборка, а не обещание; упасть на ней нечем.
        }
      }
    };

    const total = weights.clips.length + 1;
    let done = 0;
    const step = () => {
      done += 1;
      args.onProgress?.(done, total);
    };

    try {
      await cache.put(
        args.url,
        new Response(args.html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }),
      );
      laid.push(args.url);
      step();
    } catch (error) {
      await rollback();
      return isQuotaError(error) ? "no-space" : "failed";
    }

    /**
     * ЛИСТЫ СТИЛЕЙ — В ЭТОТ ЖЕ КЕШ (строка 314). Берутся из хранилища,
     * если уже лежат (тогда сеть не нужна вовсе), и только иначе из
     * сети. В полосу «12 / 65» они НЕ входят: человек считает материал,
     * а не служебные файлы, и цифра, прыгнувшая с 60 на 62 ради двух
     * css, была бы цифрой не про его рассказ.
     *
     * Отказ листа стилей скачивание НЕ роняет: страница без одного из
     * двух листов читается, а вот потерять из-за него весь рассказ
     * было бы платой не по счёту. Целость проверяет `isComplete` по
     * тем адресам, которые в опись и попали, — то есть по реально
     * лежащим.
     */
    const laidSheets: string[] = [];
    for (const sheet of sheets) {
      try {
        if (await cache.match(sheet, { ignoreVary: true })) {
          laidSheets.push(sheet);
          continue;
        }
        const response = await args.fetch(sheet, { credentials: "omit", cache: "no-store" });
        if (!response.ok) continue;
        await cache.put(sheet, response);
        laid.push(sheet);
        laidSheets.push(sheet);
      } catch (error) {
        if (isQuotaError(error)) {
          await rollback();
          return "no-space";
        }
        // Сеть отказала ИМЕННО на стиле — материал от этого не пропал.
      }
    }

    // Клипы — по одному и последовательно намеренно: полоса «12 / 65»
    // обязана быть правдой, а не оценкой, и шесть одновременных загрузок
    // на телефонном Wi-Fi дают не скорость, а обрывы.
    for (const clip of weights.clips) {
      try {
        const [url, init] = clipRequest(clip.url, "GET");
        const response = await args.fetch(url, init);
        // `response.ok` обязателен: непрозрачный ответ (`status 0`) в кеш
        // не ляжет вовсе, а 403/404 лёг бы — и потом молчал.
        if (!response.ok) {
          await rollback();
          return "network-failed";
        }
        await cache.put(clip.url, response);
        laid.push(clip.url);
        step();
      } catch (error) {
        await rollback();
        if (isQuotaError(error)) return "no-space";
        return "network-failed";
      }
    }

    // ПРОВЕРКА ПЕРЕД ОПИСЬЮ — то же правило, что починило строку 310.
    const row: DownloadedRow = {
      url: args.url,
      path: args.pathname,
      kind,
      // То же правило, что у сохранения (строка 312): пустое название
      // берётся из самой разметки, а не превращается в адрес на экране.
      title: tidyTitle(args.title) || titleFromHtml(args.html),
      lang: args.lang,
      savedAt: args.now,
      pageBytes,
      clips: weights.clips,
      sheets: laidSheets,
      bytes: wanted,
    };
    if (!(await isComplete(args.caches, row))) {
      await rollback();
      return "failed";
    }

    await writeDownloads(args.caches, args.url, withDownload(await readDownloads(args.caches, args.url), row));
    return "downloaded";
  } catch {
    return "failed";
  }
}

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: unknown }).name;
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

/**
 * Удалить одно скачанное: и страницу, и все её клипы, и строку описи.
 *
 * ЛИСТ СТИЛЕЙ, КОТОРЫЙ НУЖЕН СОСЕДУ, НЕ УДАЛЯЕТСЯ (строка 314). Адрес
 * листа один на весь сайт, и все скачанные материалы делят одну запись;
 * удалить её вместе с первым же рассказом значило бы погасить в списке
 * все остальные — то есть починить дефект и завести его заново.
 */
export async function removeDownload(store: CacheStorage, url: string): Promise<number> {
  try {
    if (!(await downloadsCacheExists(store))) return 0;
    const rows = await readDownloads(store, url);
    const row = rows.find((one) => one.url === url);
    const needed = new Set(rows.filter((one) => one.url !== url).flatMap((one) => one.sheets));
    const cache = await openDownloads(store);
    let removed = 0;
    for (const victim of row ? urlsOf(row) : [url]) {
      if (needed.has(victim)) continue;
      if (await cache.delete(victim, { ignoreVary: true })) removed += 1;
    }
    await writeDownloads(store, url, withoutDownload(rows, url));
    return removed;
  } catch {
    return 0;
  }
}

/** Удалить всё скачанное. Кеш уносится целиком — описи в нём тоже не место. */
export async function removeAllDownloads(store: CacheStorage): Promise<boolean> {
  try {
    return await store.delete(DOWNLOADS_CACHE_NAME);
  } catch {
    return false;
  }
}

/**
 * ПОПРОСИТЬ БРАУЗЕР НЕ ВЫБРАСЫВАТЬ НАШЕ ХРАНИЛИЩЕ.
 *
 * Без этого Cache Storage — «лучшее из возможного»: браузер вправе унести
 * его под нехваткой места, и тогда обещание «скачано» держится только до
 * следующего тесного дня. Спрашивается ровно один раз, при первом
 * скачивании: спрашивать заранее — просить у человека разрешение под то,
 * чего он ещё не делал.
 */
export async function askPersistence(): Promise<"granted" | "denied" | "unsupported"> {
  try {
    const storage = (navigator as Navigator & { storage?: StorageManager }).storage;
    if (!storage || typeof storage.persist !== "function") return "unsupported";
    if (typeof storage.persisted === "function" && (await storage.persisted())) return "granted";
    return (await storage.persist()) ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
}

/**
 * СНИМОК СТРАНИЦЫ ДЛЯ СКАЧИВАНИЯ — ЗАХОД 7.232, СТРОКА 313.
 *
 * ====================================================================
 * ЧТО БЫЛО СЛОМАНО
 * ====================================================================
 *
 * Владелец 25.09.2026 открыл скачанную «Снегурочку» без сети и увидел на
 * её кнопке «↓ 0 / 13» — состояние НАЧАЛА скачивания, застывшее навсегда.
 * Так же застыли урок A1/1 («↓ 0 / 60») и «Репка» («↓ 0 / 15»).
 *
 * ПРИЧИНА, доказанная прогоном (`.run7232/dl.mjs`, замер 24.09.2026):
 * кнопка ставила фазу `running` ДО того, как снять разметку, а
 * `await askPersistence()` отдавал React кадр на отрисовку. К моменту
 * `documentElement.outerHTML` на экране уже стояло «↓ 0 / 13» — оно и
 * легло в кеш. В снимке из кеша так и прочиталось: `"↓0 / 13"`.
 *
 * ====================================================================
 * ЧЕМ ПОЧИНЕНО
 * ====================================================================
 *
 * Снимок берётся ОДИН РАЗ, и берётся с КОПИИ дерева, а не с живого
 * документа: у копии кнопка сразу ставится в то состояние, в котором она
 * и окажется у читателя скачанного, — «✓ Descargado ✓», выключенная.
 * Промежуточных состояний в снимок не попадает ни одного, потому что
 * снимок и промежуточное состояние больше не делят один объект.
 *
 * ТОТ ЖЕ СНИМОК ВЗВЕШИВАЕТСЯ И ТОТ ЖЕ КЛАДЁТСЯ (задача 5 захода): вес,
 * названный до нажатия, и вес, записанный в опись, обязаны быть одним
 * числом. Разметка страницы растёт от того, что человек на ней открыл, —
 * замер 24.09.2026 на боевом уроке `a1-1`: 272 844 байта и 59 клипов
 * сразу после открытия, 310 941 байт и 71 клип после того, как открыты
 * все вкладки. Взвесь мы одно дерево, а положи другое — числа разошлись
 * бы, и разошлись бы молча.
 */
export function copyMarkupOf(doc: Document, doneLabel: string | null): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement;
  if (doneLabel === null) {
    // ПРОСТО ПРОСМОТРЕННАЯ КОПИЯ (7.230) КНОПКИ НЕ ПОКАЗЫВАЕТ ВОВСЕ:
    // «Descargado ✓» в ней было бы неправдой, а живая «Descargar» —
    // кнопкой, которая не нажимается (скрипты из копии вырезаны).
    for (const block of clone.querySelectorAll("[data-rf-download]")) block.remove();
    return `<!doctype html>\n${clone.outerHTML}`;
  }
  for (const button of clone.querySelectorAll("[data-rf-download-button]")) {
    button.setAttribute("disabled", "");
    button.setAttribute("aria-busy", "false");
    const mark = button.querySelector('[aria-hidden="true"]');
    if (mark) mark.textContent = "✓";
    const label = button.querySelector("[data-rf-download-label]");
    if (label) label.textContent = doneLabel;
  }
  // Заметка «Página y 12 audios» и строка ошибки — про НАЖАТИЕ, а не про
  // материал; в копии, где нажимать нечего, они врут обе.
  for (const note of clone.querySelectorAll("[data-rf-download-note], [data-rf-download-error]")) note.remove();
  return `<!doctype html>\n${clone.outerHTML}`;
}

/** Адреса клипов, объявленные самой страницей. Один источник правды и для
 *  скачивания, и для звука в каркасе без сети. */
export function clipUrlsOnPage(root: ParentNode): string[] {
  const out: string[] = [];
  for (const node of root.querySelectorAll("[data-rf-clip]")) {
    const url = node.getAttribute("data-rf-clip");
    if (url && !out.includes(url)) out.push(url);
  }
  return out;
}
