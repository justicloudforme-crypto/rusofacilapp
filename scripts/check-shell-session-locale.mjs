/**
 * ОБОЛОЧКА: ВЫХОД ИЗ АККАУНТА ДОЛЖЕН ПЕРЕЖИТЬ ЗАКРЫТИЕ, А ЯЗЫК — ПЕРЕЕЗД
 * НА ЛОКАЛЬНЫЙ ЭКРАН ОШИБКИ (заход 7.198, части 1 и 3).
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО, И ЧТО ИМЕННО ОПРОВЕРГНУТО ЧИСЛОМ
 * ====================================================================
 *
 * ЖАЛОБА ПЕРВАЯ (часть 1). «Cerrar sesión» → экран входа → закрыть
 * приложение из «Недавних» → открыть с иконки → приложение открылось ПОД
 * АККАУНТОМ. Владелец назвал две возможные причины, и обе проверены:
 *
 *   (а) «выход не удаляет сессионную куку» — НЕВЕРНА в той части, которая
 *       про сервер. Ответ боевого прода на `POST /api/auth/logout`, снят
 *       15.09.2026:
 *           set-cookie: session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
 *       Путь `/` тот же, что у выданной куки (`src/lib/auth.ts`,
 *       `createSession`), то есть сервер просит удалить ровно ту куку.
 *   (б) «страница пришла из кеша воркера» — ЭТОТ случай не объясняет.
 *       Страницы обслуживаются `NetworkFirst` (`src/app/sw.ts`): при живой
 *       сети побеждает сеть. Больше того, последняя копия стартовой
 *       страницы, попавшая в кеш, — гостевая: на неё увёл сам выход.
 *       (Дефект в (б) всё-таки есть, он про ЛИЧНЫЕ страницы офлайн, и
 *       чинится на стороне сайта — `npm run check:signed-out`.)
 *
 * Остаётся третье, и оно здесь. Удаление куки доезжает до webview и живёт
 * в ПАМЯТИ: на диск Chromium пишет хранилище кук пачками, по таймеру.
 * Закрытие из «Недавних» в первые секунды после выхода убивает процесс
 * раньше записи, и следующий запуск поднимает с диска ещё старую сессию.
 * Перепись вызовов в Capacitor 8.5.0: `CookieManager.flush()` в жизненном
 * цикле не зовётся НИ РАЗУ — `Bridge.onPause`, `Bridge.onStop`,
 * `Bridge.onDestroy` прочитаны целиком, ноль совпадений.
 *
 * ЖАЛОБА ВТОРАЯ (часть 3). Интерфейс переключён на русский, сети нет —
 * экран ошибки оболочки пришёл на испанском. Причина: он брал язык из
 * `navigator.language`, то есть из языка ТЕЛЕФОНА. Прочитать выбор с
 * сайта он не может ни кукой, ни хранилищем: файл загружен с
 * `https://localhost`, а выбор живёт на `https://rusofacilapp.com` —
 * разные источники.
 *
 * ====================================================================
 * ЧТО ИМЕННО СТЕРЕЖЁТСЯ
 * ====================================================================
 *
 *   1. Оболочка пишет хранилище кук на диск в `onPause` и в `onStop` —
 *      то есть ДО того, как человек смахнёт карточку из «Недавних».
 *   2. Оболочка помнит локаль последней открытой страницы и берёт её из
 *      АДРЕСА, а не из языка телефона.
 *   3. Список локалей оболочки совпадает с `src/i18n/config.ts` — ровно
 *      две, и те же самые.
 *   4. Локальный экран ошибки принимает язык от оболочки
 *      (`window.__rfApplyLocale`), а оболочка его туда приносит.
 *   5. Обе локали экрана ошибки лежат в ОДНОМ словаре, а текст в разметке
 *      совпадает с испанской половиной словаря знак в знак: разметка —
 *      это запасной путь на случай, когда JS не исполнился, и разойтись
 *      со словарём она права не имеет.
 *
 * ====================================================================
 * ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ — НА НАСТОЯЩЕМ СТАРОМ КОДЕ
 * ====================================================================
 *
 * Подсадки ниже правят текст. Этого мало: правку легко подогнать под
 * собственную проверку. Поэтому первым контролем идёт ЖИВОЙ файл из
 * репозитория — тот самый, на котором снят замер владельца 15.09.2026.
 * Сторож обязан назвать на нём все правила, которых там нет.
 *
 * ТОЧКА ОТСЧЁТА ЛЕЖИТ В РЕПОЗИТОРИИ, И ЭТО ДВЕ ПОПРАВКИ, А НЕ ОДНА.
 *
 * Первая редакция брала `origin/main`. Она была бы зелёной ровно до
 * слияния этой ветки и сломалась бы сразу после него: в `main` встал бы
 * уже ПОЧИНЕННЫЙ файл, контроль нашёл бы в нём 0 нарушений и объявил бы
 * сторож слепым. Положительный контроль, отсчитывающий от движущейся
 * точки, самоуничтожается при первом же успехе.
 *
 * Вторая редакция брала коммит по имени (`git show fdfc1c4:…`). Она
 * работала бы на машине разработчика и молчала бы в CI: `actions/checkout`
 * забирает ОДИН коммит, и истории там нет вовсе.
 *
 * Поэтому старые файлы лежат в репозитории копией
 * (`scripts/fixtures/before-7198/`), а git — только вторым источником:
 * когда история под рукой, сторож ДОПОЛНИТЕЛЬНО сличает копию с коммитом
 * {@link BEFORE_FIX} побайтово, чтобы копия не разошлась с тем, что
 * действительно было.
 *
 *   node scripts/check-shell-session-locale.mjs
 *   node scripts/check-shell-session-locale.mjs --plant
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ACTIVITY = "android/app/src/main/java/com/rusofacilapp/app/MainActivity.java";
const ERROR_PAGE = "capacitor-shell/error.html";
const I18N = "src/i18n/config.ts";
const LOCALE_COOKIE_SOURCE = "src/lib/remembered-locale.ts";

const read = (path) => readFileSync(path, "utf8");

/** Тело метода Java по его сигнатуре. Скобки считаются, а не угадываются
 *  по отступу: отступ врал уже дважды (7.193, правило «ветка у каждого
 *  входа»). */
function methodBody(source, signature) {
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

/**
 * Тело без комментариев.
 *
 * ПОЧЕМУ ЭТО ОТДЕЛЬНАЯ ФУНКЦИЯ, а не «и так понятно». Первая редакция
 * правила 6 сравнивала порядок двух имён прямо в тексте метода — и
 * покраснела на ПОЧИНЕННОМ файле, потому что `PREF_LOCALE` стоит в
 * комментарии, объясняющем порядок источников, то есть выше самого кода.
 * Сторож мерил объяснение вместо решения. Тот же класс, что «сторож
 * засчитывал ИМЯ СВОЙСТВА за вопрос про оболочку» (7.196).
 */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

/** Видимый текст экрана ошибки по ключу `data-i18n` — из РАЗМЕТКИ. */
function markupStrings(html) {
  const out = {};
  // Только РАЗМЕТКА: ниже, в скрипте, `data-i18n` встречается ещё и как
  // селектор, и засчитать его за видимую строку значило бы мерить свой
  // собственный разбор. Ровно на этом сторож и поймали при первом прогоне.
  const body = html.slice(0, html.indexOf("<script>"));
  const re = /data-i18n="([a-z]+)"[^>]*>([^<]*)</g;
  let m;
  while ((m = re.exec(body)) !== null) out[m[1]] = m[2].trim();
  return out;
}

/** Словарь экрана ошибки — из ЕДИНСТВЕННОГО объекта `strings`. */
function dictionaryStrings(html) {
  const at = html.indexOf("var strings = {");
  if (at === -1) return null;
  const open = html.indexOf("{", at);
  let depth = 0;
  let end = -1;
  for (let i = open; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return null;
  const literal = html.slice(open, end);
  try {
    // Литерал объекта, а не произвольный код: вычисляется он ровно так же,
    // как его прочитает webview, и никакой другой строки отсюда не берётся.
    return new Function(`return (${literal})`)();
  } catch {
    return null;
  }
}

export function judge(sources) {
  const problems = [];
  const activity = sources[ACTIVITY];
  const html = sources[ERROR_PAGE];
  const i18n = sources[I18N];
  const cookieSource = sources[LOCALE_COOKIE_SOURCE];

  // --- 1. Запись хранилища кук на диск -------------------------------
  for (const hook of ["public void onPause()", "public void onStop()"]) {
    const body = methodBody(activity, hook);
    if (body === null) {
      problems.push(`${ACTIVITY}: нет ${hook} — записать куки на диск перед закрытием негде`);
      continue;
    }
    if (!/CookieManager\.getInstance\(\)\.flush\(\)/.test(body)) {
      problems.push(
        `${ACTIVITY}: ${hook} не пишет хранилище кук на диск (CookieManager.getInstance().flush()) — ` +
          `выход из аккаунта не переживёт закрытия приложения из «Недавних»`,
      );
    }
  }

  // --- 2. Память о локали --------------------------------------------
  if (!/getSharedPreferences\(PREFS,\s*Context\.MODE_PRIVATE\)/.test(activity)) {
    problems.push(`${ACTIVITY}: оболочка не помнит ничего между запусками (нет SharedPreferences)`);
  }
  const remember = methodBody(activity, "private void rememberLocaleFrom(String url)");
  if (!remember) {
    problems.push(`${ACTIVITY}: локаль последней страницы не запоминается вовсе`);
  } else if (!/putString\(PREF_LOCALE/.test(remember)) {
    problems.push(`${ACTIVITY}: локаль последней страницы никуда не записывается`);
  }
  const localeOf = methodBody(activity, "private String localeOf(String url)");
  if (!localeOf) {
    problems.push(`${ACTIVITY}: локаль берётся не из адреса страницы`);
  } else if (/navigator|getLocale|Locale\.getDefault/.test(localeOf)) {
    problems.push(
      `${ACTIVITY}: локаль берётся из языка устройства, а не из адреса открытой страницы — ` +
        `это ровно та подмена, из-за которой экран ошибки пришёл на испанском`,
    );
  }

  // --- 3. Список локалей один на проект -------------------------------
  const fromConfig = [...i18n.matchAll(/"([a-z]{2})"/g)].map((m) => m[1]);
  const declared = [...new Set(fromConfig.slice(0, 2))];
  const inActivity = localeOf ? [...new Set([...localeOf.matchAll(/return "([a-z]{2})"/g)].map((m) => m[1]))] : [];
  if (inActivity.sort().join(",") !== declared.slice().sort().join(",")) {
    problems.push(
      `${ACTIVITY}: локали оболочки [${inActivity.join(", ")}] разошлись с ${I18N} [${declared.join(", ")}]`,
    );
  }

  // --- 4. Язык доезжает до экрана ошибки ------------------------------
  const apply = methodBody(activity, "private void applyLocaleToErrorScreen(String url)");
  if (!apply) {
    problems.push(`${ACTIVITY}: экрану ошибки язык никто не приносит`);
  } else {
    if (!/getErrorUrl\(\)/.test(apply)) {
      problems.push(`${ACTIVITY}: язык приносится не на экран ошибки (адрес не сверяется с getErrorUrl)`);
    }
    if (!/__rfApplyLocale/.test(apply)) {
      problems.push(`${ACTIVITY}: язык экрану ошибки передаётся мимо его собственной точки входа`);
    }
  }
  if (!/window\.__rfApplyLocale\s*=\s*applyLocale;/.test(html)) {
    problems.push(`${ERROR_PAGE}: экран ошибки не объявляет точку входа для языка от оболочки`);
  }

  // --- 6. ЯЗЫК ЭКРАНА ОШИБКИ — ЭТО ВЫБОР, А НЕ СЛЕД (заход 7.202) -----
  //
  // `PREF_LOCALE` пишут три слушателя ПОЛНОЙ навигации, а переключатель
  // языка на сайте — `next/link`, то есть мягкий переход. Значит след
  // навигации выбора не видит вовсе, и опираться на него одного нельзя.
  // Выбор живёт в куке `rf-lang` боевого источника; прочитать её может
  // только оболочка — у самого экрана ошибки другой источник.
  const chosen = methodBody(activity, "private String chosenLocaleFromCookies()");
  if (!chosen) {
    problems.push(
      `${ACTIVITY}: выбор языка нигде не читается — экран ошибки знает только про полные навигации, ` +
        `а переключатель языка на сайте их не делает`,
    );
  } else {
    if (!/CookieManager\.getInstance\(\)\.getCookie\(/.test(chosen)) {
      problems.push(`${ACTIVITY}: выбор языка читается не из кувшина кук webview`);
    }
    if (!/getServerUrl\(\)/.test(chosen)) {
      problems.push(
        `${ACTIVITY}: кука выбора языка спрашивается не по БОЕВОМУ адресу — ` +
          `у локального экрана ошибки свой источник, и кук боевого домена на нём нет ни одной`,
      );
    }
    if (!/LOCALE_COOKIE/.test(chosen)) {
      problems.push(`${ACTIVITY}: имя куки выбора языка написано по месту, а не взято из одного объявления`);
    }
    if (!/localeOf\(/.test(chosen)) {
      problems.push(
        `${ACTIVITY}: значение куки проверяется своим списком локалей, а не общим localeOf — ` +
          `третья локаль появится в проекте и не появится здесь`,
      );
    }
  }
  if (apply) {
    const applyCode = withoutComments(apply);
    const atChosen = applyCode.indexOf("chosenLocaleFromCookies()");
    const atPref = applyCode.indexOf("PREF_LOCALE");
    if (atChosen === -1) {
      problems.push(
        `${ACTIVITY}: экрану ошибки приносится след последней страницы, а не выбор человека`,
      );
    } else if (atPref !== -1 && atPref < atChosen) {
      problems.push(
        `${ACTIVITY}: след навигации спрашивается РАНЬШЕ выбора человека — ` +
          `выбранный русский снова проиграет первой жёсткой загрузке на /es`,
      );
    }
  }

  // Имя куки — одно на проект. Расхождение молчаливое: оболочка искала бы
  // куку, которой сайт не ставит, и экран ошибки снова остался бы без языка.
  const cookieName = /export const LOCALE_COOKIE = "([^"]+)"/.exec(cookieSource ?? "");
  if (!cookieName) {
    problems.push(`${LOCALE_COOKIE_SOURCE}: имя куки выбора языка не читается`);
  } else {
    const inJava = /private static final String LOCALE_COOKIE = "([^"]+)"/.exec(activity);
    if (!inJava) {
      problems.push(`${ACTIVITY}: имя куки выбора языка не объявлено`);
    } else if (inJava[1] !== cookieName[1]) {
      problems.push(
        `${ACTIVITY}: имя куки выбора языка «${inJava[1]}» разошлось с ${LOCALE_COOKIE_SOURCE} ` +
          `(«${cookieName[1]}») — оболочка искала бы куку, которой сайт не ставит`,
      );
    }
  }

  // --- 5. Один словарь, разметка с ним совпадает ----------------------
  const dict = dictionaryStrings(html);
  if (!dict) {
    problems.push(`${ERROR_PAGE}: словарь экрана ошибки не читается`);
  } else {
    for (const locale of declared) {
      if (!dict[locale]) {
        problems.push(`${ERROR_PAGE}: в словаре экрана ошибки нет локали «${locale}»`);
      }
    }
    const markup = markupStrings(html);
    const keys = Object.keys(markup);
    if (keys.length !== 3) {
      problems.push(`${ERROR_PAGE}: видимых строк ${keys.length}, а их обязано быть три`);
    }
    for (const key of keys) {
      const expected = dict.es?.[key];
      if (expected === undefined) {
        problems.push(`${ERROR_PAGE}: строка «${key}» есть в разметке и отсутствует в словаре`);
      } else if (expected !== markup[key]) {
        problems.push(
          `${ERROR_PAGE}: запасная строка «${key}» в разметке разошлась со словарём — ` +
            `«${markup[key]}» против «${expected}»`,
        );
      }
    }
  }

  return problems;
}

/**
 * Состояние `main` на 15.09.2026 — слияние PR #325, последнее до этого
 * захода. Ровно тот код, на котором владелец снял обе жалобы.
 */
const BEFORE_FIX = "fdfc1c4";

/**
 * Копии тех же файлов, лежащие рядом. Имя каталога называет заход.
 *
 * РАСШИРЕНИЕ `.txt`, А НЕ `.java`/`.html`, И ЭТО НЕ КАПРИЗ. Первая
 * редакция назвала копию `MainActivity.java` — и уронила в CI чужой
 * сторож `check:app-id`, который считает файлы с таким именем во всём
 * дереве и требует ровно одного: «забытая копия в старом каталоге пакета
 * собирается вместе с новой». Правило это верное, ослаблять его ради
 * фикстуры нельзя, а фикстура ни во что не собирается — значит менять
 * надо имя, а не правило.
 */
const FIXTURES = {
  [ACTIVITY]: "scripts/fixtures/before-7198/main-activity.before-7198.txt",
  [ERROR_PAGE]: "scripts/fixtures/before-7198/error-page.before-7198.txt",
};

function fileBeforeFix(path) {
  let fixture;
  try {
    fixture = readFileSync(FIXTURES[path], "utf8");
  } catch {
    return null;
  }
  // Второй источник — сама история, если она есть. Расхождение значит,
  // что копия перестала быть тем, что было, и молчать об этом нельзя.
  try {
    const fromGit = execFileSync("git", ["show", `${BEFORE_FIX}:${path}`], { encoding: "utf8" });
    if (fromGit !== fixture) {
      console.log(`  РАСХОЖДЕНИЕ — ${FIXTURES[path]} не совпадает с ${BEFORE_FIX}:${path}`);
      return null;
    }
  } catch {
    // Истории нет (в CI забирается один коммит) — работаем по копии.
  }
  return fixture;
}

export async function main() {
  const plant = process.argv.includes("--plant");
  const sources = Object.fromEntries(
    [ACTIVITY, ERROR_PAGE, I18N, LOCALE_COOKIE_SOURCE].map((f) => [f, read(f)]),
  );

  if (plant) {
    let ok = judge(sources).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровые исходники (отрицательный контроль)`);

    // Контроль первый и главный: НАСТОЯЩИЙ старый код из прибитого коммита.
    const oldActivity = fileBeforeFix(ACTIVITY);
    const oldErrorPage = fileBeforeFix(ERROR_PAGE);
    if (oldActivity === null || oldErrorPage === null) {
      console.log(`  ПРОПУЩЕНО — коммит ${BEFORE_FIX} недоступен, положительный контроль на старом коде не снят`);
      ok = false;
    } else {
      const found = judge({ ...sources, [ACTIVITY]: oldActivity, [ERROR_PAGE]: oldErrorPage });
      const hit = found.length > 0;
      if (!hit) ok = false;
      console.log(
        `  ${hit ? "поймано" : "ПРОПУЩЕНО"} — НАСТОЯЩИЙ код ${BEFORE_FIX} (замер владельца снят на нём): ` +
          `${found.length} нарушени${found.length === 1 ? "е" : "й"}`,
      );
      for (const p of found) console.log(`      · ${p}`);
    }

    const plants = [
      ["куки не пишутся на диск в onPause — выход не переживёт «Недавних»",
        { [ACTIVITY]: sources[ACTIVITY].replace(
          "        super.onPause();\n        CookieManager.getInstance().flush();",
          "        super.onPause();") }],
      ["куки не пишутся на диск в onStop",
        { [ACTIVITY]: sources[ACTIVITY].replace(
          "        super.onStop();\n        CookieManager.getInstance().flush();",
          "        super.onStop();") }],
      ["локаль последней страницы никуда не пишется",
        { [ACTIVITY]: sources[ACTIVITY].replace("putString(PREF_LOCALE", "неПишем(PREF_LOCALE") }],
      ["локаль снова берётся из языка телефона",
        { [ACTIVITY]: sources[ACTIVITY].replace(
          'if (path.equals("/es") || path.startsWith("/es/")) {',
          'if (Locale.getDefault() != null) {') }],
      ["в оболочке появилась третья локаль, которой нет в i18n",
        { [ACTIVITY]: sources[ACTIVITY].replace('return "ru";', 'return "en";') }],
      ["язык перестал доезжать до экрана ошибки",
        { [ACTIVITY]: sources[ACTIVITY].replace(/__rfApplyLocale/g, "__ничего") }],
      ["экран ошибки больше не принимает язык от оболочки",
        { [ERROR_PAGE]: sources[ERROR_PAGE].replace("window.__rfApplyLocale = applyLocale;", "") }],
      ["русской половины словаря экрана ошибки не стало",
        { [ERROR_PAGE]: sources[ERROR_PAGE].replace(/\n        ru: \{[\s\S]*?\n        \},/, "") }],
      ["запасная строка в разметке разошлась со словарём",
        { [ERROR_PAGE]: sources[ERROR_PAGE].replace(
          ">No pudimos abrir la aplicación<", ">Algo salió mal<") }],
      ["у экрана ошибки появилась четвёртая видимая строка мимо словаря",
        { [ERROR_PAGE]: sources[ERROR_PAGE].replace(
          '<button type="button" id="retry">',
          '<p data-i18n="extra">Texto suelto</p>\n    <button type="button" id="retry">') }],
      ["выбор человека не читается вовсе — остался только след полной навигации (состояние 7.198)",
        { [ACTIVITY]: sources[ACTIVITY].replace(
          "private String chosenLocaleFromCookies()", "private String неЧитаемВыбор()") }],
      ["выбор спрашивается ПОСЛЕ следа навигации — выбранный русский снова проигрывает",
        { [ACTIVITY]: sources[ACTIVITY].replace(
          "        String locale = chosenLocaleFromCookies();\n        if (locale == null) {\n            locale = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(PREF_LOCALE, null);\n        }",
          "        String locale = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(PREF_LOCALE, null);\n        if (locale == null) {\n            locale = chosenLocaleFromCookies();\n        }") }],
      ["кука спрашивается по ЛОКАЛЬНОМУ адресу экрана ошибки, а не по боевому",
        { [ACTIVITY]: sources[ACTIVITY].replace(
          "String serverUrl = getBridge().getServerUrl();", 'String serverUrl = "https://localhost";') }],
      ["значение куки проверяется своим списком локалей, а не общим localeOf",
        { [ACTIVITY]: sources[ACTIVITY].replace(
          'return localeOf("/" + pair.substring(eq + 1).trim());',
          "return pair.substring(eq + 1).trim();") }],
      ["имя куки в оболочке разошлось с именем на сайте",
        { [ACTIVITY]: sources[ACTIVITY].replace(
          'private static final String LOCALE_COOKIE = "rf-lang";',
          'private static final String LOCALE_COOKIE = "rf-locale";') }],
      ["имя куки переехало на сайте, а в оболочке осталось прежним",
        { [LOCALE_COOKIE_SOURCE]: sources[LOCALE_COOKIE_SOURCE].replace(
          'export const LOCALE_COOKIE = "rf-lang";', 'export const LOCALE_COOKIE = "rf-idioma";') }],
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
        ? `check:shell-session-locale --plant — ${caught} из ${plants.length} подсадок, ` +
            `1 из 1 отрицательный контроль, 1 из 1 положительный на настоящем коде ${BEFORE_FIX}`
        : `check:shell-session-locale --plant — FAILED (${caught} из ${plants.length})`,
    );
    return ok ? 0 : 1;
  }

  const problems = judge(sources);
  if (problems.length) {
    console.error("ОБОЛОЧКА: СЕССИЯ И ЯЗЫК:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(
    "check:shell-session-locale — хранилище кук пишется на диск в onPause и onStop; локаль последней " +
      "страницы берётся из адреса и запоминается; список локалей совпадает с src/i18n/config.ts; язык " +
      "доезжает до локального экрана ошибки через его собственную точку входа; язык этого экрана берётся " +
      "СНАЧАЛА из выбора человека (кука rf-lang боевого источника, имя сверено с src/lib/remembered-locale.ts) " +
      "и только потом из следа последней полной навигации; обе локали экрана ошибки " +
      "лежат в одном словаре, и все три видимые строки разметки совпадают с ним знак в знак. " +
      "Контроль — --plant.",
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
