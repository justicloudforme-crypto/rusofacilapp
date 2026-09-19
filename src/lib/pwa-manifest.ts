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
 *   `related_applications` — поле ЕСТЬ, и оно ПУСТО, и это измеренная
 *   правда, а не забывчивость. Приложения нет ни в Google Play, ни в App
 *   Store (линия магазинов — долги 144…149, 151, 163, все ждут учётных
 *   записей и денег владельца). Написать сюда
 *   `market://details?id=com.rusofacilapp.app` сегодня значило бы увести
 *   человека на несуществующую карточку магазина. Как только листинг
 *   появится, его кладут в `STORE_LISTINGS` ниже — и сторож
 *   `check:pwa-manifest` следит, чтобы значение и признак `STORE_LIVE` не
 *   разошлись.
 */

/** Стоит ли приложение в магазинах. Пока `false` — см. долги 144…149. */
export const STORE_LIVE = false;

/**
 * Карточки в магазинах. Пусто, пока `STORE_LIVE` ложно: несуществующая
 * ссылка в манифесте хуже отсутствующей — она ведёт в тупик.
 */
export const STORE_LISTINGS: NonNullable<MetadataRoute.Manifest["related_applications"]> = STORE_LIVE
  ? [{ platform: "play", url: `https://play.google.com/store/apps/details?id=${APP_ID}`, id: APP_ID }]
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
