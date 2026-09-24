import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The JSON report is not a nicety: scripts/check-e2e-coverage.mjs reads it
  // to answer "how many tests did this run actually execute, and did any of
  // them skip?" — the question nobody was asking on 30.08.2026, when CI ran
  // 25 of 49 and reported green (PROGRESS.md 7.52). The HTML report stays
  // for humans.
  reporter: [["html"], ["json", { outputFile: "playwright-report/results.json" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // The mic permission the bench's fake microphone is asked for,
        // plus Chromium's own fake capture device as a belt-and-braces
        // second layer. Note what these flags are NOT: the bench replaces
        // getUserMedia itself, in every engine, so the fake microphone has
        // never depended on them — which is why the WebKit projects worked
        // locally without them and why they were not the cause of the CI
        // failure of 30.08.2026 either.
        permissions: ["microphone"],
        launchOptions: {
          args: [
            "--use-fake-device-for-media-capture",
            "--use-fake-ui-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
      },
    },
    {
      name: "mobile-iphone",
      use: { ...devices["iPhone 13"] },
      /**
       * Проба квот воркера здесь не собирается вовсе — и это замер, а не
       * удобство. Прогон 19.09.2026: из 12 обойдённых адресов в кеше
       * документов оказалось 2, ещё один лёг в всеохватный `others`, и
       * расширение условия до `request.destination === "document"` не
       * поменяло ни одного числа. WebKit под Playwright навигации воркеру
       * отдаёт не так — та же ненадёжность, что описана в
       * `e2e/offline.spec.ts` с августа. Не `test.skip` внутри спеки:
       * пропуск в отчёте роняет прогон по правилу `check:e2e-coverage`,
       * и роняет правильно.
       */
      /**
       * `offline-shell.spec.ts` добавлен сюда 23.09.2026 (заход 7.227) по
       * замеру, а не по подозрению: на этом проекте из трёх его тестов
       * падают ДВА — те, что трогают навигацию без сети. Движок под
       * Playwright не доводит её до воркера, и мерить здесь пришлось бы
       * Playwright, а не продукт. Тот же класс, что у трёх проб выше.
       */
      /**
       * `offline-saved-content.spec.ts` добавлен сюда 24.09.2026 (заход
       * 7.229) по замеру, а не по подозрению: из четырёх его тестов на
       * этом проекте падают ДВА — оба те, что трогают навигацию без
       * сети. Причина та же, по которой здесь уже нет `offline-shell`:
       * WebKit под Playwright навигацию при `setOffline(true)` до
       * документа не доводит, и мерить пришлось бы Playwright, а не
       * продукт. Два теста, которые сети НЕ выключают (правило
       * «закрытое не сохраняется» и геометрия каркаса), вынесены в
       * отдельный файл `offline-content-access.spec.ts` и идут на ОБОИХ
       * движках: терять их вместе с остальными было бы не за что.
       */
      /**
       * `offline-app-saved.spec.ts` добавлен сюда 25.09.2026 (заход
       * 7.230) по замеру: из четырёх его тестов на этом проекте падают
       * ТРИ — все, кроме самопроверки прибора. Причины две, и обе
       * измерены, а не предположены. Первая — та же, что у соседей:
       * WebKit под Playwright навигацию при `setOffline(true)` до
       * документа не доводит. Вторая — эта проба ходит КЛИКОМ по
       * ссылкам нижней панели (в этом её весь смысл: в приложении
       * человек ходит клиентским роутером, а не полной навигацией), а в
       * мобильной раме ссылка каталога скрыта другой вёрсткой, и первый
       * же клик ждёт видимости 546 раз подряд. Мерить пришлось бы
       * вёрстку панели, а не сохранение страниц. Исключается ВЕСЬ файл,
       * включая самопроверку прибора «до/после»: она браузера не
       * трогает вовсе, и гонять её вторым движком было бы нечем
       * оправдать — на chromium она идёт каждым прогоном.
       */
      testIgnore: /(sw-cache-budget|sw-audio-replay|sw-offline-screen|offline-shell|offline-saved-content|offline-app-saved)\.spec\.ts/,
    },
    /**
     * The voice-recording cycle "in the shape of iOS": WebKit, an iPhone
     * viewport, and a recorder that refuses every WebM type the way real
     * iOS Safari refuses it — which Playwright's WebKit does NOT do on its
     * own (it claims WebM support iOS has never had; PROGRESS.md 7.47).
     * With WebM off the table the app's own picker has to fall through to
     * audio/mp4, the format an iPhone actually produces.
     *
     * The recorder here is SUBSTITUTED by the bench in
     * e2e/helpers/voice-harness.ts, because Playwright's Linux WebKit has
     * no MediaRecorder at all — that is what turned CI red on 30.08.2026.
     * So this project measures the application's logic, and the run with a
     * real encoder is the chromium one.
     *
     * It is a shape, not a device. Debt 22 stays open until the owner
     * opens a lesson on a real iPhone — see PROGRESS.md 7.49.
     */
    {
      name: "voice-ios-shape",
      testMatch: /voice-recording-local\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
        contextOptions: {
          // The lesson page's own recorder asks for the mic; the fake
          // microphone in the spec answers, but WebKit still checks the
          // permission first.
          permissions: ["microphone"],
        },
      },
    },
  ],
  // Reuses a server already running on PORT during local dev; CI always
  // starts a fresh production build so tests exercise real prod output
  // (matches how the PWA/service-worker features actually behave).
  webServer: {
    command: `next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Arms /api/test/grant-subscription (see e2e/helpers/auth.ts) — never
    // set on a real deployment, only here, so that route 404s everywhere
    // except a server this config itself started. `next start` always
    // forces NODE_ENV=production regardless of how the build was made, so
    // a NODE_ENV check can't distinguish "real prod" from "e2e run
    // against a prod build" the way it can for `next dev`.
    env: {
      E2E_TEST_SEED: "1",
      // A fixed rate table, so the browser tests quote a number this repo
      // chose rather than whatever the currency market did this morning —
      // and so the e2e run never reaches open.er-api.com at all. The three
      // values are the real mid-market rates of 08.09.2026; the SGD one is
      // there because the owner measured a live Stripe checkout through a
      // Singapore exit that day (11.70 SGD for the 150 MXN plan), which is
      // what e2e/pricing-local-estimate.spec.ts reproduces on the page.
      // See src/lib/exchange-rates.ts.
      //
      // BRL is deliberately NOT here, and its absence is load-bearing:
      // Brazil is in the allowlist, so a BR request asks for a rate and
      // gets none — the same null every failure path of the feed returns
      // (refusal, timeout, bad JSON, a missing currency). That is how
      // e2e/pricing-local-estimate.spec.ts exercises a dead source through
      // a real render without stubbing anything (PROGRESS.md 7.120).
      FX_RATES_MXN: JSON.stringify({ SGD: 0.074971, ARS: 89.221548, EUR: 0.050958 }),
    },
  },
});
