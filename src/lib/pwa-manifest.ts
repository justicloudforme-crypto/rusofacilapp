import type { MetadataRoute } from "next";

import { APP_ID, SITE_BRAND } from "./brand";
import type { Locale } from "@/i18n/config";

/**
 * МАНИФЕСТ PWA — ОДНА СБОРКА НА ОБЕ ЛОКАЛИ, ДОЛГ 83 (заход 7.217).
 *
 * Строка долга дословно: «`src/app/manifest.ts` отдаётся (200, 614 байт),
 * четыре иконки на месте и все четыре отдают 200 с верными размерами, но в
 * нём нет `lang`, `id`, `scope`, `categories`, `screenshots`,
 * `orientation`, `related_applications`, и он **один на обе локали**:
 * `name` и `short_name` — `RusoFácilapp` (строки 9, 10), описание только
 * по-испански (строка 11) → установка как PWA и, отдельно, сборка Google
 * TWA, которая строится из этого манифеста → без `related_applications` и
 * `id` магазин не связывает установку с приложением, без `screenshots`
 * установочная карточка Chrome выглядит обрезанной».
 *
 * ЧТО ЗДЕСЬ ЕСТЬ И ПОЧЕМУ ИМЕННО ТАКОЕ ЗНАЧЕНИЕ.
 *
 *   `id` — **один на обе локали, `/`**. Это НЕ недосмотр: `id` в манифесте
 *   и есть личность установленного приложения. Разный `id` у `/es` и `/ru`
 *   означал бы ДВА разных приложения на домашнем экране одного телефона —
 *   у человека, который посмотрел обе локали, их и стало бы два. Локаль
 *   меняет подпись и начальный адрес, а не личность.
 *
 *   `start_url` — `/{lang}`, а не `/`: человек ставит на экран тот сайт,
 *   который читал. Корень увёл бы его к выбору локали заново.
 *
 *   `scope` — `/`, а не `/{lang}`: внутри приложения есть переключатель
 *   языка, и со `scope: "/ru"` переход на `/es` выкидывал бы человека в
 *   браузер посреди сеанса.
 *
 *   `orientation` — `portrait`. Продукт читают с телефона в руке; альбом
 *   не запрещён системой, но карточка установки обещает то, под что
 *   свёрстаны экраны (замер полосы вкладок на девяти ширинах — 7.177).
 *
 *   `categories` — `["education"]`. Ровно одна, и та из списка W3C:
 *   вторая («books», «lifestyle») была бы догадкой о том, где нас ищут.
 *
 *   `screenshots` — НАСТОЯЩИЕ снимки живого продакшна, снятые
 *   `scripts/build-pwa-screenshots.mjs`, а не рисунки. Две формы
 *   (`narrow` 390×844 и `wide` 1280×800), потому что Chrome показывает
 *   расширенную карточку установки только когда есть обе.
 *
 *   `related_applications` — до 08.10.2026 поле было ПУСТЫМ: приложения
 *   не было ни в одном магазине, и ссылка вела бы в тупик. С заходом 7.259
 *   в нём ровно одна карточка — Google Play, `id` = `APP_ID` (приложение
 *   опубликовано 07.10.2026). App Store здесь нет и не будет, пока нет
 *   настоящего листинга: обещать iPhone-версию манифест не должен.
 *
 *   `prefer_related_applications` — `true` с 7.259 (решение владельца
 *   08.10.2026). Что это меняет, по исходникам Chromium:
 *     • Chrome на Android больше не предлагает поставить САЙТ на экран, а
 *       предлагает приложение из Google Play (сообщение внизу экрана —
 *       когда Chrome сочтёт посетителя вовлечённым; ничего не показывает,
 *       если приложение уже стоит на телефоне);
 *     • Chrome на компьютере (Windows, macOS, Linux) карточку `play`
 *       пропускает — `IsSupportedNonWebAppPlatform` там знает только Chrome
 *       Web Store (и Play на ChromeOS с Android-приложениями), — и сайт
 *       ставится как PWA ровно как раньше;
 *     • Safari на iPhone оба поля не читает — «На экран „Домой“» как было;
 *     • WebView оболочки Capacitor установок не делает вовсе — внутри
 *       приложения не меняется ничего.
 *   Сторож `check:pwa-manifest` держит оба поля в статике и в отдаче
 *   сервера (`--base`, шаг «Rendered surface»).
 */

/**
 * Стоит ли приложение в магазине. `true` с 08.10.2026 (заход 7.259):
 * «RusoFácil: aprender ruso» в Google Play с 07.10.2026 (сборка 14 /
 * 1.0.13). Признак включает карточку `play` в манифесте и
 * `prefer_related_applications` — Chrome на Android предлагает
 * приложение вместо установки сайта.
 */
export const STORE_LIVE = true;

/**
 * Страница приложения в Google Play — ЕДИНСТВЕННОЕ место в `src/`, где
 * записан этот адрес (правило 4 `check:purchase-no-store-link`).
 *
 * Заход 7.258: приложение опубликовано 07.10.2026 (продакшн, сборка 14 /
 * 1.0.13), и адрес стал нажимаемым — бейдж «Google Play» на главной, на
 * странице цен и в подвале, ТОЛЬКО в браузере (`PlayStoreBadge`, сторож
 * `check:play-link`). Заход 7.259: тот же адрес — карточка манифеста
 * (`STORE_LISTINGS`) и `sameAs` организации (`organizationJsonLd`).
 */
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${APP_ID}`;

/**
 * Карточки в магазинах. Пусто, если `STORE_LIVE` ложно: несуществующая
 * ссылка в манифесте хуже отсутствующей — она ведёт в тупик. `id` —
 * то, по чему Chrome ищет приложение в Google Play; `url` — для людей и
 * браузеров, которые `id` не читают.
 */
export const STORE_LISTINGS: NonNullable<MetadataRoute.Manifest["related_applications"]> = STORE_LIVE
  ? [{ platform: "play", url: PLAY_STORE_URL, id: APP_ID }]
  : [];

/** Снимки экрана живого продакшна. Пути и размеры — не на глаз: их пишет
 *  `scripts/build-pwa-screenshots.mjs`, а сторож сличает с файлами. */
export const SCREENSHOTS = [
  {
    src: "/screenshots/home-narrow.png",
    sizes: "390x844",
    type: "image/png",
    form_factor: "narrow" as const,
    label: "RusoFácilapp",
  },
  {
    src: "/screenshots/home-wide.png",
    sizes: "1280x800",
    type: "image/png",
    form_factor: "wide" as const,
    label: "RusoFácilapp",
  },
];

const DESCRIPTION: Record<Locale, string> = {
  es: "Ruso para hispanohablantes: curso A1–B2; vocabulario, cuentos y juegos hasta C1.",
  ru: "Русский язык для испаноговорящих: курс A1–B2, словарь, рассказы и игры до C1.",
};

export function pwaManifest(lang: Locale): MetadataRoute.Manifest {
  return {
    // Бренд САЙТА, не витринное имя приложения: под иконкой в App Store и
    // Google Play стоит «RusoFácil» (короче, долг 70 «б»), а установленный
    // с сайта PWA остаётся сайтом и подписывается его брендом. Значение
    // берётся из src/lib/brand.ts — единственного места, где оно
    // объявлено для кода.
    id: "/",
    name: SITE_BRAND,
    short_name: SITE_BRAND,
    description: DESCRIPTION[lang],
    lang,
    dir: "ltr",
    start_url: `/${lang}`,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    categories: ["education"],
    background_color: "#fff8ec",
    theme_color: "#2d5f8a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: SCREENSHOTS,
    related_applications: STORE_LISTINGS,
    prefer_related_applications: STORE_LIVE,
  };
}
