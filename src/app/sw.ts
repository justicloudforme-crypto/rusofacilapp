/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { CacheFirst, CacheableResponsePlugin, ExpirationPlugin, NetworkFirst, NetworkOnly, RangeRequestsPlugin, Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig, SerwistPlugin } from "serwist";
import { buildFingerprint, pageCacheNames, staleCacheNames } from "@/lib/sw-cache-names";
import { AUDIO_CACHE_NAME, CACHE_BUDGET_BY_KEY, isAudioClipUrl } from "@/lib/sw-cache-policy";

// The `/// <reference lib="webworker" />` above scopes this file's ambient
// `self` type to ServiceWorkerGlobalScope without touching the project-wide
// tsconfig `lib` (which needs "dom", used everywhere else) — the standard
// pattern for a single service-worker file living inside an otherwise
// browser-DOM TypeScript project.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// defaultCache (from @serwist/next/worker) already implements the
// NetworkFirst-for-pages / CacheFirst-for-static-assets split from the
// mobile-architecture plan — reusing it instead of hand-rolling route
// matchers, since content now lives in the DB (see FlashcardCard/Idiom/
// Story models) and can change between admin edits, so pages/API routes
// must not go stale behind an aggressive cache.
const precacheEntries = self.__SW_MANIFEST ?? [];

// Debt 14, confirmed by experiment: a returning visitor whose network fails
// after a deploy was served the PRE-DEPLOY page at HTTP 200, out of
// defaultCache's fixed-name "pages" / "pages-rsc" / "pages-rsc-prefetch"
// caches (24h expiry, NetworkFirst). Scoping those three names to the build
// means a new deploy cannot read the old build's entries at all. See
// src/lib/sw-cache-names.ts for the measurement and the reasoning.
//
// Only these three are re-scoped. Everything else in defaultCache is keyed
// by content-hashed URLs (/_next/static/...) or is genuinely
// build-independent (fonts, images, audio), so scoping those would throw
// away a working cache on every deploy for no benefit.
const FINGERPRINT = buildFingerprint(precacheEntries as Array<string | { url: string; revision?: string | null }>);
const CACHES = pageCacheNames(FINGERPRINT);

const REBUILT: Record<string, string> = {
  "pages-rsc-prefetch": CACHES.rscPrefetch,
  "pages-rsc": CACHES.rsc,
  pages: CACHES.html,
  // "others" is the one that actually held the stale document — see
  // pageCacheNames() for why defaultCache's "pages" route never matches a
  // navigation and everything falls through to this catch-all.
  others: CACHES.others,
};

/** Какой строке бюджета (`src/lib/sw-cache-policy.ts`) отвечает каждое
 *  переименованное имя. Раньше здесь не было ничего: переименованная
 *  стратегия получала ЧУЖОЙ объект плагина из `@serwist/next`, и потолок в
 *  32 записи приходил из `node_modules` — то есть был не наш и чинить его
 *  было негде (долг 75). */
const BUDGET_KEY: Record<string, "html" | "rsc" | "rscPrefetch" | "others"> = {
  "pages-rsc-prefetch": "rscPrefetch",
  "pages-rsc": "rsc",
  pages: "html",
  others: "others",
};

/**
 * Свежий срок годности на КАЖДЫЙ кеш, с числом из нашей таблицы.
 *
 * `ignoreVary: true` — И ЭТО НАСТОЯЩАЯ ПРИЧИНА ДОЛГА 75, найденная
 * экспериментом 19.09.2026, а не догадкой.
 *
 * Что измерено. После прокрутки трёх каталогов в кеше
 * `rf-pages-rsc-prefetch-*` лежало **704 записи при объявленных 64**, а в
 * хранилище сроков годности (`IndexedDB serwist-expiration`,
 * `cache-entries`) — **69 записей на все кеши сразу**. То есть плагин
 * исправно вычёркивал лишнее у себя и исправно звал `cache.delete(url)` —
 * а из самого кеша не удалялось НИЧЕГО.
 *
 * Почему. `CacheExpiration.expireEntries` зовёт
 * `cache.delete(url, this._matchOptions)`, и без `matchOptions` браузер
 * обязан учитывать заголовок `Vary`. У ответа RSC он длинный (`RSC`,
 * `Next-Router-State-Tree`, `Next-Router-Prefetch`, …), поэтому:
 *
 *   * один и тот же адрес лежит в кеше НЕСКОЛЬКИМИ записями — по одной на
 *     каждое сочетание состояния роутера, отсюда 704 записи там, где
 *     адресов на порядок меньше;
 *   * `cache.delete(url)` без `ignoreVary` не совпадает ни с одной из них,
 *     потому что у запроса-ключа при удалении этих заголовков нет вовсе.
 *
 * `ignoreVary: true` СНИМАЕТ ровно эту разницу и только при УДАЛЕНИИ:
 * стратегия читает кеш своими правилами, с `Vary` как есть, поэтому
 * чужой flight-ответ на чужое состояние роутера никому не отдастся.
 * Удаление же становится тем, чем его считали: «выкинуть этот адрес».
 */
function expiration(key: "html" | "rsc" | "rscPrefetch" | "others" | "audio") {
  const budget = CACHE_BUDGET_BY_KEY[key];
  return new ExpirationPlugin({
    maxEntries: budget.maxEntries,
    maxAgeSeconds: budget.maxAgeSeconds,
    matchOptions: { ignoreVary: true },
  });
}

const runtimeCaching = defaultCache.map((route) => {
  const current = (route.handler as { cacheName?: string } | undefined)?.cacheName;
  const renamed = current ? REBUILT[current] : undefined;
  if (!renamed) return route;
  // Rebuilt rather than mutated: a Strategy reads its own cacheName in
  // several places and Serwist gives no supported way to change it after
  // construction.
  //
  // ДОЛГ 75. Плагины больше НЕ заимствуются у переименованной стратегии:
  // каждый кеш получает свой `ExpirationPlugin`, собранный из нашей
  // таблицы бюджетов. Замер, ради которого это сделано: у
  // `rf-pages-rsc-prefetch` лежало 139 записей против объявленных 32, и
  // объявление было чужое.
  return {
    matcher: route.matcher,
    handler: new NetworkFirst({
      cacheName: renamed,
      plugins: [expiration(BUDGET_KEY[current!])],
    }),
  };
});

/**
 * ПЛАТЁЖНЫЕ ПОВЕРХНОСТИ ВОРКЕР НЕ КЕШИРУЕТ ВОВСЕ — ДОЛГ 179.
 *
 * Почему это здесь, а не только на сервере. Внутри нативной оболочки
 * сервер узнаёт приложение и отдаёт ему страницу без кассы
 * (`src/lib/native-shell.ts`). Копия, однажды положенная воркером в кеш,
 * этого различия не помнит: NetworkFirst достаёт её, как только сеть
 * молчит, — и человек внутри приложения снова видит веб-кассу, которой
 * магазины не прощают. Цена отказа от кеша ровно этой страницы нулевая:
 * офлайн ей всё равно нечего показать, кроме общего экрана `offline.html`,
 * который и подставится дальше.
 *
 * Пути перечислены обеими локалями явно, а не одним `includes("pricing")`:
 * подстрока встречается в адресах, которые к оплате отношения не имеют.
 */
/**
 * КЛИП ОЗВУЧКИ БЕРЁТСЯ ЦЕЛИКОМ И С CORS — ИНАЧЕ В КЕШ ЛОЖИТСЯ ТО, ЧЕМ
 * ПОТОМ НЕЧЕМ ОТВЕТИТЬ. Найдено экспериментом 20.09.2026 (заход 7.218),
 * а не чтением: ровно это и был дефект «рассказ не играет».
 *
 * ЧТО ИЗМЕРЕНО. Проигрыватель просит клип ЭЛЕМЕНТОМ `<audio>`, а тот
 * ходит в сеть без CORS (`mode: "no-cors"`) и С заголовком `Range` —
 * оба признака сняты с настоящего запроса в собранном воркере. Чужой
 * источник отвечает 206, но браузер отдаёт воркеру ответ НЕПРОЗРАЧНЫМ:
 * `status 0`, `type "opaque"`, тело нечитаемо — снятая длина тела
 * **0 байт** при файле в 1 303 724 байта. Прежнее правило
 * (`statuses: [0, 200]`) такой ответ КЛАЛО В КЕШ, и на втором
 * прослушивании выходило вот что:
 *
 *   * `CacheFirst` достаёт из кеша ту самую пустую запись;
 *   * `RangeRequestsPlugin` режет из неё кусок и отдаёт **416** с телом
 *     в 0 байт;
 *   * элемент `<audio>` получает `MEDIA_ERR_SRC_NOT_SUPPORTED` (код 4) и
 *     молчит: кнопка остаётся «play», полоса не движется.
 *
 * Числа замера на собранном приложении 20.09.2026, один и тот же рассказ
 * три раза подряд: первый заход — играет (`currentTime` растёт, ошибок
 * 0), второй и третий — `currentTime 0`, `paused true`, `error.code 4`.
 * С этой правкой те же три захода: играет каждый раз, в кеше лежит
 * настоящий ответ (`status 200`, `type "cors"`, тело 43 392 байта), а на
 * запрос с `Range` воркер отдаёт 206 с телом в 101 байт.
 *
 * Почему `credentials: "omit"`: запрос уходит на ЧУЖОЙ источник, куки
 * ему не нужны и посылать их незачем.
 */
const WHOLE_CLIP_WITH_CORS: SerwistPlugin = {
  requestWillFetch: async ({ request }) => new Request(request.url, { mode: "cors", credentials: "omit" }),
};

/**
 * ЛИЧНЫЕ СТРАНИЦЫ ВОРКЕР НЕ КЕШИРУЕТ ВОВСЕ — НАХОДКА ЗАХОДА 7.218.
 *
 * Замер 20.09.2026 на собранном приложении: после одного захода в кабинет
 * в кеше документов `rf-pages-*` лежала страница `/ru/profile` размером
 * **167 965 байт, с адресом почты владельца внутри**, при том что сервер
 * пометил её так громко, как позволяет HTTP: `Cache-Control: private,
 * no-cache, no-store, max-age=0, must-revalidate`. Дальше куки очищались
 * (то же, что выход из аккаунта), сеть отключалась — и воркер отдавал
 * навигации на `/ru/profile` ЧУЖОЙ кабинет целиком: «Личный кабинет»,
 * вкладки, имя. Это не устаревание, а показ личных данных другому
 * человеку на том же устройстве.
 *
 * Почему правило пути, а не `no-store` у ответа: на этом сайте `no-store`
 * стоит у ВСЕХ страниц без исключения (замер тех же суток: 12 адресов из
 * 12, весь сайт рендерится динамически) — правило по заголовку опустошило
 * бы кеш документов целиком и вернуло бы долг 76 в тот же день.
 *
 * Цена отказа от кеша ровно этих адресов нулевая: кабинет и админка
 * офлайн бессмысленны — в них нечего показать без ответа сервера.
 */
const PRIVATE_PATH = /^\/(es|ru)\/(profile|admin)(\/|$)/;

const PAYMENT_PATH = /^\/(es|ru)\/pricing(\/|$)/;

/** Уже лежащие в кешах копии страницы цен — с прошлых установок, до этой
 *  правки. Пока их не убрать, старый ответ переживёт выкат. */
async function dropCachedPaymentPages(): Promise<void> {
  for (const name of await caches.keys()) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      try {
        if (PAYMENT_PATH.test(new URL(request.url).pathname)) await cache.delete(request);
      } catch {
        // Непарсящийся адрес в кеше — не наша забота, пропускаем.
      }
    }
  }
}

// Whatever the previous build (or the pre-fix, fixed-name config) left
// behind is dead weight the moment this worker activates.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const existing = await caches.keys();
      await Promise.all(staleCacheNames(existing, FINGERPRINT).map((name) => caches.delete(name)));
      await dropCachedPaymentPages();
    })()
  );
});

/** Стратегия кеша клипов — вынесена из строки маршрута, потому что у
 *  маршрута теперь свой обработчик с запасным выходом в сеть (см. ниже). */
const audioStrategy = new CacheFirst({
  cacheName: AUDIO_CACHE_NAME,
  plugins: [
    expiration("audio"),
    // Порядок важен: сначала подменяем запрос на «весь файл с CORS»,
    // потом решаем, что кешировать.
    WHOLE_CLIP_WITH_CORS,
    // ТОЛЬКО 200 и только читаемое тело. Прежнее `[0, 200]` клало в кеш
    // непрозрачный ответ с нечитаемым телом — это и есть дефект
    // «рассказ не играет со второго раза», разобранный числами у
    // WHOLE_CLIP_WITH_CORS.
    new CacheableResponsePlugin({ statuses: [200] }),
    new RangeRequestsPlugin(),
  ],
});

const serwist = new Serwist({
  // `precacheEntries`, not `self.__SW_MANIFEST` again: Serwist's webpack
  // plugin substitutes the manifest at the literal occurrence of that
  // identifier and refuses to build if it appears more than once
  // ("Multiple instances of self.__SW_MANIFEST were found in your SW
  // source"). The single read is at the top of this file.
  precacheEntries,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Строка про оплату стоит ПЕРВОЙ, и это не вкусовщина: маршрутизатор
  // Serwist берёт первое совпадение в порядке регистрации, а у
  // `defaultCache` последним стоит всеохватный `others`, которым и
  // обслуживаются все переходы (см. `pageCacheNames`). Встань наша строка
  // после — она не сработала бы ни разу.
  runtimeCaching: [
    {
      matcher: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
        sameOrigin && PAYMENT_PATH.test(url.pathname),
      handler: new NetworkOnly(),
    },
    {
      // Личный кабинет и админка — см. PRIVATE_PATH выше. Стоит рядом с
      // платёжной строкой и по той же причине: маршрутизатор берёт первое
      // совпадение, а ниже стоит маршрут документов, который забрал бы
      // навигацию себе.
      matcher: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
        sameOrigin && PRIVATE_PATH.test(url.pathname),
      handler: new NetworkOnly(),
    },
    /**
     * ДОКУМЕНТ — СВОЙ КЕШ, ДОЛГ 76.
     *
     * Маршрут «pages» у `defaultCache` недостижим по построению: он
     * требует у ЗАПРОСА заголовок `Content-Type: text/html`, которого
     * навигация не шлёт никогда (замер записан в `sw-cache-names.ts`).
     * Поэтому каждый документ падал во всеохватный `others` и делил
     * тридцать две записи со статикой: в замере 7.143 на 32 записи
     * приходилось 8 документов и 24 файла — и из 12 обойдённых подряд
     * адресов офлайн открывались 8.
     *
     * Судим по `request.mode === "navigate"` — признаку самой навигации, а
     * не по заголовку, которого не бывает. Стоит ДО `runtimeCaching`,
     * иначе всеохватный `others` заберёт запрос себе первым.
     */
    {
      matcher: ({ request, url, sameOrigin }: { request: Request; url: URL; sameOrigin: boolean }) =>
        sameOrigin && request.mode === "navigate" && !url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({ cacheName: CACHES.html, plugins: [expiration("html")] }),
    },
    /**
     * КЛИП ОЗВУЧКИ — СВОЙ КЕШ, ДОЛГ 77.
     *
     * Совпадение считает ФУНКЦИЯ, а не регулярка, и в этом вся починка:
     * `RegExpRoute` у `serwist` отказывается применять регулярку к чужому
     * адресу, если совпадение начинается не с нулевого символа, — а
     * `\.mp3$` на `https://…public.blob.vercel-storage.com/a/b.mp3`
     * совпадает в конце. Замер до правки: 40 запрошенных клипов, 40
     * ответов 200, 0 записей в `static-audio-assets` (кеш не создан
     * вовсе) и 32 в общем `cross-origin` с часом жизни.
     *
     * `statuses: [0, 200]` СТОЯЛО ЗДЕСЬ ДО 20.09.2026 И ОКАЗАЛОСЬ
     * ДЕФЕКТОМ: непрозрачный ответ (`status 0`) кешировался, а тело у
     * него нечитаемо — разбор числами в `WHOLE_CLIP_WITH_CORS` выше.
     * Теперь клип берётся целиком и с CORS, а кешируется только 200.
     * `RangeRequestsPlugin` — потому что проигрыватель просит куски
     * файла, а не файл целиком, и режет он их из ЦЕЛОГО тела.
     */
    {
      matcher: ({ url }: { url: URL }) => isAudioClipUrl(url),
      /**
       * СЕТЬ ПОСЛЕДНИМ РУБЕЖОМ, И ЭТО НЕ ПЕРЕСТРАХОВКА (заход 7.218).
       *
       * Ради читаемого тела клип берётся с CORS — значит теперь у
       * озвучки есть зависимость, которой раньше не было: правила
       * чужого источника. Замер тех же суток: простой GET с `Origin`
       * даёт 206 и `access-control-allow-origin: *`, а предварительный
       * запрос `OPTIONS` — **405**, и разрешённых заголовков у
       * источника ровно один (`content-type`). То есть любой лишний
       * заголовок делает запрос НЕпростым, браузер идёт с `OPTIONS` и
       * получает отказ. В браузере человека лишних заголовков нет; но
       * цена ошибки тут — немая озвучка на всём сайте, и она слишком
       * велика, чтобы полагаться на чужие настройки.
       *
       * Поэтому отказ стратегии не роняет воспроизведение: клип
       * доигрывается прямо из сети исходным запросом, просто без кеша.
       */
      handler: async (options: Parameters<CacheFirst["handle"]>[0]) => {
        try {
          return await audioStrategy.handle(options);
        } catch {
          return fetch(options.request);
        }
      },
    },
    ...runtimeCaching,
  ],
  // When a page navigation isn't in the cache and the network fetch fails
  // (offline, DNS down, etc.), serve the precached offline.html instead of
  // letting the browser show its own generic error screen. Only matches
  // document (HTML page) requests — a failed API/asset fetch still just
  // fails normally, since offline.html has no useful fallback data for
  // those. Deliberately a static public/ file, not a Next page — see
  // public/offline.html's own comment for why a real app route broke here.
  fallbacks: {
    entries: [{ url: "/offline.html", matcher: ({ request }) => request.destination === "document" }],
  },
});

/**
 * Маячок журнала спроса — единственный маршрут, у которого здесь есть своя
 * строка, и заведена она замером, а не осторожностью (PROGRESS.md 7.134).
 *
 * Что измерено. `POST /api/search/log` уходит из `pagehide` умирающего
 * документа (`src/lib/search/log-client.ts`). Метода `POST` не совпадает
 * ни с одним маршрутом `defaultCache` — все они про `GET`, — поэтому
 * Serwist на него не отвечал вовсе и запрос уходил «мимо» воркера. Мимо —
 * только на словах: страницей владеет воркер, значит запрос всё равно
 * обязан пройти через его `fetch`, и Chromium этого перехода умирающему
 * документу не прощает. Числа, снятые на сборке этой ветки, 16 попыток на
 * столбец:
 *
 *   | конфигурация                        | дошло до сервера |
 *   |-------------------------------------|------------------|
 *   | Chromium, воркер контролирует       | **6 и 8 из 16**  |
 *   | Chromium, воркер заблокирован       | 16 из 16         |
 *   | WebKit, воркер контролирует         | 16 из 16         |
 *   | Chromium, эта строка на месте       | **16 из 16**     |
 *
 * Прогрев отдельно проверен: потеря не объясняется «воркер как раз
 * ставится» — 8 из 16 потеряно и тогда, когда `navigator.serviceWorker
 * .controller` был непустым до начала замера (16 из 16 попыток).
 *
 * То есть журнал спроса терял у Chromium больше половины выходов «ушёл на
 * другой адрес» — ровно тот перекос, ради устранения которого долг 52
 * вообще чинился. `NetworkOnly` не кеширует ничего и не меняет ответ; она
 * лишь заставляет воркер взять запрос себе сразу, вместо того чтобы
 * оставить его без владельца в момент, когда документ уже уезжает.
 */
/**
 * Дописано 07.09.2026 сторожем `check:dying-posts` (долг 59).
 *
 * Правило было записано выше словами и не закреплено ничем. Сторож,
 * заведённый в этом же заходе, прошёл `src/` и нашёл, что таких отправок
 * не одна, а ТРИ: кроме маячка журнала спроса через общий транспорт
 * `postReliably` (`src/lib/reliable-post.ts`, `keepalive: true` плюс
 * `sendBeacon` последним рубежом) уходят ещё «пазл решён»
 * (`/api/word-games/complete`) и «карточка выучена»
 * (`/api/flashcard-progress`). У обеих не было своей строки здесь — то
 * есть обе стояли ровно в том положении, в котором у Chromium замерена
 * потеря 6 и 8 доставок из 16.
 *
 * Список, а не три отдельных вызова: правило одно на все такие отправки,
 * и следующая обязана попасть сюда же — за этим и следит сторож.
 */
const DYING_DOCUMENT_POST_PATHS = [
  "/api/search/log",
  "/api/word-games/complete",
  "/api/flashcard-progress",
];

serwist.registerCapture(
  ({ url, sameOrigin }) => sameOrigin && DYING_DOCUMENT_POST_PATHS.includes(url.pathname),
  new NetworkOnly(),
  "POST"
);

serwist.addEventListeners();
