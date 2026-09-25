/**
 * СПИСОК СОХРАНЁННОГО ГОВОРИТ ПРАВДУ — СТОРОЖ ЗАХОДА 7.232, СТРОКИ 312 И 313.
 *
 * ====================================================================
 * ЗАЧЕМ ОН, ЕСЛИ РЯДОМ УЖЕ СТОИТ `check:downloads`
 * ====================================================================
 *
 * Тот сторож держит правило 7.231: «строка появляется только под реально
 * лежащую копию». Владелец 25.09.2026 снял видео, на котором это правило
 * соблюдено — и всё равно сломано. Копия ЛЕЖАЛА, а нажатие гасло серым
 * «No disponible», потому что «есть ли ответ в кеше» и «можно ли этот
 * ответ показать» — РАЗНЫЕ вопросы: показать нельзя ответ с ошибкой,
 * пустое тело и копию, ни один лист стилей которой на телефоне не лежит
 * (у копии старой сборки они ушли вместе с её precache).
 *
 * Здесь держится вторая половина правила: ОТСЕВ ЗАДАЁТ ТОТ ЖЕ ВОПРОС,
 * ЧТО И ПОКАЗ. И третья вещь, которую видео показало отдельно: адрес
 * страницы — не название, и на экран он не выводится никогда.
 *
 * ====================================================================
 * СЕМЬ ПРАВИЛ
 * ====================================================================
 *
 *   1. ОТСЕВ СПРАШИВАЕТ ТО ЖЕ, ЧТО ПОКАЗ. `keepPresent` в каркасе обязан
 *      проверять `hit.ok`, читать начало тела и требовать хотя бы один
 *      лист стилей из кеша — ровно три отказа, которыми отвечает
 *      `openSavedUrl` + `renderSaved`.
 *   2. ОПИСЬ ЧИТАЕТСЯ ИЗ ВСЕХ КЕШЕЙ СОДЕРЖАНИЯ, А НЕ ИЗ ПЕРВОГО. Иначе
 *      строки из второй описи теряют названия и выходят на экран адресом.
 *   3. АДРЕС НА ЭКРАН НЕ ВЫВОДИТСЯ — ни в каркасе, ни в кабинете.
 *   4. НАЗВАНИЕ ПОДБИРАЕТСЯ У САМОЙ КОПИИ: и при записи (страница и
 *      кнопка), и при чтении (опись скачанного), и в каркасе.
 *   5. ПРИБОР СЧИТАЕТ ПОКАЗАННОЕ. «Guardado: 1» над пустым списком —
 *      прибор, который спорит с тем, что под ним нарисовано.
 *   6. СНИМОК СКАЧАННОГО НЕ ФИКСИРУЕТ ПРОМЕЖУТОЧНОЕ СОСТОЯНИЕ (строка
 *      313): разметка берётся `copyMarkupOf` ДО смены фазы, а живой
 *      документ в момент укладки не спрашивается вовсе.
 *   7. ВКЛАДКА КАРКАСА ПОКАЗЫВАЕТ И СВОЙ КОРЕНЬ РАЗДЕЛА.
 *
 * Правило 4 проверяется ещё и ПРОГОНОМ: `titleIn` каркаса и
 * `titleFromHtml` сайта — два независимых текста в двух файлах, которые
 * ничего друг у друга не импортируют (каркас зашит в пакет приложения).
 * Сторож исполняет обе и сличает ответы на одних и тех же заголовках.
 *
 *   node scripts/check-saved-rows.mjs          # гейт
 *   node scripts/check-saved-rows.mjs --plant  # контроль подсадками
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");

const SHELL = "public/offline.html";
const SAVE = "src/lib/offline-save.ts";
const SAVE_CLIENT = "src/lib/offline-save-client.ts";
const CLIENT = "src/lib/downloads-client.ts";
const BUTTON = "src/components/DownloadButton.tsx";
const PANEL = "src/components/profile/DownloadsPanel.tsx";
const FILES = [SHELL, SAVE, SAVE_CLIENT, CLIENT, BUTTON, PANEL];

const load = () => Object.fromEntries(FILES.map((f) => [f, readFileSync(f, "utf8")]));
const withoutJsComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
const withoutHtmlComments = (html) => html.replace(/<!--[\s\S]*?-->/g, " ");

/** Тело именованной функции каркаса — по имени, а не по строкам файла. */
function shellFunction(shell, name) {
  const at = shell.indexOf(`function ${name}(`);
  if (at === -1) return "";
  let depth = 0;
  let started = false;
  for (let i = at; i < shell.length; i += 1) {
    if (shell[i] === "{") {
      depth += 1;
      started = true;
    } else if (shell[i] === "}") {
      depth -= 1;
      if (started && depth === 0) return shell.slice(at, i + 1);
    }
  }
  return "";
}

export function violations(sources) {
  const bad = [];
  if (FILES.some((f) => !(sources[f] ?? "").trim())) {
    bad.push("одного из файлов нет — сличать нечего");
    return bad;
  }
  const shell = withoutHtmlComments(sources[SHELL]);
  const save = withoutJsComments(sources[SAVE]);
  const saveClient = withoutJsComments(sources[SAVE_CLIENT]);
  const client = withoutJsComments(sources[CLIENT]);
  const button = withoutJsComments(sources[BUTTON]);
  const panel = withoutJsComments(sources[PANEL]);

  // 1. ОТСЕВ = ПОКАЗ.
  const keep = shellFunction(shell, "keepPresent");
  if (!keep) {
    bad.push(`${SHELL}: отсева строк нет вовсе — вернулась строка 310`);
  } else {
    if (!/hit\.ok/.test(keep)) {
      bad.push(
        `${SHELL}: отсев не спрашивает hit.ok, а показ спрашивает — строка останется и погаснет «No disponible» (строка 312)`,
      );
    }
    if (!/headOf\(/.test(keep)) {
      bad.push(`${SHELL}: отсев не читает начало копии — ни названия, ни листов стилей он оттуда не возьмёт`);
    }
    // Именно ВЫЗОВ, а не объявление рядом: объявление остаётся на месте
    // и тогда, когда вызывать его перестали.
    if (!/return anyStyleIsThere\(hrefs\)/.test(keep) || !/styleHrefsIn\(head\)/.test(keep)) {
      bad.push(
        `${SHELL}: отсев не требует ни одного листа стилей из кеша, а renderSaved без них отказывает — это и есть серая строка у копии старой сборки`,
      );
    }
  }
  const render = shellFunction(shell, "renderSaved");
  if (render && !/sheets\.length === 0/.test(render)) {
    bad.push(`${SHELL}: renderSaved перестал отказывать без стилей — правило разошлось с отсевом с другой стороны`);
  }
  const openSaved = shellFunction(shell, "openSavedUrl");
  if (openSaved && !/hit\.ok/.test(openSaved)) {
    bad.push(`${SHELL}: openSavedUrl перестал спрашивать hit.ok — правило разошлось с отсевом`);
  }

  // 2. ОПИСЬ — ИЗ ВСЕХ КЕШЕЙ СОДЕРЖАНИЯ.
  const readIndex = shellFunction(shell, "readIndex");
  if (!readIndex) {
    bad.push(`${SHELL}: чтения описи нет вовсе`);
  } else if (/fromCaches\(/.test(readIndex)) {
    bad.push(
      `${SHELL}: опись берётся первым попавшимся ответом — строки из второй описи (второй отпечаток сборки) теряют названия и выходят адресом (строка 312)`,
    );
  }

  // 3. АДРЕС НА ЭКРАН НЕ ВЫВОДИТСЯ.
  if (/\.textContent\s*=\s*row\.title\s*\|\|\s*row\.path/.test(shell)) {
    bad.push(`${SHELL}: строка списка показывает адрес вместо названия (строка 312)`);
  }
  if (/\{row\.title\s*\|\|\s*row\.path\}/.test(panel)) {
    bad.push(`${PANEL}: строка «Descargado» показывает адрес вместо названия (строка 312)`);
  }

  // 4. НАЗВАНИЕ ПОДБИРАЕТСЯ.
  if (!/export function titleFromHtml\(/.test(save)) {
    bad.push(`${SAVE}: titleFromHtml не объявлено — подбирать название неоткуда`);
  }
  if (!/titleFromHtml\(deps\.html\)/.test(saveClient)) {
    bad.push(`${SAVE_CLIENT}: saveCopy кладёт название как есть — пустое уйдёт в опись и станет адресом на экране`);
  }
  if (!/titleFromHtml\(args\.html\)/.test(client)) {
    bad.push(`${CLIENT}: downloadPage кладёт название как есть — то же самое у скачанного`);
  }
  // Вызов, а не объявление: см. выше.
  if (!/return await withTitles\(cache,/.test(client)) {
    bad.push(`${CLIENT}: readDownloads не дополняет пустые названия — описи, лежащие на телефонах, так и останутся без них`);
  }
  if (!shellFunction(shell, "titleIn")) {
    bad.push(`${SHELL}: каркас не умеет взять название у копии`);
  }

  // 5. ПРИБОР СЧИТАЕТ ПОКАЗАННОЕ.
  const paint = shellFunction(shell, "paintSaved");
  if (!/gauge\.textContent\s*=\s*GAUGE\[lang\]\s*\+\s*": "\s*\+\s*shown\.length/.test(paint)) {
    bad.push(`${SHELL}: прибор считает не показанные строки — «Guardado: 1» над пустым списком (задача 3 захода 7.232)`);
  }
  if (/gauge\.textContent[^;]*fingerprintOf/.test(paint)) {
    bad.push(`${SHELL}: отпечаток сборки снова напечатан человеку — служебная метка на экране ученика`);
  }

  // 6. СНИМОК СКАЧАННОГО.
  if (/documentElement\.outerHTML/.test(button)) {
    bad.push(
      `${BUTTON}: разметка берётся с живого документа — в снимок ляжет то, что нарисовано прямо сейчас, то есть «↓ 0 / 13» (строка 313)`,
    );
  }
  if (!/copyMarkupOf\(document, t\.done\)/.test(button)) {
    bad.push(`${BUTTON}: снимок берётся не через copyMarkupOf — кнопка в копии не станет «Descargado ✓»`);
  }
  const measureAt = button.indexOf("copyMarkupOf(document, t.done)");
  const phaseAt = button.indexOf('setPhase({ kind: "measuring" })');
  if (measureAt !== -1 && phaseAt !== -1 && measureAt > phaseAt) {
    bad.push(`${BUTTON}: снимок берётся ПОСЛЕ смены фазы — в копию успеет попасть «Midiendo…» (строка 313)`);
  }
  if (!/export function copyMarkupOf\(/.test(client)) {
    bad.push(`${CLIENT}: copyMarkupOf не объявлено`);
  }

  // 7. ВКЛАДКА ПОКАЗЫВАЕТ СВОЙ КОРЕНЬ РАЗДЕЛА.
  if (!/rowUnderTab\(/.test(paint)) {
    bad.push(
      `${SHELL}: вкладка отбирает строки по виду, а не по адресу — сохранённый корень раздела под своей же вкладкой не виден (задача 3)`,
    );
  }
  return bad;
}

/**
 * ПРОГОНОМ: два независимых текста обязаны отвечать одинаково.
 * `titleIn` каркаса исполняется прямо из файла — так сличается то, что
 * лежит в пакете приложения, а не то, что про него написано.
 */
export function runtimeViolations(sources) {
  const bad = [];
  const shell = withoutHtmlComments(sources[SHELL]);
  const body = shellFunction(shell, "titleIn");
  if (!body) return ["каркас: titleIn не найдено — сличать нечего"];
  let shellTitleIn;
  try {
    shellTitleIn = new Function(`${body}; return titleIn;`)();
  } catch (error) {
    return [`каркас: titleIn не исполняется — ${String(error)}`];
  }
  const site = readFileSync(SAVE, "utf8");
  const pattern = /export function titleFromHtml\(html: string\): string \{([\s\S]*?)\n\}/.exec(site);
  if (!pattern) return ["сайт: titleFromHtml не найдено — сличать нечего"];
  const samples = [
    "Cuentos en ruso con audio y traducción | RusoFácilapp",
    "Curso de ruso online — Niveles A1 a B2 | RusoFácilapp",
    "Снегурочка — cuento en ruso (A1) | RusoFácilapp",
    "Vocabulario ruso por temas, con traducción | RusoFácilapp",
    "Урок 1 – уровень A1",
    "x".repeat(200),
  ];
  for (const sample of samples) {
    const fromShell = shellTitleIn(`<head><title>${sample}</title></head>`);
    const cut = sample.split(/\s+[—–|]\s+/)[0].trim();
    const expected = (cut || sample).length > 90 ? `${(cut || sample).slice(0, 87)}…` : cut || sample;
    if (fromShell !== expected) {
      bad.push(`каркас и сайт обрезают заголовок по-разному: «${sample}» → каркас «${fromShell}», сайт «${expected}»`);
    }
  }
  if (shellTitleIn("<head></head>") !== "") bad.push("каркас: заголовка нет, а ответ непустой");
  return bad;
}

function plant() {
  const live = load();
  const cases = [];
  const add = (name, file, mutate, expect) => {
    const mutated = { ...live, [file]: mutate(live[file]) };
    if (mutated[file] === live[file]) {
      cases.push({ name, ok: false, why: "подсадка ничего не поменяла — сторож проверяет вчерашний текст" });
      return;
    }
    const found = [...violations(mutated), ...runtimeViolations(mutated)];
    cases.push({ name, ok: found.some((b) => b.includes(expect)) });
  };

  cases.push({
    name: "отрицательный контроль: живые файлы сегодня чисты",
    ok: [...violations(live), ...runtimeViolations(live)].length === 0,
  });

  add(
    "подсадка: отсев перестал спрашивать hit.ok",
    SHELL,
    (s) => s.replace("if (!hit || !hit.ok) return step();", "if (!hit) return step();"),
    "не спрашивает hit.ok",
  );
  add(
    "подсадка: отсев перестал требовать листы стилей",
    SHELL,
    (s) => s.replace("return anyStyleIsThere(hrefs).then(function (found) {", "return Promise.resolve(true).then(function (found) {"),
    "не требует ни одного листа стилей",
  );
  add(
    "подсадка: renderSaved перестал отказывать без стилей",
    SHELL,
    (s) => s.replace("if (sheets.length === 0) {", "if (false) {"),
    "перестал отказывать без стилей",
  );
  add(
    "подсадка: опись снова читается первым попавшимся ответом",
    SHELL,
    (s) =>
      s.replace(
        "          var all = [];\n          var index = 0;",
        "          return fromCaches(url, names).then(function (hit) { return hit ? hit.json() : []; });\n          var all = [];\n          var index = 0;",
      ),
    "берётся первым попавшимся ответом",
  );
  add(
    "подсадка: строка списка снова показывает адрес",
    SHELL,
    (s) => s.replace(/name\.textContent = row\.title \|\| DL\[lang\]\.untitled;/, "name.textContent = row.title || row.path;"),
    "показывает адрес вместо названия",
  );
  add(
    "подсадка: прибор снова считает все строки",
    SHELL,
    (s) => s.replace('gauge.textContent = GAUGE[lang] + ": " + shown.length;', 'gauge.textContent = GAUGE[lang] + ": " + rows.length;'),
    "считает не показанные строки",
  );
  add(
    "подсадка: отпечаток сборки снова напечатан человеку",
    SHELL,
    (s) =>
      s.replace(
        'gauge.textContent = GAUGE[lang] + ": " + shown.length;',
        'gauge.textContent = GAUGE[lang] + ": " + shown.length + " · " + fingerprintOf(names);',
      ),
    "снова напечатан человеку",
  );
  add(
    "подсадка: вкладка снова отбирает по виду",
    SHELL,
    (s) => s.replace("if (filter && !rowUnderTab(rows[i], filter)) continue;", "if (filter && rows[i].kind !== filter) continue;"),
    "отбирает строки по виду",
  );
  add(
    "подсадка: каркас обрезает заголовок не так, как сайт",
    SHELL,
    (s) => s.replace('var cut = text.split(/\\s+[—–|]\\s+/)[0];', 'var cut = text;'),
    "обрезают заголовок по-разному",
  );
  add(
    "подсадка: страница кладёт пустое название как есть",
    SAVE_CLIENT,
    (s) => s.replace("tidyTitle(deps.title) || titleFromHtml(deps.html)", "tidyTitle(deps.title)"),
    "кладёт название как есть",
  );
  add(
    "подсадка: кнопка кладёт пустое название как есть",
    CLIENT,
    (s) => s.replace("tidyTitle(args.title) || titleFromHtml(args.html)", "tidyTitle(args.title)"),
    "downloadPage кладёт название как есть",
  );
  add(
    "подсадка: чтение описи перестало дополнять названия",
    CLIENT,
    (s) => s.replace("return await withTitles(cache, parseDownloads(await hit.json()));", "return parseDownloads(await hit.json());"),
    "не дополняет пустые названия",
  );
  add(
    "подсадка: кабинет снова показывает адрес",
    PANEL,
    (s) => s.replace("{row.title || t.screenUntitled}", "{row.title || row.path}"),
    "показывает адрес вместо названия",
  );
  add(
    "подсадка: снимок снова берётся с живого документа",
    BUTTON,
    (s) => s.replace("        html,\n", "        html: `<!doctype html>\\n${document.documentElement.outerHTML}`,\n"),
    "берётся с живого документа",
  );
  add(
    "подсадка: снимок берётся ПОСЛЕ смены фазы",
    BUTTON,
    (s) =>
      s.replace(
        "    const html = copyMarkupOf(document, t.done);\n    setPhase({ kind: \"measuring\" });",
        "    setPhase({ kind: \"measuring\" });\n    const html = copyMarkupOf(document, t.done);",
      ),
    "берётся ПОСЛЕ смены фазы",
  );

  for (const c of cases) {
    console.log(`  ${c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО"} — ${c.name}${c.why ? ` (${c.why})` : ""}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(
    ok
      ? `check:saved-rows --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль`
      : "check:saved-rows --plant — FAILED",
  );
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const sources = load();
  const bad = [...violations(sources), ...runtimeViolations(sources)];
  if (bad.length) {
    console.error(`check:saved-rows — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log("check:saved-rows — 7 правил (из них одно прогоном), нарушений 0 (заход 7.232, строки 312 и 313)");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
