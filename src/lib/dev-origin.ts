/**
 * АДРЕС РАЗРАБОТКИ НЕ ОТЧИТЫВАЕТСЯ В БОЕВОЙ SENTRY.
 *
 * ЧТО ИЗМЕРЕНО 20.09.2026 (заход 7.219). Sentry `JAVASCRIPT-NEXTJS-8`:
 * TypeError «Script http://localhost:3100/sw.js load failed» (порт 3100 —
 * стенд e2e), маршрут
 * `/:lang`, 2 события, окружение `vercel-production`. Первая версия
 * причины — «адрес разработки утёк в боевую сборку» — ОПРОВЕРГНУТА
 * замером по собранным артефактам: в `.next/static` и `public` совпадений
 * вида `localhost:ПОРТ` / `127.0.0.1:ПОРТ` — **ноль**; единственное место,
 * где в выводе сборки вообще встречается `localhost:3100`, — серверные
 * карты кода `*.js.map`, и там это ПРОЗА комментария
 * `src/lib/deploy-environment.ts`, а не код. Карты браузеру не отдаются и
 * на Vercel удаляются после выгрузки (`deleteSourcemapsAfterUpload`).
 *
 * Значит адрес в событии — это адрес, С КОТОРОГО ОТДАВАЛАСЬ СТРАНИЦА:
 * локальный прогон на порту 3100 (это порт стенда e2e, `playwright.config.ts`).
 * Ровно этот класс уже случался 28.08.2026 — 20 конвертов из `next start`
 * на ноутбуке ушли в боевой проект (см. `src/lib/deploy-environment.ts`) —
 * и был закрыт воротами `NEXT_PUBLIC_DEPLOY_ENV` (`0e1f7a5`).
 *
 * ПОЧЕМУ ВОРОТ МАЛО, И ЭТО ТОЖЕ ИЗМЕРЕНО. Метку окружения клиентский SDK
 * берёт из `NEXT_PUBLIC_VERCEL_ENV`
 * (`node_modules/@sentry/nextjs/build/cjs/common/getVercelEnv.js`:
 * «vercelEnvVar ? vercel-<значение> : undefined»), то есть строка
 * `vercel-production` ЗАШИВАЕТСЯ СБОРКОЙ. Одна переменная в локальном
 * `.env` — `VERCEL_ENV` или `NEXT_PUBLIC_VERCEL_ENV` — и локальная сборка
 * снова выглядит как боевая: ворота откроются, метка встанет боевая.
 * `vercel env pull` умеет записать обе, если в проекте включена выдача
 * системных переменных. `src/lib/deploy-environment.ts` называет эту дыру
 * прямым текстом и просит её не открывать — но просьба это не сторож.
 *
 * ПОЭТОМУ ЗДЕСЬ ВТОРАЯ СТЕНА, И ОНА НЕ ЗАВИСИТ НИ ОТ ОДНОЙ ПЕРЕМЕННОЙ:
 * судится хост, с которого страница реально отдана. Никакая переменная
 * окружения не сделает `localhost` боевым доменом.
 *
 * Список хостов тот же, что у `isPrivateHost` в `capacitor.config.ts` и у
 * `scripts/check-native-release-safety.mjs`. Объявлен здесь ЗАНОВО
 * намеренно: этот модуль уезжает в браузерный бандл, а те два — нет.
 */

/** Хост, с которого страница может быть отдана только на машине разработчика. */
export function isDevelopmentHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const bare = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (bare === "") return false;
  if (bare === "localhost" || bare.endsWith(".localhost")) return true;
  if (bare.endsWith(".local")) return true;
  if (bare === "::1" || bare === "0:0:0:0:0:0:0:1") return true;
  const m = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/**
 * Можно ли этой странице отчитываться в боевой проект наблюдения.
 *
 * `deployEnv` — то, что сборка зашила в `NEXT_PUBLIC_DEPLOY_ENV`; `host` —
 * `location.hostname` в момент загрузки. Нужны ОБА: первое отсекает
 * сборки не с Vercel, второе — боевую сборку, запущенную не там.
 */
export function mayReportToProductionSentry(
  deployEnv: string | undefined,
  host: string | null | undefined,
): boolean {
  if (!deployEnv) return false;
  return !isDevelopmentHost(host);
}
