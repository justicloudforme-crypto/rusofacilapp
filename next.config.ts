import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/** Отпечаток каркаса без сети — см. `additionalPrecacheEntries` ниже. */
function offlineShellRevision(): string {
  return createHash("sha256").update(readFileSync("public/offline.html")).digest("hex").slice(0, 16);
}

const nextConfig: NextConfig = {
  // Baked into the client bundle at build time, because the browser has no
  // way to read VERCEL_ENV at runtime. Empty string on any build that is
  // not running on Vercel (a laptop, CI), which is what disables the
  // browser Sentry SDK there — see src/lib/deploy-environment.ts for why
  // NODE_ENV cannot be used for this.
  env: {
    NEXT_PUBLIC_DEPLOY_ENV: process.env.VERCEL_ENV ?? "",
  },
  // Next.js's dev server blocks cross-origin requests for its own JS
  // chunks/HMR websocket by default (a DNS-rebinding protection) — only
  // "localhost" is allowed out of the box. That silently 403s every JS
  // chunk (React never hydrates, so nothing client-side works — including
  // MobileMenu's tap handler) for anyone testing over the LAN via the dev
  // machine's IP instead of localhost, e.g. a phone hitting the "Network:"
  // URL `next dev` prints (see MOBILE.md's mobile-testing instructions).
  // Add the dev machine's LAN IP here if it changes (`ipconfig getifaddr
  // en0` on macOS) — the error Next.js logs to the terminal when it blocks
  // a request always names the exact origin to add. "0.0.0.0" is separate
  // from the LAN IP above — it's the origin an in-editor browser preview
  // (e.g. VS Code's Simple Browser/webview) presents when proxying
  // localhost, hit the same 403-all-chunks failure mode from here too.
  allowedDevOrigins: ["192.168.1.69", "0.0.0.0"],
  // Static YouTube thumbnail hosts for the /media catalog cards
  // (img.youtube.com/vi/{id}/mqdefault.jpg) — no API call, just a plain
  // static image URL YouTube serves for any public video.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.youtube.com" }],
  },
  experimental: {
    // Своя страница 404 — долг 129. Под флагом, потому что в Next 16.3
    // конвенция `app/global-not-found.tsx` ещё экспериментальная; флаг
    // меняет РОВНО одно: чем отрисован внутренний маршрут `/_not-found` —
    // встроенной английской заглушкой Next или нашим документом
    // (node_modules/next/dist/build/webpack/loaders/next-app-loader). Ни
    // один другой маршрут от него не зависит, и это проверено замером:
    // `check:rendered` и `check:frozen` после включения те же.
    //
    // Обычный `not-found.tsx` здесь непригоден, и это измерено: у
    // приложения нет `src/app/layout.tsx`, поэтому Next не читает
    // `[lang]/not-found.tsx` вовсе, а границы уровнем ниже попадают в
    // payload, но документ остаётся пустой оболочкой `__next_error__`.
    // Подробности — в шапке `src/app/global-not-found.tsx`.
    globalNotFound: true,
    // ПАМЯТЬ СБОРКИ — строка долга 293. Замер 21.09.2026: на Vercel (4 ядра,
    // 8 ГБ) сборка PR #380 была убита SIGKILL через 1 мин 37 с с пометкой
    // «At least one "Out of Memory" ("OOM") event was detected during the
    // build», а сборка PR #382 вместо падения ВИСЕЛА 45 минут и её убил лимит
    // времени. Обе — один и тот же дефицит памяти, разница лишь в том,
    // перешагнул ли аллокатор черту сразу или остался под ней и ушёл в
    // сборку мусора начисто (в локальном падении V8 сам напечатал долю
    // полезной работы: `average mu = 0.222, current mu = 0.110`, то есть
    // 89 % времени тратилось на GC).
    //
    // Этот флаг — встроенное средство Next: он держит меньший максимум кучи
    // ценой чуть более долгой компиляции. Замер до/после — в PROGRESS.md,
    // раздел 7.221.
    webpackMemoryOptimizations: true,
    // Сколько процессов Next поднимает на генерацию статических страниц.
    // По умолчанию — по числу ядер минус один: на этой машине 8 ядер дали
    // «Generating static pages using 7 workers», на Vercel 4 ядра дадут 3.
    // Каждый такой процесс — отдельный Node с загруженным серверным бандлом, и
    // убивает контейнер Vercel именно СУММА по дереву, а не самый толстый
    // процесс. Два воркера хватает: страниц 443, и вся генерация занимает
    // 2–4 секунды — на общем времени сборки (около двух минут) это не видно,
    // а верхняя граница памяти становится предсказуемой:
    // (1 головной + 2 воркера) × потолок кучи.
    cpus: 2,
  },
  // ХРАНИЛИЩЕ КЕША ВЕБПАКА — вторая половина строки долга 293.
  //
  // Замер 21.09.2026 на этой машине: сразу после сборки «с нуля»
  // `.next/cache/webpack/server-production` весит **1,0 ГБ**, а после трёх
  // обычных сборок подряд — **1,6 ГБ**, причём внутри лежат `index.pack`
  // 322 МБ и `0.pack` 438 МБ. Vercel этот каталог ВОССТАНАВЛИВАЕТ перед
  // каждой сборкой («Restored build cache from previous deployment» —
  // первая строка журнала упавшего выката PR #382) и сохраняет после неё,
  // поэтому у вебпака на Vercel нет ни одной причины перестать расти: у
  // `cache.maxAge` по умолчанию МЕСЯЦ, и мёртвые записи всё это время
  // переносятся из сборки в сборку. Именно этим объясняется наблюдение
  // владельца «падает примерно каждая вторая, а `Redeploy` БЕЗ КЕША всегда
  // помогает»: редеплой без кеша обнуляет каталог, счётчик роста начинается
  // заново, и несколько сборок проходят — пока не накопится снова.
  //
  // Три настройки, все три — штатные ручки вебпака:
  //   compression: "gzip"      — пакеты на диске сжимаются, восстанавливать
  //                              и разбирать нужно кратно меньше;
  //   maxAge: 3 суток          — вместо месяца, чтобы мёртвые записи
  //                              выпадали, а не ехали дальше;
  //   maxMemoryGenerations: 1  — вебпак освобождает модули из ОЗУ, не
  //                              дожидаясь конца сборки.
  //
  // Дев-сборку не трогаем (`dev === true` выходит сразу): там кеш живёт на
  // одной машине, не восстанавливается ниоткуда и сжатие только замедлит
  // горячую перезагрузку.
  webpack: (config, { dev }) => {
    if (!dev && config.cache && typeof config.cache === "object" && config.cache.type === "filesystem") {
      config.cache.compression = "gzip";
      config.cache.maxAge = 3 * 24 * 60 * 60 * 1000;
      config.cache.maxMemoryGenerations = 1;
    }
    return config;
  },
};

// Run `ANALYZE=true npm run build` to get an interactive treemap of the
// client bundle at .next/analyze/client.html — the tool used to confirm
// the flashcards/idioms/slide-icons content was removed from the client
// bundle (see prisma/schema.prisma FlashcardCard/Idiom comments and
// SlidesTab.tsx). Off by default: it only changes the build when ANALYZE
// is set, so normal builds/deploys are unaffected.
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

// `next typegen` (part of `npm run pretypecheck`) evaluates this config
// under NODE_ENV=production internally, same as a real build — so Serwist
// still emits its Turbopack-incompatibility warning there even though no
// actual dev server is running. Cosmetic only; silence it.
process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING = "1";

// `npm run dev` uses Turbopack; Serwist's compiler is webpack-only and
// `withSerwistInit(...)` unconditionally attaches a `webpack` config
// function to nextConfig (its own `disable` option only skips emitting
// public/sw.js, not that attachment) — which Next 16 refuses to run under
// Turbopack. Rather than force the whole dev server onto webpack (losing
// Turbopack's fast refresh) just for a service worker nothing needs in
// dev, only wrap with Serwist for `next build`/`next start`
// (NODE_ENV=production, set automatically by the Next CLI) and skip it
// entirely otherwise.
const config =
  process.env.NODE_ENV === "production"
    ? withSerwistInit({
        swSrc: "src/app/sw.ts",
        swDest: "public/sw.js",
        // РЕГИСТРАЦИЯ ПРИНАДЛЕЖИТ SerwistRegister.tsx, И ТОЛЬКО ЕМУ.
        //
        // Опция по умолчанию `true`, и это НЕ то же самое, что
        // `register={false}` у <SerwistProvider> в [lang]/layout.tsx: тот
        // флаг гасит вызов внутри React-провайдера, а этот — вебпак-плагин,
        // который подшивает в начало входных чанков `main`/`main-app` свой
        // модуль sw-entry:
        //
        //   window.serwist = new Serwist(origin + "/sw.js", { scope });
        //   if (register && !isCurrentPageOutOfScope(scope))
        //     window.serwist.register();          // <- без .catch()
        //
        // Замерено 02.09.2026 на собранном бандле и в WebKit: в приватном
        // окне Safari `navigator.serviceWorker` существует, а register()
        // отвергает промис с SecurityError «Script …/sw.js load failed» —
        // и этот отказ уходил в окно как НЕОБРАБОТАННЫЙ (Sentry:
        // handled=no, mechanism onunhandledrejection), потому что промис
        // sw-entry никто не ловит. Обработчик в SerwistRegister.tsx при
        // этом отрабатывал: в том же замере рядом стояло его
        // console.warn. То есть ловили мы ВТОРУЮ регистрацию, а в Sentry
        // уходила первая.
        //
        // С `register: false` sw-entry по-прежнему создаёт синглтон
        // window.serwist (провайдер его переиспользует — поведение
        // регистрации не меняется), но сам не регистрирует. Единственный
        // вызов register() остаётся один, и он с обработчиком.
        register: false,
        // public/offline.html isn't reachable through Next's own link graph
        // (it's a static file, not a route), so it needs to be added to the
        // precache list by hand — sw.ts's `fallbacks` config is what
        // actually serves it when a navigation fails offline.
        //
        // ОТПЕЧАТОК СЧИТАЕТСЯ ИЗ САМОГО ФАЙЛА — ЗАХОД 7.227. До 23.09.2026
        // здесь стояла строка `"1"`, которую полагалось поднимать руками.
        // Цена забытой правки — не «неудобство»: у всех, кто уже открывал
        // приложение, остался бы СТАРЫЙ каркас без сети (у Serwist запись
        // precache с прежней ревизией не перезагружается вовсе), и
        // проверить это на своём телефоне нечем — старый экран показался
        // бы только при выключенной сети. Хеш содержимого снимает вопрос:
        // файл изменился — изменилась запись.
        additionalPrecacheEntries: [{ url: "/offline.html", revision: offlineShellRevision() }],
      })(withBundleAnalyzer(nextConfig))
    : withBundleAnalyzer(nextConfig);

// Wraps the build with the Sentry webpack plugin (source map upload +
// automatic instrumentation of route handlers/server components). This
// only actually uploads anything when SENTRY_AUTH_TOKEN/SENTRY_ORG/
// SENTRY_PROJECT are set — without them it logs a warning and skips the
// upload step rather than failing the build, so this is safe to ship
// before a real Sentry project exists.
export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Confirmed working 2026-08-27 (release ec1b880, "Uploaded files to
  // Sentry", 615 files, no errors — checked via `vercel inspect --logs`
  // after briefly flipping this to false to see the plugin's own output).
  // Back to true now that it's verified.
  silent: true,
  // Source maps are uploaded to Sentry directly, not shipped to the
  // client — keeps them out of the public bundle.
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  webpack: { treeshake: { removeDebugLogging: true } },
  // This project's Next dev server already declines Turbopack for the
  // service worker (see the Serwist comment above) — Sentry's tunnel
  // route similarly only matters for production, keep it off in dev.
  tunnelRoute: process.env.NODE_ENV === "production" ? "/monitoring" : undefined,
});
