// БЕЗ СЕТИ ПРИЛОЖЕНИЕ ОБЯЗАНО ОТДАТЬ КАРКАС, А НЕ ТУПИК
// (заход 7.228, ОФЛАЙН-1б, долг 306).
//
// ЧТО ИЗМЕРЕНО. Владелец 23.09.2026, POCO, сборка 1.0.3: приложение
// дважды открыто с Wi-Fi и пройдены четыре раздела; Wi-Fi выключен;
// приложение открыто → нативный экран «No pudimos abrir la aplicación»,
// «Reintentar» → «Todavía no se pudo». Тот же сайт в Chrome на том же
// телефоне без сети открывал и ранее открытые страницы, и каркас
// `public/offline.html` для неоткрытых. То есть сайт и воркер работали, а
// оболочка обрывала дорогу до них.
//
// ПОЧЕМУ ЭТО СТОРОЖ, А НЕ ТОЛЬКО ПРАВКА. Та же причина, что у
// `check:load-watchdog` и `check:network-retry`: ни одна строка
// `MainActivity.java` на этой машине не исполняется (долг 176), а
// единственный прибор — телефон владельца, то есть один замер. Значит
// форму правки обязано держать правило.
//
// ЧТО ПРОВЕРЯЕТСЯ — одиннадцать утверждений.
//
//  1. Клиент webview у оболочки СВОЙ и он наследник `BridgeWebViewClient`
//     (иначе мы потеряли бы и подмешивание моста, и оповещение
//     слушателей, на которых висят заставка и поля экрана).
//  2. Наш ответ идёт ТОЛЬКО после того, как Capacitor вернул `null`:
//     при живой сети ответ обязан оставаться его, вместе с мостом.
//  3. Каркас отдаётся только главному кадру, только GET и только нашему
//     боевому хосту. GET — отдельная строка: `handleProxyRequest`
//     Capacitor'а живёт только для GET и на POST входа в учётную запись
//     возвращает `null` ПРИ ЖИВОЙ СЕТИ.
//  4. Отдаётся именно `public/offline.html` из пакета (`assets.open`),
//     и код ответа 200 с типом `text/html` — иначе webview показал бы
//     свою страницу ошибки поверх нашей.
//  5. Каркас отдаётся ПО ИСХОДНОМУ АДРЕСУ: ни `loadUrl` каркаса, ни
//     `file:///android_asset` в клиенте быть не может. На чужом
//     источнике у каркаса не работают ни его пять вкладок, ни проба
//     `/api/health`, ни правило «нет сети» захода 7.227.
//  6. Есть признак «приложение уже открывалось успешно», и каркас
//     привязан к нему: на первом запуске после установки без сети меню
//     обещало бы то, чего на телефоне нет.
//  7. Каркас при живой сети отдаётся только со ВТОРОЙ попытки: честный
//     404 и честный 500 подменять нельзя.
//  8. Отказ главного кадра больше не заканчивается тупиком Capacitor:
//     `onReceivedError`/`onReceivedHttpError` для главного кадра НЕ зовут
//     `super`, а отдают решение окну, и у окна есть ровно одна повторная
//     навигация.
//  9. Нативный экран `getErrorUrl()` остался последней ступенью.
// 10. Лестница повторов 7.223 считает каркас НЕ настоящей страницей
//     (иначе приложение перестало бы само подниматься при возврате сети),
//     а сторож загрузки каркас не стирает.
// 11. Копия каркаса в `capacitor-shell/` совпадает с `public/offline.html`
//     ПОБАЙТОВО, и кнопка «Повторить» нативного экрана после неудачной
//     пробы делает один настоящий переход.
//
//   node scripts/check-offline-fallback.mjs
//   node scripts/check-offline-fallback.mjs --plant
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { copyFor } from "./sync-offline-shell.mjs";

const CLIENT = "android/app/src/main/java/com/rusofacilapp/app/OfflineShellWebViewClient.java";
const ACTIVITY = "android/app/src/main/java/com/rusofacilapp/app/MainActivity.java";
const SHELL_SOURCE = "public/offline.html";
const SHELL_COPY = "capacitor-shell/offline.html";
const ERROR_SCREEN = "capacitor-shell/error.html";

const FILES = [CLIENT, ACTIVITY, SHELL_SOURCE, SHELL_COPY, ERROR_SCREEN];

const read = (path) => readFileSync(path, "utf8");

/** Комментарии живым кодом не считаются: закомментированная строка уже
 *  трижды проходила за настоящую (7.178, 7.181, 7.223). */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Тело блока по подстроке-сигнатуре: скобки считаются, а не угадываются
 *  по отступу. */
function blockAfter(source, signature) {
  const at = source.indexOf(signature);
  if (at === -1) return null;
  const open = source.indexOf("{", at);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

export function judge(sources) {
  const problems = [];
  const client = stripComments(sources[CLIENT]);
  const activity = stripComments(sources[ACTIVITY]);
  const errorScreen = stripComments(sources[ERROR_SCREEN]);

  // 1. Свой клиент, и именно наследник.
  if (!/class OfflineShellWebViewClient extends BridgeWebViewClient/.test(client)) {
    problems.push(
      `${CLIENT}: клиент webview больше не наследник BridgeWebViewClient — вместе с ним уходят ` +
        `подмешивание моста Capacitor и оповещение слушателей, на которых висят заставка и поля`,
    );
  }
  if (!/setWebViewClient\(\s*\n?\s*new OfflineShellWebViewClient\(/.test(activity)) {
    problems.push(
      `${ACTIVITY}: наш клиент webview не ставится — значит отказ главного кадра снова заканчивается ` +
        `тупиком Capacitor (BridgeWebViewClient.onReceivedError → server.errorPath)`,
    );
  }
  if (!/protected void load\(\)/.test(activity) || !/installOfflineShellClient\(\)/.test(activity)) {
    problems.push(
      `${ACTIVITY}: клиент ставится не в load() — первая же навигация уйдёт со старым клиентом, ` +
        `и каркас на ней не покажется`,
    );
  }

  const intercept = blockAfter(client, "public WebResourceResponse shouldInterceptRequest(");
  if (!intercept) {
    problems.push(`${CLIENT}: shouldInterceptRequest нет вовсе — отдавать каркас нечем`);
  } else {
    // 2. Сначала Capacitor.
    if (!/super\.shouldInterceptRequest\(/.test(intercept)) {
      problems.push(
        `${CLIENT}: наш ответ идёт НЕ после ответа Capacitor — при живой сети мы подменили бы его ` +
          `документ, а вместе с ним пропал бы подмешанный скрипт моста (нет покупки, нет полос)`,
      );
    }
    if (!/if \(answered != null\) \{[\s\S]{0,60}return answered;/.test(intercept)) {
      problems.push(`${CLIENT}: ответ Capacitor не возвращается как есть — живая сеть пошла бы через каркас`);
    }
    // 6+7. Условие каркаса.
    if (!/offlineShellAllowed\(\)/.test(intercept)) {
      problems.push(
        `${CLIENT}: каркас отдаётся без вопроса «есть ли что показывать» — на первом запуске после ` +
          `установки без сети меню обещало бы страницы, которых на телефоне нет`,
      );
    }
  }

  // 3. Только главный кадр, только GET, только наш хост, только html.
  const wants = blockAfter(client, "private boolean wantsSavedDocument(");
  if (!wants) {
    problems.push(`${CLIENT}: wantsSavedDocument нет вовсе — каркас мог бы подменить картинку или скрипт`);
  } else {
    if (!/isForMainFrame\(\)/.test(wants)) {
      problems.push(`${CLIENT}: каркас не ограничен главным кадром — он подменял бы картинки и скрипты страницы`);
    }
    if (!/"GET"\.equalsIgnoreCase\(request\.getMethod\(\)\)/.test(wants)) {
      problems.push(
        `${CLIENT}: каркас не ограничен методом GET. У Capacitor \`handleProxyRequest\` живёт только для ` +
          `GET и на POST (форма входа в учётную запись) возвращает null ПРИ ЖИВОЙ СЕТИ — каркас на месте ` +
          `ответа входа это молчаливая поломка входа`,
      );
    }
    if (!/getServerUrl\(\)/.test(wants) || !/equalsIgnoreCase\(url\.getHost\(\)\)/.test(wants)) {
      problems.push(
        `${CLIENT}: хост запроса не сличается с боевым — \`allowNavigation\` пускает и чужие поддомены, ` +
          `а подменять их ответы мы права не имеем`,
      );
    }
    if (!/acceptsHtml\(request\)/.test(wants)) {
      problems.push(`${CLIENT}: тип запрошенного не проверяется — каркас ушёл бы в ответ на fetch или картинку`);
    }
  }

  // 4. Отдаётся файл из пакета, кодом 200 и как html.
  const response = blockAfter(client, "private WebResourceResponse shellResponse()");
  if (!response) {
    problems.push(`${CLIENT}: shellResponse нет вовсе`);
  } else {
    if (!/assets\.open\(SHELL_ASSET\)/.test(response)) {
      problems.push(`${CLIENT}: каркас берётся не из пакета приложения — без сети взять его больше негде`);
    }
    if (!/"text\/html"/.test(response) || !/200/.test(response)) {
      problems.push(
        `${CLIENT}: ответ каркаса не 200 text/html — webview показал бы поверх него свою страницу ошибки`,
      );
    }
  }
  if (!/SHELL_ASSET\s*=\s*"public\/offline\.html"/.test(client)) {
    problems.push(
      `${CLIENT}: путь каркаса в пакете не \`public/offline.html\` — именно туда \`cap sync\` кладёт ` +
        `содержимое webDir, и другого пути у файла нет`,
    );
  }

  // 5. По ИСХОДНОМУ адресу, а не переходом на чужой источник.
  if (/loadUrl\(/.test(client) || /android_asset/.test(client)) {
    problems.push(
      `${CLIENT}: каркас показывается переходом (loadUrl / file:///android_asset), а не ответом по ` +
        `исходному адресу. На чужом источнике у него не работают ни пять вкладок, ни проба /api/health, ` +
        `ни правило «нет сети» захода 7.227 — то есть это снова тупик, только другой`,
    );
  }

  // 6. Признак «уже открывалось» пишется настоящей страницей.
  if (!/PREF_EVER_LOADED\s*=\s*"/.test(activity)) {
    problems.push(`${ACTIVITY}: признака «приложение уже открывалось успешно» нет — каркасу нечем судить`);
  }
  const remember = blockAfter(activity, "private void rememberSiteLoaded(String url)");
  if (!remember) {
    problems.push(`${ACTIVITY}: rememberSiteLoaded нет вовсе — признак не записывается никогда`);
  } else {
    if (!/putBoolean\(PREF_EVER_LOADED, true\)/.test(remember)) {
      problems.push(`${ACTIVITY}: признак не сохраняется между запусками — после перезапуска каркас пропал бы`);
    }
    if (!/startsWith\(site\)/.test(remember)) {
      problems.push(
        `${ACTIVITY}: признак ставится по любому адресу — его поставил бы и сам экран ошибки, и каркас`,
      );
    }
  }
  const note = blockAfter(activity, "private void noteScreenShown(String url)");
  if (!note || !/rememberSiteLoaded\(url\)/.test(note)) {
    problems.push(
      `${ACTIVITY}: признак «уже открывалось» не ставится по нарисованному кадру настоящей страницы — ` +
        `значит он либо не ставится вовсе, либо ставится наугад`,
    );
  }

  // 7. При живой сети — только со второй попытки.
  const allowed = activity.match(/public boolean offlineShellAllowed\(\)\s*\{([\s\S]*?)\}/);
  if (!allowed) {
    problems.push(`${ACTIVITY}: окно не отвечает на вопрос offlineShellAllowed`);
  } else {
    if (!/siteEverLoaded/.test(allowed[1])) {
      problems.push(`${ACTIVITY}: ответ про каркас не смотрит на признак «уже открывалось»`);
    }
    if (!/mainFrameRetryUsed/.test(allowed[1]) || !/deviceHasNoNetwork\(\)/.test(allowed[1])) {
      problems.push(
        `${ACTIVITY}: каркас отдаётся при живой сети с первой же попытки — так он подменил бы честный ` +
          `404 и честный 500 сервера. Правило: сеть выключена — сразу, сеть жива — только после того, ` +
          `как webview попробовал загрузить адрес сам`,
      );
    }
  }
  const noNetwork = blockAfter(activity, "private boolean deviceHasNoNetwork()");
  if (!noNetwork) {
    problems.push(`${ACTIVITY}: deviceHasNoNetwork нет вовсе`);
  } else if (!/getActiveNetwork\(\)\s*==\s*null/.test(noNetwork)) {
    problems.push(
      `${ACTIVITY}: «нет сети» определяется не состоянием сети телефона — догадка не имеет права ` +
        `подменять настоящий ответ сервера`,
    );
  }

  // 8. Отказ главного кадра решает окно, и повтор ровно один.
  for (const [signature, name] of [
    ["public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error)", "onReceivedError"],
    [
      "public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse)",
      "onReceivedHttpError",
    ],
  ]) {
    const body = blockAfter(client, signature);
    if (!body) {
      problems.push(`${CLIENT}: ${name} не переопределён — отказ главного кадра снова уходит в тупик Capacitor`);
      continue;
    }
    if (!/isForMainFrame\(\)/.test(body) || !/onMainFrameLoadFailed\(/.test(body)) {
      problems.push(
        `${CLIENT}: ${name} не отдаёт отказ главного кадра окну — значит решение опять принимает ` +
          `\`BridgeWebViewClient\`, а он умеет ровно одно: показать server.errorPath`,
      );
    }
  }
  const failure = blockAfter(activity, "private void handleMainFrameFailure(WebView view, String failedUrl)");
  if (!failure) {
    problems.push(`${ACTIVITY}: handleMainFrameFailure нет вовсе — отказ главного кадра никто не разбирает`);
  } else {
    if (!/mainFrameRetryUsed\s*=\s*true/.test(failure) || !/!mainFrameRetryUsed/.test(failure)) {
      problems.push(
        `${ACTIVITY}: повторная навигация не ограничена одной — два отказа подряд это уже не гонка, ` +
          `а петля на выключенной сети`,
      );
    }
    // 9. Нативный экран остался последней ступенью.
    if (!/getErrorUrl\(\)/.test(failure) || !/loadUrl\(errorUrl\)/.test(failure)) {
      problems.push(
        `${ACTIVITY}: нативный экран перестал быть последней ступенью — для первого запуска после ` +
          `установки без сети показать было бы нечего вовсе`,
      );
    }
  }
  // Право на повторную навигацию обязано возвращаться ТАМ, где оболочка
  // увидела настоящую страницу, а не объявлением поля: `= false` в строке
  // объявления пропустило свою подсадку (тот же класс, что 7.223).
  if (!note || !/mainFrameRetryUsed\s*=\s*false/.test(note)) {
    problems.push(
      `${ACTIVITY}: право на повторную навигацию не возвращается по нарисованной настоящей странице — ` +
        `после одного отказа за всё время работы приложения каркас больше не показался бы`,
    );
  }

  // 10. Лестница 7.223 и сторож загрузки знают про каркас.
  if (!note || !/offlineShellVisible/.test(note)) {
    problems.push(
      `${ACTIVITY}: лестница повторов считает каркас настоящей страницей — приложение перестало бы ` +
        `само подниматься, когда сеть вернётся (долг 250, шаг 2)`,
    );
  }
  const onErrorNow = blockAfter(activity, "private boolean onErrorScreenNow()");
  if (!onErrorNow || !/offlineShellVisible/.test(onErrorNow)) {
    problems.push(`${ACTIVITY}: onErrorScreenNow не знает про каркас — повтор над каркасом не заведётся`);
  }
  const watchdog = blockAfter(activity, "pendingCheck = new Runnable()");
  if (!watchdog || !/offlineShellVisible/.test(watchdog)) {
    problems.push(
      `${ACTIVITY}: сторож загрузки стирает каркас нативным экраном — это шаг назад ровно в том месте, ` +
        `которое чинится`,
    );
  }
  const armShell = blockAfter(activity, "private void armOfflineShell()");
  if (!armShell || !/public void onPageStarted\(WebView view\)[\s\S]{0,120}offlineShellVisible\s*=\s*false;/.test(armShell)) {
    problems.push(
      `${ACTIVITY}: признак «на экране каркас» не снимается на начале навигации — настоящая страница ` +
        `считалась бы каркасом до конца работы приложения`,
    );
  }

  // 11. Копия каркаса и кнопка нативного экрана.
  if (sources[SHELL_COPY] !== copyFor(sources[SHELL_SOURCE])) {
    problems.push(
      `${SHELL_COPY} расходится с ${SHELL_SOURCE}. Это ОДИН каркас: сайт берёт его из public/, ` +
        `а пакет приложения — из webDir. Зовите \`npm run sync:offline-shell\``,
    );
  }
  if (!/data-offline-shell="1"/.test(sources[SHELL_SOURCE])) {
    problems.push(`${SHELL_SOURCE}: у каркаса нет признака data-offline-shell — его пробы узнают по нему`);
  }
  if (!/blindTryUsed\(\)/.test(errorScreen) || !/markBlindTry\(\)/.test(errorScreen)) {
    problems.push(
      `${ERROR_SCREEN}: после неудачной пробы кнопка «Повторить» снова не делает НИ ОДНОГО перехода. ` +
        `Проба идёт с https://localhost, где воркера сайта нет вовсе, и без сети падает всегда — ` +
        `именно это владелец видел 23.09.2026 как «Todavía no se pudo»`,
    );
  }

  return problems;
}

export async function main() {
  const sources = Object.fromEntries(FILES.map((f) => [f, read(f)]));

  if (process.argv.includes("--plant")) {
    let ok = judge(sources).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровые исходники (отрицательный контроль)`);

    const plants = [
      ["клиент webview снова чужой — тупик Capacitor вернулся",
        { [ACTIVITY]: sources[ACTIVITY].replace("setWebViewClient(\n            new OfflineShellWebViewClient(", "setWebViewClient(\n            new android.webkit.WebViewClient((") }],
      ["клиент перестал быть наследником BridgeWebViewClient",
        { [CLIENT]: sources[CLIENT].replace("class OfflineShellWebViewClient extends BridgeWebViewClient", "class OfflineShellWebViewClient extends android.webkit.WebViewClient") }],
      ["клиент ставится не в load(), а позже — первая навигация уходит со старым",
        { [ACTIVITY]: sources[ACTIVITY].replace("    protected void load() {", "    protected void неЗагрузка() {") }],
      ["наш каркас отвечает РАНЬШЕ Capacitor — мост пропал бы при живой сети",
        { [CLIENT]: sources[CLIENT].replace("        WebResourceResponse answered = super.shouldInterceptRequest(view, request);", "        WebResourceResponse answered = null;") }],
      ["ответ Capacitor перестал возвращаться как есть",
        { [CLIENT]: sources[CLIENT].replace("        if (answered != null) {\n            return answered;\n        }", "") }],
      ["каркас отдаётся без вопроса «есть ли что показывать»",
        { [CLIENT]: sources[CLIENT].replace("        if (!host.offlineShellAllowed()) {\n            return null;\n        }", "") }],
      ["каркас перестал быть ограничен главным кадром",
        { [CLIENT]: sources[CLIENT].replace("if (request == null || !request.isForMainFrame()) {", "if (request == null) {") }],
      ["каркас перестал быть ограничен методом GET — форма входа сломалась бы молча",
        { [CLIENT]: sources[CLIENT].replace('        if (!"GET".equalsIgnoreCase(request.getMethod())) {\n            return false;\n        }', "") }],
      ["хост запроса больше не сличается с боевым",
        { [CLIENT]: sources[CLIENT].replace("if (serverHost == null || !serverHost.equalsIgnoreCase(url.getHost())) {", "if (serverHost == null) {") }],
      ["тип запрошенного больше не проверяется — каркас ушёл бы в ответ на fetch",
        { [CLIENT]: sources[CLIENT].replace("        return acceptsHtml(request);", "        return true;") }],
      ["каркас берётся не из пакета приложения",
        { [CLIENT]: sources[CLIENT].replace("assets.open(SHELL_ASSET)", "новыйПоток()") }],
      ["путь каркаса в пакете перестал быть public/offline.html",
        { [CLIENT]: sources[CLIENT].replace('SHELL_ASSET = "public/offline.html"', 'SHELL_ASSET = "public/error.html"') }],
      ["каркас показывается переходом на чужой источник, а не ответом по исходному адресу",
        { [CLIENT]: sources[CLIENT].replace("        host.onOfflineShellServed();\n        return shell;", '        view.loadUrl("file:///android_asset/public/offline.html");\n        return shell;') }],
      ["признак «уже открывалось» убран целиком",
        { [ACTIVITY]: sources[ACTIVITY].replace('PREF_EVER_LOADED = "everLoadedSite"', 'НЕ_ПРИЗНАК = "everLoadedSite"') }],
      ["признак не переживает перезапуск приложения",
        { [ACTIVITY]: sources[ACTIVITY].replace("putBoolean(PREF_EVER_LOADED, true)", "putBoolean(PREF_EVER_LOADED + \":нет\", true)") }],
      ["признак ставится по любому адресу — его поставил бы и сам экран ошибки",
        { [ACTIVITY]: sources[ACTIVITY].replace("if (site == null || !url.startsWith(site)) {", "if (site == null) {") }],
      ["признак не ставится по нарисованной настоящей странице",
        { [ACTIVITY]: sources[ACTIVITY].replace("        rememberSiteLoaded(url);\n    }", "    }") }],
      ["каркас отдаётся при живой сети с первой попытки — подменил бы честный 404",
        { [ACTIVITY]: sources[ACTIVITY].replace("return siteEverLoaded && (mainFrameRetryUsed || deviceHasNoNetwork());", "return siteEverLoaded;") }],
      ["«нет сети» определяется не состоянием сети телефона",
        { [ACTIVITY]: sources[ACTIVITY].replace("return ((ConnectivityManager) service).getActiveNetwork() == null;", "return true;") }],
      ["onReceivedError снова отдан Capacitor — тупик вернулся",
        { [CLIENT]: sources[CLIENT].replace("        if (request != null && request.isForMainFrame()) {\n            host.onMainFrameLoadFailed(view, urlOf(request));\n            return;\n        }\n        super.onReceivedError(view, request, error);", "        super.onReceivedError(view, request, error);") }],
      ["onReceivedHttpError снова отдан Capacitor",
        { [CLIENT]: sources[CLIENT].replace("        if (request != null && request.isForMainFrame()) {\n            host.onMainFrameLoadFailed(view, urlOf(request));\n            return;\n        }\n        super.onReceivedHttpError(view, request, errorResponse);", "        super.onReceivedHttpError(view, request, errorResponse);") }],
      ["повторная навигация перестала быть одной — петля на выключенной сети",
        { [ACTIVITY]: sources[ACTIVITY].replace("            && !mainFrameRetryUsed\n", "") }],
      ["нативный экран перестал быть последней ступенью",
        { [ACTIVITY]: sources[ACTIVITY].replace("        if (errorUrl != null) {\n            view.loadUrl(errorUrl);\n        }", "") }],
      ["право на повторную навигацию нигде не возвращается",
        { [ACTIVITY]: sources[ACTIVITY].replace("        mainFrameRetryUsed = false;\n", "") }],
      ["лестница повторов считает каркас настоящей страницей",
        { [ACTIVITY]: sources[ACTIVITY].replace("if (isErrorScreen(url) || offlineShellVisible) {", "if (isErrorScreen(url)) {") }],
      ["onErrorScreenNow не знает про каркас",
        { [ACTIVITY]: sources[ACTIVITY].replace("        if (offlineShellVisible) {\n            return true;\n        }", "") }],
      ["сторож загрузки стирает каркас нативным экраном",
        { [ACTIVITY]: sources[ACTIVITY].replace("                if (offlineShellVisible) {\n                    return;\n                }", "") }],
      ["признак «на экране каркас» не снимается на начале навигации",
        { [ACTIVITY]: sources[ACTIVITY].replace("                offlineShellVisible = false;", "                offlineShellVisible = offlineShellVisible;") }],
      ["копия каркаса разошлась с public/offline.html",
        { [SHELL_COPY]: sources[SHELL_COPY].replace("Estás sin conexión", "Sin internet") }],
      ["у каркаса убрали признак data-offline-shell",
        { [SHELL_SOURCE]: sources[SHELL_SOURCE].replace('data-offline-shell="1"', 'data-нет="1"') }],
      ["кнопка нативного экрана снова не делает ни одного перехода после неудачной пробы",
        { [ERROR_SCREEN]: sources[ERROR_SCREEN].replace(/blindTryUsed\(\)/g, "неПопытка()").replace(/markBlindTry\(\)/g, "неОтметка()") }],
    ];

    let caught = 0;
    for (const [name, patch] of plants) {
      const key = Object.keys(patch)[0];
      if (patch[key] === sources[key]) {
        console.log(`  ПОДСАДКА НЕ СРАБОТАЛА (текст не изменился) — ${name}`);
        continue;
      }
      const found = judge({ ...sources, ...patch });
      const hit = found.length > 0;
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}${hit ? ` (${found[0].slice(0, 110)})` : ""}`);
    }
    ok &&= caught === plants.length;
    console.log(
      ok
        ? `check:offline-fallback --plant — ${caught} из ${plants.length} подсадок, 1 из 1 отрицательный контроль`
        : `check:offline-fallback --plant — FAILED (${caught} из ${plants.length})`,
    );
    return ok ? 0 : 1;
  }

  const problems = judge(sources);
  if (problems.length) {
    console.error("КАРКАС БЕЗ СЕТИ ВНУТРИ ПРИЛОЖЕНИЯ (заход 7.228, долг 306):");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(
    "check:offline-fallback — свой клиент webview стоит в load() и наследует BridgeWebViewClient; каркас " +
      "отдаётся ТОЛЬКО после отказа Capacitor, только главному кадру, только GET, только боевому хосту и " +
      "только тому, кто просит text/html; берётся из пакета (public/offline.html) ответом 200 по ИСХОДНОМУ " +
      "адресу; при живой сети — со второй попытки, при выключенной сети — сразу; нативный экран остался " +
      "последней ступенью; лестница повторов и сторож загрузки каркас узнают; копия в capacitor-shell " +
      "побайтово равна public/offline.html. Контроль — --plant.",
  );
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
