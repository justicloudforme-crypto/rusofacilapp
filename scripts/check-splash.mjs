/**
 * ЗАСТАВКА ЕСТЬ, ОНА ФИРМЕННАЯ, И УХОДИТ ОНА ПО СОБЫТИЮ, А НЕ ПО ТАЙМЕРУ.
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО
 * ====================================================================
 *
 * Замер владельца 15.09.2026, снят покадрово на POCO X6 Pro (Android 16):
 * от нажатия на иконку до первой картинки 5,9 с, и всё это время экран
 * пустой и светлый — ни знака, ни фирменного фона, ни полосы загрузки.
 *
 * Причин оказалось две, и ни одну из них не видно из кода приложения:
 *
 *   1. ТЕМА ЗАПУСКА. `values/styles.xml` ставил ровно одно свойство,
 *      `android:background="@drawable/splash"`, а системная заставка
 *      Android 12+ читает не его, а `windowSplashScreenBackground` и
 *      `windowSplashScreenAnimatedIcon`. Их не было ни одного.
 *   2. ТАЙМЕР. `launchShowDuration: 1500` в `capacitor.config.ts` — это
 *      срок, а не событие: заставка уходила через полторы секунды, а
 *      страница приходила через шесть.
 *
 * Обе — ровно тот класс отказа, что и долг 177 (дефолтная иконка
 * Capacitor в пакете): собирается молча, выглядит настроенным, а на
 * экране телефона нет ничего.
 *
 * ====================================================================
 * ЧТО ИМЕННО СТЕРЕЖЁТСЯ
 * ====================================================================
 *
 *   * тема запуска называет ОБА свойства Android 12+ и `postSplashScreenTheme`;
 *   * заставка в запуске принадлежит оболочке, а не плагину по таймеру
 *     (`launchShowDuration: 0`);
 *   * `MainActivity` держит заставку УСЛОВИЕМ и отпускает её по событию
 *     готовности страницы, и у неё есть предохранитель — иначе человек
 *     остался бы наедине с логотипом навсегда;
 *   * предохранитель заставки и срок сторожа загрузки — ОДНО число;
 *   * цвет фона записан в трёх местах и во всех трёх одинаков;
 *   * картинки заставки совпадают с эталоном из `resources/icon.png`,
 *     то есть дефолт Capacitor в пакет не вернулся.
 *
 * ====================================================================
 * ЧТО ДОБАВЛЕНО 15.09.2026 (заход 7.198, часть 4)
 * ====================================================================
 *
 * Замер владельца на ТОЙ ЖЕ сборке 7.197, два запуска покадрово:
 * с иконки — синий фон и матрёшка с первого кадра; кнопкой «Открыть» из
 * установщика сразу после установки — синий фон и НИ ОДНОГО кадра со
 * знаком, 4,2 с сплошного цвета.
 *
 * Фон при этом БЫЛ фирменный. Этот цвет в приложении существует ровно в
 * одном месте — `windowSplashScreenBackground` темы запуска, — значит
 * тема применена, и применена та самая: активность в манифесте одна и
 * `intent-filter` у неё один. То есть обе версии «тема не применилась» и
 * «тема не та» опровергнуты самим кадром.
 *
 * Остаётся стиль системной заставки, который запрашивает ВЫЗЫВАЮЩЕЕ
 * приложение (`SPLASH_SCREEN_STYLE_EMPTY`): фон темы без значка. Так
 * запускает установщик и так запускает Play Store. Нашей темой это не
 * чинится вовсе — поэтому знак рисует САМА активность своим слоем, и
 * сторож ниже требует ровно этого: слой есть, он фирменного цвета, знак
 * в нём тот же `@drawable/splash_icon` и поле у него те же 288dp, что у
 * системной заставки.
 *
 *   node scripts/check-splash.mjs
 *   node scripts/check-splash.mjs --plant
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { buildSplash, splashBackgroundHex, SPLASH_ICON_DP } from "./store-assets/generate-splash.mjs";

const STYLES = "android/app/src/main/res/values/styles.xml";
const COLORS = "android/app/src/main/res/values/colors.xml";
const ACTIVITY = "android/app/src/main/java/com/rusofacilapp/app/MainActivity.java";
const CONFIG = "capacitor.config.ts";
// ДОЛГ 83 (7.217): манифест собирается `src/lib/pwa-manifest.ts` и
// зависит от локали, а `src/app/manifest.ts` больше нет — соглашение Next
// само вставляло `<link rel="manifest">` и побеждало `metadata.manifest`
// из раскладки, поэтому корневой адрес отдаётся обычным маршрутом.
// Здесь читается ИСТОЧНИК цвета, а он теперь один на оба адреса.
const MANIFEST = "src/lib/pwa-manifest.ts";

const read = (path) => readFileSync(path, "utf8");

/** Судит ТЕКСТЫ, а не диск: подсадка подменяет их по одному. */
export function judge(sources) {
  const problems = [];
  const styles = sources[STYLES];
  const colors = sources[COLORS];
  const activity = sources[ACTIVITY];
  const config = sources[CONFIG];
  const manifest = sources[MANIFEST];

  // 1. Тема запуска: три свойства, и каждое — своя половина дефекта.
  for (const attr of [
    "windowSplashScreenBackground",
    "windowSplashScreenAnimatedIcon",
    "postSplashScreenTheme",
  ]) {
    if (!new RegExp(`<item\\s+name="${attr}"`).test(styles)) {
      problems.push(`${STYLES}: тема запуска не называет «${attr}» — на Android 12+ заставки не будет`);
    }
  }
  // Написание с префиксом `android:` собирается молча и работает только
  // с Android 12 — то есть ровно мимо обратной совместимости, ради
  // которой библиотека и подключена.
  if (/<item\s+name="android:windowSplashScreen/.test(styles)) {
    problems.push(`${STYLES}: свойство заставки написано с префиксом «android:» — нужна форма без него`);
  }

  // 2. Заставка в запуске — оболочки, а не плагина по таймеру.
  // Ищется ЗНАЧЕНИЕ внутри блока плагина, а не первое вхождение слова:
  // выше него стоит комментарий, объясняющий правку, и судить его —
  // ровно та ошибка, за которую 7.196 заплатил подсадкой 34 из 35
  // («сторож засчитал имя свойства за вопрос про оболочку»).
  const block = config.slice(config.indexOf("SplashScreen: {"));
  const duration = block.match(/launchShowDuration:\s*(\d+)/);
  if (!duration) {
    problems.push(`${CONFIG}: launchShowDuration не назван вовсе`);
  } else if (Number(duration[1]) !== 0) {
    problems.push(
      `${CONFIG}: launchShowDuration = ${duration[1]} — заставка снова уходит ПО ТАЙМЕРУ, ` +
        `а страница приходит позже (замер владельца: 5,9 с против 1,5 с таймера)`,
    );
  }

  // 3. Условие удержания и оба выхода из него.
  if (!/installSplashScreen\(/.test(activity)) {
    problems.push(`${ACTIVITY}: заставка не ставится оболочкой вовсе`);
  }
  if (!/setKeepOnScreenCondition\(/.test(activity)) {
    problems.push(`${ACTIVITY}: заставка держится не УСЛОВИЕМ — значит, снова сроком`);
  }
  if (!/onPageCommitVisible|onPageLoaded/.test(activity)) {
    problems.push(`${ACTIVITY}: заставка не отпускается по событию готовности страницы`);
  }
  const fuse = /loadWatchdog\.postDelayed\(\(\) -> releaseSplash\(\),\s*([A-Z_]+|\d+)\s*\)/.exec(activity);
  if (!fuse) {
    problems.push(
      `${ACTIVITY}: у заставки нет ПРЕДОХРАНИТЕЛЯ — страница, которая не пришла, оставила бы человека ` +
        `наедине с логотипом навсегда`,
    );
  } else if (fuse[1] !== "LOAD_TIMEOUT_MS") {
    problems.push(
      `${ACTIVITY}: предохранитель заставки (${fuse[1]}) — не то же число, что срок сторожа загрузки ` +
        `(LOAD_TIMEOUT_MS). Разойдись они — между уходом заставки и экраном ошибки человек увидел бы пустоту`,
    );
  }

  // 3.1. ЕДИНСТВЕННЫЙ ВЫХОД ИЗ ЗАСТАВКИ снимает и системную половину, и
  // нашу. Раньше выход был один и снимал одну; теперь их две, и разойдись
  // они — человек увидел бы фирменный слой поверх готовой страницы.
  const release = /private void releaseSplash\(boolean immediate\)\s*\{[\s\S]*?\n    \}/.exec(activity);
  if (!release) {
    problems.push(`${ACTIVITY}: выхода из заставки нет вовсе (releaseSplash(boolean))`);
  } else {
    if (!/splashReleased\s*=\s*true/.test(release[0])) {
      problems.push(`${ACTIVITY}: releaseSplash не отпускает системную заставку`);
    }
    if (!/hideBrandSplashOverlay\(immediate\)/.test(release[0])) {
      problems.push(`${ACTIVITY}: releaseSplash не снимает собственный слой — знак остался бы поверх страницы`);
    }
  }

  // 3.1.1. ЗАСТАВКА НЕ СТОИТ НАД ЭКРАНОМ ОШИБКИ НИ ОДНОГО КАДРА
  // (долг 232, заход 7.223).
  //
  // Что снял владелец 16.09.2026 (7.203, замер З4): запуск с иконки без
  // сети — знак заставки виден ПОВЕРХ текста экрана ошибки. Причина —
  // анимация ухода длиной SPLASH_FADE_MS = 220 мс, запущенная в тот же
  // миг, когда webview нарисовал первый кадр: поверх уже отрисованного
  // экрана ошибки слой ещё жил эти 220 мс.
  //
  // Плавный уход осмыслен там, где под слоем настоящая страница.
  // Поэтому правило не «убрать анимацию», а «выбрать режим по тому, что
  // под слоем», и проверяется здесь ровно это — все три дороги к экрану
  // ошибки обязаны просить мгновенного снятия.
  const fade = /private void hideBrandSplashOverlay\(boolean immediate\)/.test(activity);
  if (!fade) {
    problems.push(
      `${ACTIVITY}: у ухода заставки нет режима — значит, он снова один, и над экраном ошибки ` +
        `знак простоит SPLASH_FADE_MS (долг 232)`,
    );
  }
  if (!/if \(immediate\) \{/.test(activity)) {
    problems.push(`${ACTIVITY}: режим мгновенного снятия объявлен, но ничего не делает`);
  }
  // Дорога 1 — отказ webview: экран ошибки показывает сам Capacitor
  // через server.errorPath.
  if (!/public void onReceivedError\(WebView view\) \{[^{}]*?releaseSplash\(true\);/.test(activity)) {
    problems.push(
      `${ACTIVITY}: отказ webview снимает заставку С АНИМАЦИЕЙ — знак поверх экрана ошибки (долг 232)`,
    );
  }
  // Дорога 2 — первый кадр локального экрана ошибки.
  if (!/releaseSplash\(isErrorScreen\(url\)\)/.test(activity)) {
    problems.push(
      `${ACTIVITY}: первый кадр содержимого снимает заставку, не спросив, экран ли это ошибки (долг 232)`,
    );
  }
  // Дорога 3 — наш собственный сторож загрузки грузит тот же адрес сам.
  if (!/releaseSplash\(true\);\n\s*webView\.loadUrl\(errorUrl\);/.test(activity)) {
    problems.push(
      `${ACTIVITY}: сторож загрузки грузит экран ошибки, не сняв слой заставки этим же кадром (долг 232)`,
    );
  }

  // 3.2. СОБСТВЕННЫЙ СЛОЙ ЗНАКА. Ровно то, чего не хватало запуску из
  // установщика: системная заставка там приходит пустой по требованию
  // ВЫЗЫВАЮЩЕГО приложения, и нашей темой это не лечится.
  if (!/attachBrandSplashOverlay\(\)/.test(activity)) {
    problems.push(
      `${ACTIVITY}: у оболочки нет собственного слоя заставки — запуск из установщика и из Play Store ` +
        `покажет фон без знака (замер владельца: 4,2 с сплошного цвета)`,
    );
  }
  if (!/setImageResource\(R\.drawable\.splash_icon\)/.test(activity)) {
    problems.push(`${ACTIVITY}: собственный слой заставки рисует не @drawable/splash_icon`);
  }
  if (!/setBackgroundColor\(getColor\(R\.color\.splashBackground\)\)/.test(activity)) {
    problems.push(`${ACTIVITY}: собственный слой заставки красится не @color/splashBackground`);
  }
  const iconDp = /SPLASH_ICON_DP\s*=\s*(\d+)/.exec(activity);
  if (!iconDp) {
    problems.push(`${ACTIVITY}: поле знака собственного слоя не названо числом`);
  } else if (Number(iconDp[1]) !== SPLASH_ICON_DP) {
    problems.push(
      `${ACTIVITY}: поле знака ${iconDp[1]}dp расходится с полем системной заставки (${SPLASH_ICON_DP}dp) — ` +
        `подмена одной другой была бы видна рывком размера`,
    );
  }
  // Условие удержания системной заставки обязано сниматься НАШИМ слоем, а
  // не готовностью страницы: иначе на запуске с пустой системной заставкой
  // человек смотрел бы на голый фон всё время загрузки — то есть ровно то,
  // что и было снято владельцем.
  if (!/setKeepOnScreenCondition\(\(\) -> !overlayAttached\)/.test(activity)) {
    problems.push(
      `${ACTIVITY}: системная заставка держится не до появления нашего слоя — на пустой системной заставке ` +
        `(запуск из установщика) знака не будет всё время загрузки`,
    );
  }

  // 4. Цвет фона — три записи одного и того же.
  const fromColors = (colors.match(/<color name="splashBackground">\s*(#[0-9a-fA-F]{6})/) ?? [])[1];
  const fromConfig = (config.match(/backgroundColor:\s*"(#[0-9a-fA-F]{6})"/) ?? [])[1];
  const fromManifest = (manifest.match(/theme_color:\s*"(#[0-9a-fA-F]{6})"/) ?? [])[1];
  const expected = splashBackgroundHex();
  for (const [where, value] of [
    [COLORS, fromColors],
    [CONFIG, fromConfig],
    [MANIFEST, fromManifest],
  ]) {
    if (!value) {
      problems.push(`${where}: цвет фона заставки не найден`);
    } else if (value.toLowerCase() !== expected) {
      problems.push(`${where}: цвет ${value} расходится с фоном resources/icon.png (${expected})`);
    }
  }

  return problems;
}

/** Картинки — отдельной половиной: их судит не текст, а байты. */
function pictureProblems() {
  const problems = [];
  for (const [rel, buf] of buildSplash()) {
    let same = false;
    try {
      same = readFileSync(rel).equals(buf);
    } catch {
      same = false;
    }
    if (!same) problems.push(`${rel}: разошлась с эталоном из resources/icon.png — npm run store:splash`);
  }
  return problems;
}

export async function main() {
  const plant = process.argv.includes("--plant");
  const sources = Object.fromEntries([STYLES, COLORS, ACTIVITY, CONFIG, MANIFEST].map((f) => [f, read(f)]));

  if (plant) {
    let ok = judge(sources).length === 0 && pictureProblems().length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровые исходники (отрицательный контроль)`);

    const plants = [
      ["фон заставки убран из темы — Android 12+ красит своим",
        { [STYLES]: sources[STYLES].replace('name="windowSplashScreenBackground"', 'name="чтоНибудьДругое"') }],
      ["знак убран из темы — заставка есть, знака нет (ровно то, что снял владелец)",
        { [STYLES]: sources[STYLES].replace('name="windowSplashScreenAnimatedIcon"', 'name="чтоНибудьДругое"') }],
      ["свойства написаны с префиксом android: — соберётся молча, сработает только с Android 12",
        { [STYLES]: sources[STYLES].replace('name="windowSplashScreenBackground"', 'name="android:windowSplashScreenBackground"') }],
      ["после заставки окно осталось в её теме (postSplashScreenTheme забыт)",
        { [STYLES]: sources[STYLES].replace('name="postSplashScreenTheme"', 'name="чтоНибудьДругое"') }],
      ["заставка снова уходит по таймеру плагина",
        { [CONFIG]: sources[CONFIG].replace("launchShowDuration: 0", "launchShowDuration: 1500") }],
      ["оболочка перестала ставить заставку сама",
        { [ACTIVITY]: sources[ACTIVITY].replace(/installSplashScreen\(/g, "неСтавимЗаставку(") }],
      ["заставка держится не условием",
        { [ACTIVITY]: sources[ACTIVITY].replace(/setKeepOnScreenCondition\(/g, "неДержим(") }],
      ["заставка не отпускается по готовности страницы",
        { [ACTIVITY]: sources[ACTIVITY].replace(/onPageCommitVisible/g, "неСобытие").replace(/onPageLoaded/g, "неСобытие2") }],
      ["у заставки отобрали предохранитель — логотип навсегда",
        { [ACTIVITY]: sources[ACTIVITY].replace(/loadWatchdog\.postDelayed\(\(\) -> releaseSplash\(\), LOAD_TIMEOUT_MS\);/, "") }],
      ["предохранитель разошёлся со сроком сторожа загрузки",
        { [ACTIVITY]: sources[ACTIVITY].replace("releaseSplash(), LOAD_TIMEOUT_MS)", "releaseSplash(), 3000)") }],
      ["собственного слоя заставки нет — запуск из установщика снова без знака",
        { [ACTIVITY]: sources[ACTIVITY].replace(/attachBrandSplashOverlay\(\)/g, "неСтавимСлой()") }],
      ["собственный слой рисует не фирменный знак",
        { [ACTIVITY]: sources[ACTIVITY].replace("setImageResource(R.drawable.splash_icon)", "setImageResource(R.drawable.ic_launcher_background)") }],
      ["собственный слой красится не фирменным фоном",
        { [ACTIVITY]: sources[ACTIVITY].replace("setBackgroundColor(getColor(R.color.splashBackground))", "setBackgroundColor(0xFFFFFFFF)") }],
      ["поле знака собственного слоя разошлось с полем системной заставки",
        { [ACTIVITY]: sources[ACTIVITY].replace("SPLASH_ICON_DP = 288", "SPLASH_ICON_DP = 160") }],
      ["системная заставка снова держится до готовности страницы — на пустой она оставит голый фон",
        { [ACTIVITY]: sources[ACTIVITY].replace("setKeepOnScreenCondition(() -> !overlayAttached)", "setKeepOnScreenCondition(() -> !splashReleased)") }],
      ["выход из заставки перестал снимать собственный слой — знак поверх готовой страницы",
        { [ACTIVITY]: sources[ACTIVITY].replace("        hideBrandSplashOverlay(immediate);\n    }", "    }") }],
      ["ДОЛГ 232: у ухода заставки снова один режим — знак 220 мс поверх текста ошибки",
        { [ACTIVITY]: sources[ACTIVITY].replace("private void hideBrandSplashOverlay(boolean immediate)", "private void hideBrandSplashOverlay()") }],
      ["ДОЛГ 232: мгновенный режим объявлен, но ничего не делает",
        { [ACTIVITY]: sources[ACTIVITY].replace("if (immediate) {", "if (false) {") }],
      ["ДОЛГ 232: отказ webview снова снимает заставку с анимацией",
        { [ACTIVITY]: sources[ACTIVITY].replace("                // стоять нечего — и стоять ей нечего НИ ОДНОГО кадра.\n                releaseSplash(true);", "                releaseSplash();") }],
      ["ДОЛГ 232: первый кадр содержимого не спрашивает, экран ли это ошибки",
        { [ACTIVITY]: sources[ACTIVITY].replace("releaseSplash(isErrorScreen(url))", "releaseSplash()") }],
      ["ДОЛГ 232: сторож загрузки грузит экран ошибки, не сняв слой",
        { [ACTIVITY]: sources[ACTIVITY].replace("                releaseSplash(true);\n                webView.loadUrl(errorUrl);", "                webView.loadUrl(errorUrl);") }],
      ["цвет фона заставки разошёлся с фирменным",
        { [COLORS]: sources[COLORS].replace(/#2d5f8a/i, "#ffffff") }],
      ["цвет в конфиге оболочки разошёлся с фирменным",
        { [CONFIG]: sources[CONFIG].replace(/backgroundColor: "#2d5f8a"/, 'backgroundColor: "#ffffff"') }],
    ];

    let caught = 0;
    for (const [name, patch] of plants) {
      const found = judge({ ...sources, ...patch });
      const hit = found.length > 0;
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}${hit ? ` (${found[0]})` : ""}`);
    }
    ok &&= caught === plants.length;
    console.log(
      ok
        ? `check:splash --plant — ${caught} из ${plants.length} подсадок, 1 из 1 отрицательный контроль`
        : `check:splash --plant — FAILED (${caught} из ${plants.length})`,
    );
    return ok ? 0 : 1;
  }

  const problems = [...judge(sources), ...pictureProblems()];
  if (problems.length) {
    console.error("ЗАСТАВКА ПРИЛОЖЕНИЯ:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(
    `check:splash — тема запуска называет оба свойства Android 12+ и postSplashScreenTheme; ` +
      `заставка принадлежит оболочке (launchShowDuration 0), держится условием, отпускается по готовности ` +
      `страницы и имеет предохранитель на тот же срок, что сторож загрузки; цвет ${splashBackgroundHex()} ` +
      `совпадает в трёх местах; 31 картинка совпадает с эталоном из resources/icon.png. Контроль — --plant.`,
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
