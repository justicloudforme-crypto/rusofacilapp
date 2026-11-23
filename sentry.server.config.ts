import * as Sentry from "@sentry/nextjs";
import { mayReportServerSentry } from "./src/lib/deploy-environment";
import { scrubTokensFromEvent } from "./src/lib/scrub-token";
import { tagShellOnEvent, userAgentFromSentryEvent } from "./src/lib/shell-tag";

// True only on a real Vercel server: VERCEL_ENV + VERCEL=1 + Linux (the
// OS of this very process, not a variable). Gating on this (not NODE_ENV,
// and not VERCEL_ENV alone) is what stops a local `next start` — even one
// started with VERCEL_ENV=preview typed by hand (debt 416, 7.286) — from
// filing events into the live project. See src/lib/deploy-environment.ts.
const isDeployed = mayReportServerSentry();
// NOTE: `environment` is deliberately NOT set here. On Vercel the SDK
// derives it itself as "vercel-production" / "vercel-preview" — verified
// against the live site, whose HTML carries
// `sentry-environment=vercel-production` in its baggage meta tag. Setting
// it explicitly to VERCEL_ENV would rename the environment to
// "production" and split the project's history in two. Off Vercel the SDK
// would fall back to NODE_ENV, but nothing is sent there at all, so the
// value is moot.


// Runs in Node.js server contexts (route handlers, server components,
// server actions). Plain SENTRY_DSN here, not the NEXT_PUBLIC_ variant —
// server code never ships to the client bundle, so no need to expose it.
Sentry.init({
  // DSN withheld entirely off-Vercel, belt and braces with `enabled`.
  // An EMPTY STRING, not `undefined` (7.301, debt 416): the Node SDK fills
  // an undefined dsn from process.env.SENTRY_DSN itself
  // (@sentry/node-core sdk/index.js: `options.dsn ?? process.env.SENTRY_DSN`),
  // so `undefined` withheld nothing and only `enabled` stood. With "" the
  // address never reaches the SDK — and the page's baggage carries no
  // `sentry-public_key`, which is how check:sentry-vercel-only and the
  // post-deploy check tell "Sentry is on" from the outside.
  dsn: isDeployed ? process.env.SENTRY_DSN : "",
  enabled: isDeployed,
  tracesSampleRate: 0.1,
  debug: false,
  // ДОЛГ 164. Фрагмент на сервер не уезжает вовсе, так что здесь эта
  // стена стоит не против него, а против ЛЮБОГО другого адреса с
  // токеном, который когда-нибудь напишут: `?token=` в серверном
  // событии — это и журнал, и `Referer`, и ссылка в крошке.
  // ДОЛГ 174. Та же метка, что в браузерном конфиге, только User-Agent
  // берётся не из `navigator`, которого здесь нет, а из заголовков
  // запроса в самом событии — их кладёт туда штатная интеграция
  // requestData. Серверная половина нужна не для симметрии: ошибка
  // серверного компонента или маршрута API, случившаяся при запросе ИЗ
  // оболочки, иначе тоже выглядела бы вебом.
  beforeSend: (event) => tagShellOnEvent(scrubTokensFromEvent(event), userAgentFromSentryEvent(event)),
});
