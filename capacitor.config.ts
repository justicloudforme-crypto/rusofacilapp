import type { CapacitorConfig } from "@capacitor/cli";

// RusoFácilapp runs server components, API routes, a DB, cookie auth, and
// Stripe — it cannot be statically exported (`output: "export"` would break
// all of that). Capacitor instead wraps a REMOTE URL in a native WebView
// (a standard, documented Capacitor mode, not a workaround): the app is a
// thin native shell that loads the real Next.js server, same as opening it
// in a browser tab but with native chrome (splash screen, status bar) and
// access to native APIs.
//
// АДРЕС ПО УМОЛЧАНИЮ — БОЕВОЙ, И ЭТО ПРАВКА 09.09.2026 (долг 109).
// До неё здесь по умолчанию стоял `http://192.168.1.69:3000` — адрес
// ноутбука разработчика, — и он доезжал НЕ ТОЛЬКО до отладочной сборки.
// Замерено на собранном артефакте, а не предположено: в
// `app-release-unsigned.apk` от 09.09.2026 внутри `assets/capacitor.config.json`
// лежал `"url": "http://192.168.1.69:3000"`, `"cleartext": true`, а в
// скомпилированном манифесте — `usesCleartextTraffic=true`. То есть
// релизный пакет, собранный «как есть», ушёл бы в Play Console с адресом
// чужой домашней сети внутри и с отключённой защитой транспорта.
//
// Теперь молчаливое значение — прод по HTTPS. Локальный живой перезапуск
// стал ЯВНЫМ режимом: он требует ДВУХ переменных окружения сразу, а не
// одной, и ни одна из них в репозитории не записана:
//
//   CAPACITOR_LIVE_RELOAD=1 CAPACITOR_SERVER_URL=http://192.168.1.69:3000 npx cap sync android
//
// Одной `CAPACITOR_SERVER_URL` с адресом `http://` или частной сети мало —
// конфиг в этом случае БРОСАЕТ, а не «предупреждает»: `cap sync` падает и
// APK с таким адресом внутри просто не собирается. Забыть снять флаг
// перед релизной сборкой можно, поэтому есть и вторая линия —
// `npm run check:native-release-safety`, который читает СОБРАННЫЙ
// релизный APK, а не этот файл.
const PRODUCTION_URL = "https://rusofacilapp.com";

/** Частная сеть или сам хост: 10/8, 172.16/12, 192.168/16, 127/8,
 *  169.254/16, `localhost` и `*.local`. Адрес из такого множества внутри
 *  магазинного пакета — это не «неудобство», а неработающее приложение у
 *  каждого, кто его скачал. Ровно этот же список читает сторож
 *  `scripts/check-native-release-safety.mjs`; он там объявлен ещё раз
 *  намеренно — сторож обязан уметь судить о пакете, ничего не импортируя
 *  из проверяемого файла. */
function isPrivateHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".local")) return true;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function resolveServerUrl(): string {
  const requested = process.env.CAPACITOR_SERVER_URL;
  if (!requested) return PRODUCTION_URL;

  let parsed: URL;
  try {
    parsed = new URL(requested);
  } catch {
    throw new Error(`CAPACITOR_SERVER_URL не разбирается как адрес: ${requested}`);
  }

  const unsafe = parsed.protocol !== "https:" || isPrivateHost(parsed.hostname);
  if (unsafe && process.env.CAPACITOR_LIVE_RELOAD !== "1") {
    throw new Error(
      `CAPACITOR_SERVER_URL=${requested} — не HTTPS и/или адрес частной сети. ` +
        "Такой адрес разрешён ТОЛЬКО в явном режиме живого перезапуска: " +
        "поставьте рядом CAPACITOR_LIVE_RELOAD=1. Собранный с ним пакет в " +
        "магазин не годится — см. npm run check:native-release-safety.",
    );
  }
  return requested;
}

const serverUrl = resolveServerUrl();
const isCleartext = serverUrl.startsWith("http://");

// Токен, по которому СЕРВЕР узнаёт нативную оболочку (долг 79, заход
// 7.183). Оболочка грузит боевой адрес удалённо, то есть запрашивает те
// же страницы, что и браузер, и до 12.09.2026 сервер не мог их отличить
// вовсе: замер 7.180 показал, что `/es/pricing` под User-Agent мобильного
// Safari отдавала те же ТРИ формы `action="/api/checkout"`. Теперь
// оболочка дописывает этот токен к своему User-Agent, и страница цен
// внутри приложения отрисовывается нативной витриной, а веб-касса в её
// ответе не появляется вовсе.
//
// Литерал, а не импорт из `src/lib/native-shell.ts`, по той же причине,
// по которой литералами написаны `appId` и `appName` ниже: сторож
// `npm run check:native-payments` читает ОБА файла текстом и сличает их
// между собой, ничего не импортируя из проверяемого.
const NATIVE_USER_AGENT_TOKEN = "RusoFacilappNative";

const config: CapacitorConfig = {
  // Reverse-domain of the now-confirmed production domain (rusofacilapp.com,
  // purchased 2026-08-16) — set for real, not a placeholder anymore. Still
  // change-before-first-publish territory in principle, but this is now the
  // actual intended identifier, not a stand-in.
  appId: "com.rusofacilapp.app",
  // Витринное имя, НЕ бренд сайта: под иконкой стоит «RusoFácil»
  // (решение владельца 09.09.2026, долг 70 «б»). Литерал, а не импорт из
  // src/lib/brand.ts, по той же причине, что и appId выше: сторожа
  // check:brand и check:app-id читают этот файл текстом. Сличается с
  // APP_DISPLAY_NAME сторожем npm run check:brand.
  appName: "RusoFácil",
  // Required by the Capacitor CLI schema (and `cap doctor`, which errors
  // on a missing index.html) even though nothing here is ever actually
  // served — server.url below is what really loads. Points at a tiny
  // placeholder dir rather than Next's public/, so `cap sync` doesn't
  // copy the whole public/ tree (audio, icons, etc.) into ios//android/
  // for no reason.
  webDir: "capacitor-shell",
  // Дописывается к User-Agent webview на обеих платформах — см. комментарий
  // к NATIVE_USER_AGENT_TOKEN выше. Именно `appendUserAgent`, а не
  // `overrideUserAgent`: подменять строку целиком значило бы потерять всё,
  // по чему сайт узнаёт платформу и движок.
  appendUserAgent: NATIVE_USER_AGENT_TOKEN,
  server: {
    url: serverUrl,
    // Только в явном режиме живого перезапуска: молчаливое значение —
    // HTTPS, и тогда здесь false.
    cleartext: isCleartext,
    // Without an explicit allowlist, Capacitor's WebViewClient can decide
    // a same-app navigation (e.g. the 303 redirect /api/auth/login issues
    // after a successful login/register) isn't "internal" and hand it to
    // the system browser instead of keeping it in the WebView — a real
    // device report on Android specifically. Both the LAN dev host and
    // the eventual production domain are listed so this doesn't need to
    // change again at the CAPACITOR_SERVER_URL production switch
    // described above.
    // Дубль убирается: в молчаливом режиме хост server.url и есть
    // боевой домен, и без Set список печатался бы дважды.
    allowNavigation: [...new Set([new URL(serverUrl).hostname, "rusofacilapp.com", "*.rusofacilapp.com"])],
    // A remote-URL Capacitor app has one native-only failure mode a
    // regular website never does: the very first request, before a
    // single byte of the real Next.js app (or its OfflineBanner
    // component) has loaded. With no device connection or an
    // unreachable server.url, the WebView would otherwise show a bare
    // native browser error page — this local, dependency-free file
    // (capacitor-shell/error.html) replaces that with something branded
    // and gives the user a Retry button. Resolved relative to webDir.
    errorPath: "error.html",
  },
  plugins: {
    // Keep the native splash (resources/splash.png, brand gradient) up
    // until the remote page has actually painted, instead of Capacitor's
    // default ~500ms timer — a slow LAN/dev-server load would otherwise
    // flash to a blank WebView before content arrives. The page itself
    // must call SplashScreen.hide() once ready if this is set to false;
    // autoHide keeps it simple for now since there's no native entry code
    // in this remote-URL setup to call that from.
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#2d5f8a",
      androidSplashResourceName: "splash",
    },
    // Style.Light = dark text/icons, for a light background — matches the
    // site's default light theme (Navbar's bg-background/80 sits under the
    // status bar). Style naming is inverted from what it sounds like: see
    // @capacitor/status-bar's Style enum doc comments.
    StatusBar: {
      style: "LIGHT",
    },
  },
};

export default config;
