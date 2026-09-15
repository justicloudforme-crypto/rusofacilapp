// Нативная оболочка обязана уметь объяснить свою неудачу — и это правило,
// а не намерение.
//
// ЦЕНА, КОТОРУЮ ПЛАТИТ ЗА ЭТО УЧЕНИК. Оболочка Capacitor здесь не несёт
// сайт внутри себя: она грузит боевой адрес удалённо. У неё нет адресной
// строки, нет кнопки «обновить», нет вкладки, которую можно закрыть и
// открыть снова. Значит любой отказ первого запроса — это белый
// прямоугольник без текста и без выхода, у КАЖДОГО, кто поставил
// приложение. Веб-страница в том же положении хотя бы показывает
// собственную ошибку браузера.
//
// ЧТО ПРОВЕРЯЕТСЯ — шесть утверждений, и каждое закрывает свой способ
// молча всё сломать.
//
//  1. `server.errorPath` объявлен в `capacitor.config.ts`, и файл, на
//     который он указывает, существует. Снять одну строку конфига —
//     самый дешёвый способ вернуть белый экран.
//  2. У кнопки «Повторить» адрес написан явно и совпадает с
//     `PRODUCTION_URL`. `location.reload()` здесь НЕ годится и отдельно
//     запрещён: экран ошибки загружен с локального адреса
//     (`Bridge.getErrorUrl()` отдаёт `https://localhost/error.html`), и
//     перезагрузка перезагружала бы сам экран ошибки — кнопка не
//     пыталась бы повторить ничего. Ровно этот дефект и был найден
//     13.09.2026 в уже существовавшем файле.
//  3. Сторож загрузки в `MainActivity.java` на месте: таймер, срок,
//     чтение адреса экрана ошибки у моста и загрузка этого адреса.
//     Capacitor сам ловит только ОТКАЗ; «сервер молчит» он не ловит
//     вовсе, а это класс инцидента №1 — HTTP 200, пустой экран.
//  4. Видимые строки экрана ошибки существуют в ДВУХ локалях: у каждого
//     ключа `data-i18n` обязан быть русский перевод. Английских строк на
//     этом экране быть не может; набор видимого текста сличается в
//     браузере — `scripts/check-native-shell-render.mjs`.
//  5. Токен оболочки написан РОВНО в трёх местах и одинаково:
//     `capacitor.config.ts` (его дописывает `appendUserAgent`),
//     `src/lib/native-shell.ts` (его читает сервер) и
//     `src/lib/shell-tag.ts` (по нему метится событие Sentry). Одной
//     точки правды для них не существует: первый файл читают сторожа
//     текстом, второй помечен `server-only` и в браузер не попадает.
//  6. Все три конфигурации Sentry ставят метку оболочки. Без неё ошибка
//     с телефона неотличима от ошибки в мобильном браузере: адрес
//     страницы, движок и `environment` у них одни и те же.
//
// КОММЕНТАРИИ ОТРЕЗАЮТСЯ ВЕЗДЕ. Третий случай этого класса в репозитории
// (7.178 — `versionCode` в комментарии, 7.181 — `enableV3Signing` в
// комментарии): для регэкспа закомментированная настройка неотличима от
// живой, и сторож оставался зелёным над сломанным файлом. Здесь это
// особенно легко: объяснения в `MainActivity.java` называют и
// `getErrorUrl`, и `postDelayed`.
//
// Контроль: `node scripts/check-native-shell.mjs --plant`.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const IS_ENTRY_POINT = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

const CAP_CONFIG = "capacitor.config.ts";
const ERROR_PAGE = "capacitor-shell/error.html";
const MAIN_ACTIVITY = "android/app/src/main/java/com/rusofacilapp/app/MainActivity.java";
// Литерал токена переехал 13.09.2026 (долг 179) в отдельный модуль без
// серверных импортов: его читает ещё и `src/proxy.ts`, а в middleware
// `next/headers` запрещён. Сторож смотрит туда, где литерал ЖИВЁТ, — иначе
// он сличал бы перевыставленный экспорт и молчал бы о расхождении.
const NATIVE_SHELL_LIB = "src/lib/native-shell-token.ts";
const SHELL_TAG_LIB = "src/lib/shell-tag.ts";
const GLOBALS_CSS = "src/app/globals.css";
const SENTRY_CONFIGS = ["sentry.client.config.ts", "sentry.server.config.ts", "sentry.edge.config.ts"];
const TAG_CALL = "tagShellOnEvent(";

/** Вырезает `//…` и `/*…*\/`, не тронув содержимое строковых литералов:
 *  адрес `https://rusofacilapp.com` начинается с `//` внутри строки, и
 *  наивный отрез съел бы половину каждого адреса в файле. */
function stripComments(text) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** HTML-комментарии отдельно: в `error.html` их разметка своя. */
function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

function read(file) {
  return readFileSync(file, "utf8");
}

function scan() {
  const failures = [];
  const facts = {};

  const cap = stripComments(read(CAP_CONFIG));

  // --- 1. errorPath --------------------------------------------------------
  const errorPath = cap.match(/errorPath:\s*"([^"]+)"/);
  if (!errorPath) {
    failures.push(
      `${CAP_CONFIG}: нет живой настройки \`errorPath\`. Без неё webview при отказе загрузки ` +
        `покажет системную страницу ошибки браузера или просто белый прямоугольник, ` +
        `и у ученика не будет ни текста, ни кнопки.`,
    );
  } else {
    facts.errorPath = errorPath[1];
    const webDir = cap.match(/webDir:\s*"([^"]+)"/);
    const full = `${webDir ? webDir[1] : "capacitor-shell"}/${errorPath[1]}`;
    if (!existsSync(full)) {
      failures.push(`${CAP_CONFIG}: \`errorPath\` указывает на ${full}, а файла нет.`);
    }
  }

  // --- 2. кнопка «Повторить» ----------------------------------------------
  const prodUrl = cap.match(/const PRODUCTION_URL = "([^"]+)"/);
  if (!prodUrl) {
    failures.push(`${CAP_CONFIG}: не найдена живая константа PRODUCTION_URL.`);
  }
  facts.productionUrl = prodUrl ? prodUrl[1] : null;

  const pageRaw = read(ERROR_PAGE);
  const page = stripHtmlComments(pageRaw);
  const siteUrl = page.match(/var SITE_URL = "([^"]+)"/);
  if (!siteUrl) {
    failures.push(
      `${ERROR_PAGE}: кнопке «Повторить» некуда вести — нет живой строки \`var SITE_URL = "…"\`.`,
    );
  } else if (facts.productionUrl && siteUrl[1] !== facts.productionUrl) {
    failures.push(
      `${ERROR_PAGE}: кнопка «Повторить» ведёт на ${siteUrl[1]}, а боевой адрес оболочки — ` +
        `${facts.productionUrl} (${CAP_CONFIG}). Два разных адреса значат, что кнопка уводит не туда, ` +
        `и заметить это можно только с телефона в руках.`,
    );
  }
  facts.retryUrl = siteUrl ? siteUrl[1] : null;
  if (/location\.reload\s*\(/.test(page)) {
    failures.push(
      `${ERROR_PAGE}: \`location.reload()\`. Этот файл загружен НЕ с боевого адреса — Capacitor ` +
        `отдаёт его по локальному (\`Bridge.getErrorUrl()\`), — поэтому перезагрузка перезагружает ` +
        `сам экран ошибки, а не повторяет попытку. Адрес обязан быть написан явно.`,
    );
  }

  // --- 3. сторож загрузки в MainActivity ----------------------------------
  const activity = stripComments(read(MAIN_ACTIVITY));
  const timeout = activity.match(/LOAD_TIMEOUT_MS\s*=\s*([\d_]+)L?/);
  if (!timeout) {
    failures.push(
      `${MAIN_ACTIVITY}: нет живой константы LOAD_TIMEOUT_MS. Capacitor сам ловит только ОТКАЗ ` +
        `загрузки; «сервер ответил 200 и молчит» он не ловит вовсе, и без срока белый экран живёт ` +
        `бесконечно — это класс инцидента №1.`,
    );
  } else {
    facts.timeoutMs = Number(timeout[1].replaceAll("_", ""));
    if (facts.timeoutMs < 3000 || facts.timeoutMs > 60_000) {
      failures.push(
        `${MAIN_ACTIVITY}: LOAD_TIMEOUT_MS = ${facts.timeoutMs} мс. Меньше 3000 ломает честную ` +
          `загрузку в медленной сети, больше 60000 — это уже не сторож, человек ушёл раньше.`,
      );
    }
  }
  for (const [needle, why] of [
    // ПРИЗНАК НАЗВАН ЦЕЛИКОМ, А НЕ ОДНИМ СЛОВОМ. С 15.09.2026 в этом же
    // файле есть ВТОРОЙ `postDelayed` — предохранитель заставки (7.197),
    // — и голое слово «postDelayed» оставалось бы в файле даже после
    // того, как таймер сторожа загрузки убран целиком. Тот же класс, что
    // «сторож засчитал имя свойства за вопрос про оболочку» (7.196).
    ["loadWatchdog.postDelayed(pendingCheck", "таймер не заводится вовсе"],
    ["getErrorUrl", "адрес экрана ошибки не спрашивается у моста — значит показывать будет нечего"],
    ["loadUrl", "экран ошибки не загружается"],
    ["stopLoading", "висящий запрос не прерывается, и он перерисует экран ошибки поверх"],
    ["removeCallbacks", "таймер не снимается при закрытии окна — сработает в мёртвом окне"],
    ["getContentHeight", "«страница нарисовалась» не проверяется: пустой документ с кодом 200 пройдёт как здоровый"],
  ]) {
    if (!activity.includes(needle)) {
      failures.push(`${MAIN_ACTIVITY}: нет живого \`${needle}\` — ${why}.`);
    }
  }

  // --- 4. обе локали экрана ошибки ----------------------------------------
  const keys = [...page.matchAll(/data-i18n="([\w-]+)"/g)].map((m) => m[1]);
  facts.i18nKeys = keys;
  if (keys.length === 0) {
    failures.push(`${ERROR_PAGE}: ни одной строки с \`data-i18n\` — переводить нечего, значит экран одноязычный.`);
  }
  const ruBlock = page.match(/ru:\s*\{([\s\S]*?)\}/);
  if (!ruBlock) {
    failures.push(`${ERROR_PAGE}: нет русского словаря. Устройство с русским языком увидит испанский текст.`);
  } else {
    for (const key of keys) {
      if (!new RegExp(`\\b${key}:\\s*"`).test(ruBlock[1])) {
        failures.push(
          `${ERROR_PAGE}: у видимой строки «${key}» нет русского перевода. Экран ошибки — ` +
            `единственное, что ученик увидит, и показывать ему не его язык здесь дороже всего.`,
        );
      }
    }
  }
  if (/<html[^>]*lang="en"/.test(page)) {
    failures.push(`${ERROR_PAGE}: \`lang="en"\` — ни одной английской строки на этом экране быть не может.`);
  }

  // --- 5. токен оболочки в трёх местах ------------------------------------
  const tokens = new Map();
  for (const [file, re] of [
    [CAP_CONFIG, /const NATIVE_USER_AGENT_TOKEN = "([^"]+)"/],
    [NATIVE_SHELL_LIB, /export const NATIVE_USER_AGENT_TOKEN = "([^"]+)"/],
    [SHELL_TAG_LIB, /export const NATIVE_SHELL_UA_TOKEN = "([^"]+)"/],
  ]) {
    const m = stripComments(read(file)).match(re);
    if (!m) {
      failures.push(`${file}: не найден живой литерал токена оболочки (${re}).`);
      continue;
    }
    tokens.set(file, m[1]);
  }
  facts.tokens = [...tokens.values()];
  const distinct = new Set(tokens.values());
  if (tokens.size === 3 && distinct.size !== 1) {
    failures.push(
      `токен оболочки написан по-разному: ${[...tokens].map(([f, t]) => `${f} → «${t}»`).join(", ")}. ` +
        `Сервер узнаёт оболочку по одной строке, метка Sentry — по другой: разойдясь, они молча ` +
        `перестанут говорить об одном и том же.`,
    );
  }
  // Четвёртое место того же литерала — это четвёртая точка правды, о
  // которой никто не узнает.
  const token = distinct.size === 1 ? [...distinct][0] : null;
  if (token) {
    const extra = [];
    for (const file of [CAP_CONFIG, NATIVE_SHELL_LIB, SHELL_TAG_LIB]) {
      const count = (stripComments(read(file)).match(new RegExp(`"${token}"`, "g")) ?? []).length;
      if (count > 1) extra.push(`${file} (${count})`);
    }
    if (extra.length) {
      failures.push(`литерал токена «${token}» встречается в файле больше одного раза: ${extra.join(", ")}.`);
    }
  }

  // --- 6. у кнопки «Повторить» есть видимое состояние занятости ----------
  //
  // Замер владельца 13.09.2026 на живом телефоне: нажатие «Повторить» без
  // сети давало пустой светлый экран примерно на две секунды, после чего
  // возвращался этот же экран ошибки. Признака загрузки не было ни одного,
  // и человек в эти две секунды считает, что приложение сломалось.
  //
  // Причина ровно в том, что кнопка УХОДИЛА с адреса сразу: переход рвёт
  // документ, webview рисует пустоту, и — если сети по-прежнему нет —
  // возвращает экран ошибки. Поэтому здесь стерегутся три вещи сразу:
  // занятость кнопки, ПРОБА вместо немедленного перехода и русский текст у
  // обоих новых состояний.
  const errorScript = stripComments(page);
  if (!/data-busy/.test(errorScript)) {
    failures.push(
      `${ERROR_PAGE}: у кнопки «Повторить» нет состояния занятости (\`data-busy\`). ` +
        `Нажатие без видимого отклика читается как поломка — замер 13.09.2026 (долг 181).`,
    );
  }
  if (!/fetch\(\s*SITE_URL/.test(errorScript)) {
    failures.push(
      `${ERROR_PAGE}: кнопка «Повторить» уходит на адрес, не спросив, доступен ли он. ` +
        `Переход рвёт этот документ, и при отказе человек видит пустой экран вместо ответа (долг 181).`,
    );
  }
  if (!/button\.disabled = true/.test(errorScript)) {
    failures.push(`${ERROR_PAGE}: кнопка «Повторить» не запирается на время попытки — второе нажатие заведёт вторую (долг 181).`);
  }
  for (const key of ["retrying", "failed"]) {
    if (!new RegExp(`\\b${key}:`).test(errorScript)) {
      failures.push(`${ERROR_PAGE}: нет строки «${key}» — состояние попытки нечем назвать словами (долг 181).`);
      continue;
    }
    const ru = errorScript.slice(errorScript.indexOf("ru: {"), errorScript.indexOf("};", errorScript.indexOf("ru: {")));
    if (!new RegExp(`\\b${key}:`).test(ru)) {
      failures.push(`${ERROR_PAGE}: у строки «${key}» нет русского перевода (долг 181).`);
    }
  }

  // --- 7. безопасные поля сверху и снизу (долг 180) -----------------------
  //
  // У приложения targetSdk 36, а с Android 15 система рисует окно во весь
  // экран и отказаться нельзя: `windowOptOutEdgeToEdgeEnforcement` на
  // targetSdk 36 игнорируется (README `@capacitor/status-bar`). Значит
  // содержимое лезет под строку состояния сверху и под кнопки навигации
  // снизу — ровно это и снял владелец на POCO X6 Pro 13.09.2026.
  // `env(safe-area-inset-*)` в webview отвечает про ВЫРЕЗ, а не про
  // системные полосы, и остаётся нулём, поэтому величины присылает
  // нативная сторона. Правило держит оба конца этой связи: кто присылает и
  // кто читает. Разойдись они — отступ молча станет нулём.
  const activityLive = stripComments(read(MAIN_ACTIVITY));
  const css = read(GLOBALS_CSS);
  for (const [needle, why] of [
    ["setOnApplyWindowInsetsListener", "нативная сторона перестала слушать системные полосы"],
    ["--android-inset-top", "величина ВЕРХНЕЙ полосы не уезжает в страницу"],
    ["--android-inset-bottom", "величина НИЖНЕЙ полосы не уезжает в страницу"],
    ["addWebViewListener", "полосы не переставляются на новой странице — переход стирает их вместе со старым документом"],
    // И ЗДЕСЬ ПРИЗНАК СВОЙ, А НЕ ОБЩИЙ. Слушателей перехода в файле два:
    // этот, про полосы, и слушатель заставки (7.197). Общий
    // `addWebViewListener` остаётся в файле, даже если слушатель полос
    // снят целиком; `onPageStarted` есть только у него.
    ["onPageStarted", "полосы не ставятся В НАЧАЛЕ загрузки — первый нарисованный кадр будет без отступа"],
  ]) {
    if (!activityLive.includes(needle)) {
      failures.push(`${MAIN_ACTIVITY}: нет живого «${needle}» — ${why} (долг 180).`);
    }
  }
  for (const [varName, side] of [["--safe-top", "верх"], ["--safe-bottom", "низ"]]) {
    const line = css.split("\n").find((l) => l.trim().startsWith(`${varName}:`));
    if (!line) {
      failures.push(`${GLOBALS_CSS}: переменной ${varName} нет вовсе.`);
      continue;
    }
    if (!line.includes("--android-inset")) {
      failures.push(
        `${GLOBALS_CSS}: ${varName} (${side}) читает только env(safe-area-inset-*), а в webview это ` +
          `ноль. Величину системной полосы присылает MainActivity — её здесь никто не берёт (долг 180).`,
      );
    }
  }

  // --- 8. метка оболочки во всех трёх конфигурациях Sentry ----------------
  const tagged = [];
  for (const file of SENTRY_CONFIGS) {
    const text = stripComments(read(file));
    if (!text.includes(TAG_CALL)) {
      failures.push(
        `${file}: нет живого вызова \`${TAG_CALL})\`. События из этого runtime приедут в Sentry ` +
          `без метки, то есть неотличимыми от веба — и вопрос «сломалось ли что-то именно в ` +
          `приложении» по ним задать нельзя.`,
      );
      continue;
    }
    if (!/beforeSend/.test(text)) {
      failures.push(`${file}: \`${TAG_CALL}\` есть, а \`beforeSend\` нет — метка никуда не попадёт.`);
      continue;
    }
    tagged.push(file);
  }
  facts.tagged = tagged;

  return { failures, facts };
}

function report({ failures, facts }) {
  if (failures.length) {
    console.error("check:native-shell — ОТКАЗ\n");
    for (const f of failures) console.error(`  ${f}\n`);
    return false;
  }
  console.log("check:native-shell — оболочка умеет объяснить свою неудачу.");
  console.log(`  экран ошибки: ${facts.errorPath}, кнопка «Повторить» ведёт на ${facts.retryUrl}`);
  console.log(
    `  сторож загрузки: ${facts.timeoutMs} мс, затем локальный экран ошибки вместо белого прямоугольника`,
  );
  console.log(
    `  видимых строк на экране ошибки ${facts.i18nKeys.length} (${facts.i18nKeys.join(", ")}), ` +
      `у каждой есть русский перевод`,
  );
  console.log(`  токен оболочки «${facts.tokens[0]}» — в ${facts.tokens.length} местах, одинаково`);
  console.log(`  метка Sentry: ${facts.tagged.length} из ${SENTRY_CONFIGS.length} конфигураций (${facts.tagged.join(", ")})`);
  return true;
}

function plantControls() {
  const swap = (file, from, to) => {
    const before = readFileSync(file, "utf8");
    if (!before.includes(from)) throw new Error(`подсадка не нашла «${from.slice(0, 60)}» в ${file}`);
    writeFileSync(file, before.replace(from, to));
    return () => writeFileSync(file, before);
  };
  /** То же, что `swap`, но по шаблону и по ВСЕМ вхождениям. */
  const swapAll = (file, re, to) => {
    const before = readFileSync(file, "utf8");
    if (!re.test(before)) throw new Error(`подсадка не нашла ${re} в ${file}`);
    writeFileSync(file, before.replace(re, to));
    return () => writeFileSync(file, before);
  };

  const controls = [
    {
      name: "errorPath снят из конфига — webview вернётся к белому экрану",
      plant: () => swap(CAP_CONFIG, 'errorPath: "error.html",', ""),
      expect: (r) => r.failures.some((m) => m.includes("нет живой настройки `errorPath`")),
    },
    {
      name: "errorPath указывает на файл, которого нет",
      plant: () => swap(CAP_CONFIG, 'errorPath: "error.html",', 'errorPath: "offline.html",'),
      expect: (r) => r.failures.some((m) => m.includes("а файла нет")),
    },
    {
      name: "кнопка «Повторить» вернулась к location.reload() — перезагружает сам экран ошибки",
      plant: () =>
        swap(
          ERROR_PAGE,
          'location.href = SITE_URL;',
          "location.reload();",
        ),
      expect: (r) => r.failures.some((m) => m.includes("location.reload()")),
    },
    {
      name: "кнопка «Повторить» уводит на чужой адрес",
      plant: () => swap(ERROR_PAGE, 'var SITE_URL = "https://rusofacilapp.com";', 'var SITE_URL = "https://example.com";'),
      expect: (r) => r.failures.some((m) => m.includes("ведёт на https://example.com")),
    },
    {
      name: "кнопка «Повторить» снова уходит на адрес, не спросив (пустой экран вместо ответа)",
      plant: () => swap(ERROR_PAGE, 'fetch(SITE_URL, { mode: "no-cors"', 'noFetch(SITE_URL, { mode: "no-cors"'),
      expect: (r) => r.failures.some((m) => m.includes("не спросив, доступен ли он")),
    },
    {
      name: "у кнопки «Повторить» убрали состояние занятости",
      // Все вхождения сразу: правило спрашивает про признак, а не про одну
      // строку, и подсадка, стирающая только первую (она в стилях), ничего
      // бы не доказала — ровно это и случилось на первом прогоне.
      plant: () => swapAll(ERROR_PAGE, /data-busy/g, "data-idle"),
      expect: (r) => r.failures.some((m) => m.includes("нет состояния занятости")),
    },
    {
      name: "кнопка «Повторить» перестала запираться на время попытки",
      plant: () => swap(ERROR_PAGE, "button.disabled = true", "button.dataset.x = true"),
      expect: (r) => r.failures.some((m) => m.includes("не запирается на время попытки")),
    },
    {
      name: "у строки «Пробуем…» пропал русский перевод",
      plant: () => swap(ERROR_PAGE, '          retrying: "Пробуем…",\n', ""),
      expect: (r) => r.failures.some((m) => m.includes("«retrying»") && m.includes("русск")),
    },
    {
      name: "нативная сторона перестала присылать системные полосы",
      plant: () => swap(MAIN_ACTIVITY, "setOnApplyWindowInsetsListener", "неСлушаемПолосы"),
      expect: (r) => r.failures.some((m) => m.includes("перестала слушать системные полосы")),
    },
    {
      name: "полосы присылаются, но страница берёт только env() — в webview это ноль",
      plant: () =>
        swap(
          GLOBALS_CSS,
          "--safe-bottom: max(env(safe-area-inset-bottom, 0px), var(--android-inset-bottom, 0px));",
          "--safe-bottom: env(safe-area-inset-bottom, 0px);",
        ),
      expect: (r) => r.failures.some((m) => m.includes("--safe-bottom") && m.includes("это")),
    },
    {
      name: "полосы не переставляются после перехода на новую страницу",
      plant: () => swap(MAIN_ACTIVITY, "onPageStarted", "неСлушаемПереходы"),
      expect: (r) => r.failures.some((m) => m.includes("первый нарисованный кадр")),
    },
    {
      name: "срок сторожа загрузки снят вовсе",
      plant: () => swap(MAIN_ACTIVITY, "LOAD_TIMEOUT_MS = 12_000L", "UNUSED_CONSTANT = 12_000L"),
      expect: (r) => r.failures.some((m) => m.includes("нет живой константы LOAD_TIMEOUT_MS")),
    },
    {
      name: "срок выставлен в полторы секунды — сломал бы честную загрузку в медленной сети",
      plant: () => swap(MAIN_ACTIVITY, "LOAD_TIMEOUT_MS = 12_000L", "LOAD_TIMEOUT_MS = 1_500L"),
      expect: (r) => r.failures.some((m) => m.includes("Меньше 3000")),
    },
    {
      name: "таймер не заводится: postDelayed убран",
      plant: () => swap(MAIN_ACTIVITY, "loadWatchdog.postDelayed(pendingCheck, LOAD_TIMEOUT_MS);", ""),
      expect: (r) => r.failures.some((m) => m.includes("таймер не заводится вовсе")),
    },
    {
      name: "сторож перестал спрашивать адрес экрана ошибки у моста",
      plant: () => swap(MAIN_ACTIVITY, "getBridge().getErrorUrl()", "null"),
      expect: (r) => r.failures.some((m) => m.includes("`getErrorUrl`")),
    },
    {
      name: "пустой документ с кодом 200 пройдёт как здоровый: getContentHeight убран",
      plant: () => swap(MAIN_ACTIVITY, "webView.getContentHeight() > 0", "true"),
      expect: (r) => r.failures.some((m) => m.includes("`getContentHeight`")),
    },
    {
      name: "ЗАКОММЕНТИРОВАННАЯ настройка не считается живой (класс 7.178 и 7.181)",
      plant: () => swap(CAP_CONFIG, 'errorPath: "error.html",', '// errorPath: "error.html",'),
      expect: (r) => r.failures.some((m) => m.includes("нет живой настройки `errorPath`")),
    },
    {
      name: "у видимой строки экрана ошибки пропал русский перевод",
      plant: () => swap(ERROR_PAGE, '          retry: "Повторить",\n', ""),
      expect: (r) => r.failures.some((m) => m.includes("«retry» нет русского перевода")),
    },
    {
      name: "русский словарь экрана ошибки убран целиком",
      plant: () => swap(ERROR_PAGE, "        ru: {", "        xx: {"),
      expect: (r) => r.failures.some((m) => m.includes("нет русского словаря")),
    },
    {
      name: "токен оболочки разошёлся между сервером и меткой Sentry",
      plant: () => swap(SHELL_TAG_LIB, 'NATIVE_SHELL_UA_TOKEN = "RFNativeShell"', 'NATIVE_SHELL_UA_TOKEN = "RFShell"'),
      expect: (r) => r.failures.some((m) => m.includes("написан по-разному")),
    },
    {
      name: "метка оболочки снята с браузерной конфигурации Sentry",
      plant: () => swap("sentry.client.config.ts", "tagShellOnEvent(\n      scrubTokensFromEvent(event),", "(\n      scrubTokensFromEvent(event),"),
      expect: (r) => r.failures.some((m) => m.includes("sentry.client.config.ts") && m.includes("tagShellOnEvent")),
    },
    {
      name: "метка оболочки снята с КРАЕВОЙ конфигурации — остальные две её не спасают",
      plant: () => swap("sentry.edge.config.ts", "beforeSend: (event) => tagShellOnEvent(event, userAgentFromSentryEvent(event)),", ""),
      expect: (r) =>
        r.failures.some((m) => m.includes("sentry.edge.config.ts")) &&
        !r.failures.some((m) => m.includes("sentry.server.config.ts")),
    },
    {
      name: "ОТРИЦАТЕЛЬНЫЙ: адрес https://rusofacilapp.com в строке не съедается отрезом комментариев",
      plant: () => () => {},
      expect: (r) => r.facts.productionUrl === "https://rusofacilapp.com" && r.failures.length === 0,
      negative: true,
    },
  ];

  let ok = true;
  let pos = 0;
  let neg = 0;
  for (const c of controls) {
    const undo = c.plant();
    let caught;
    try {
      caught = c.expect(scan());
    } finally {
      undo();
    }
    const verb = c.negative ? (caught ? "промолчал" : "ЛОЖНО КРАСНЫЙ") : caught ? "поймано" : "ПРОПУЩЕНО";
    console.log(`  ${verb} — ${c.name}`);
    if (caught) {
      if (c.negative) neg++;
      else pos++;
    }
    ok &&= caught;
  }
  const clean = scan().failures.length === 0;
  console.log(`  ${clean ? "чисто" : "ВСЁ ЕЩЁ ГРЯЗНО"} — после отката всех подсадок`);
  ok &&= clean;
  const positives = controls.filter((c) => !c.negative).length;
  console.log(
    ok
      ? `check:native-shell --plant — ${pos} из ${positives} подсадок поймано, ${neg} из ${controls.length - positives} отрицательных контролей промолчали`
      : "check:native-shell --plant — FAILED",
  );
  return ok;
}

if (IS_ENTRY_POINT) {
  const ok = process.argv.includes("--plant") ? plantControls() : report(scan());
  process.exitCode = ok ? 0 : 1;
}
