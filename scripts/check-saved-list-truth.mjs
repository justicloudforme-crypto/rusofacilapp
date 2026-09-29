/**
 * СПИСОК «GUARDADO» НЕ СПОРИТ С ТЕМ, ЧТО НИЖЕ, И НЕ ДВОИТ СТРАНИЦУ —
 * СТОРОЖ ЗАХОДА 7.248 (Ж.3 и Р16 аудита 7.241).
 *
 * Замеры на эмуляторе 28.09.2026 (1.0.12 + прод), без сети:
 *   * Ж.3 — вкладка «Vocabulario» при одном скачанном рассказе: «Aún no
 *     hay nada guardado en este teléfono», а под ней «Descargado: Репка ·
 *     1,6 MB». Список вкладки отфильтрован, скачанное — нет.
 *   * Р16 — `/es/vocabulary` и два перехода поиска на идиомы
 *     (`/es/vocabulary?mode=idioms#idiom-…`): ТРИ одинаковые строки
 *     «Vocabulario ruso por temas, con traducción · Vocabulario · ES».
 *
 * Правила:
 *   1) фраза «на телефоне ничего нет» — только когда строк нет вовсе;
 *      под вкладкой без своих строк — отдельная фраза про раздел (es/ru);
 *   2) строки одной страницы (путь без `?…`/`#…`) склеиваются ПОСЛЕ
 *      отсева по факту, скачанная побеждает; разные пути с одинаковым
 *      названием — не склеиваются.
 * Правило 2 проверяется ИСПОЛНЕНИЕМ настоящих функций каркаса на
 * выборке; пустая выборка или пропавшая функция — нарушение, а не «чисто».
 *
 *   node scripts/check-saved-list-truth.mjs          # гейт
 *   node scripts/check-saved-list-truth.mjs --plant  # контроль подсадками
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const SHELL = "public/offline.html";

function fnBody(code, name) {
  const at = code.indexOf(`function ${name}(`);
  if (at === -1) return "";
  let depth = 0;
  for (let i = code.indexOf("{", at); i < code.length; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}" && --depth === 0) return code.slice(at, i + 1);
  }
  return "";
}

/** Выборка: что было на эмуляторе (Р16) плюс оба контроля. */
const O = "https://rusofacilapp.com";
const SAMPLE = [
  { url: `${O}/es/vocabulary?mode=idioms#idiom-bbb`, title: "Vocabulario ruso por temas, con traducción" },
  { url: `${O}/es/vocabulary?mode=idioms#idiom-aaa`, title: "Vocabulario ruso por temas, con traducción" },
  { url: `${O}/es/vocabulary`, title: "Vocabulario ruso por temas, con traducción" },
  { url: `${O}/es/vocabulary/comida`, title: "Vocabulario ruso por temas, con traducción" },
  { url: `${O}/ru/vocabulary`, title: "Vocabulario ruso por temas, con traducción" },
  { url: `${O}/es/stories/abc`, title: "Репка" },
  { url: `${O}/es/stories/abc/`, title: "Репка", downloaded: true },
];

/** Исполнить склейку каркаса на выборке. null — исполнить нечем. */
export function runCollapse(shell, rows) {
  const key = fnBody(shell, "pageKeyOf");
  const collapse = fnBody(shell, "collapseSamePage");
  if (!key || !collapse) return null;
  const make = new Function("location", `${key}\n${collapse}\nreturn collapseSamePage;`);
  return make({ href: `${O}/es` })(rows.map((r) => ({ ...r })));
}

export function violationsIn(shell) {
  const bad = [];
  const paint = fnBody(shell, "paintSaved");
  if (!paint) {
    bad.push(`${SHELL}: paintSaved не найден — сторож ослеп`);
  } else {
    if (!/\[data-saved-empty-tab\]/.test(paint)) {
      bad.push(`${SHELL}: у пустой вкладки нет своей фразы — «Aún no hay nada guardado en este teléfono» рядом с «Descargado» (Ж.3)`);
    }
    if (!/shown\.length === 0 && rows\.length === 0/.test(paint) || /empty\.hidden = shown\.length !== 0;/.test(paint)) {
      bad.push(`${SHELL}: фраза «на телефоне ничего нет» зависит от отфильтрованного списка, а не от всех строк (Ж.3)`);
    }
  }
  const tabText = /<p class="empty" data-saved-empty-tab hidden>([\s\S]*?)<\/p>/.exec(shell);
  if (!tabText) bad.push(`${SHELL}: разметки фразы пустой вкладки нет (Ж.3)`);
  else {
    if (!/lang="es" data-locale="es">En esta sección aún no hay nada guardado\.</.test(tabText[1])) bad.push(`${SHELL}: es-фраза пустой вкладки не та (Ж.3)`);
    if (!/lang="ru" data-locale="ru">В этом разделе пока ничего не сохранено\.</.test(tabText[1])) bad.push(`${SHELL}: ru-фраза пустой вкладки не та (Ж.3)`);
  }
  const after = fnBody(shell, "savedRowsAfterDownloads");
  if (!/keepPresent\(clean, names\)\.then\(collapseSamePage\)/.test(after)) {
    bad.push(`${SHELL}: строки одной страницы не склеиваются после отсева — три одинаковые «Vocabulario…» (Р16)`);
  }
  const out = runCollapse(shell, SAMPLE);
  if (out === null) {
    bad.push(`${SHELL}: склейки (pageKeyOf/collapseSamePage) нет — исполнить нечего (Р16)`);
  } else {
    const urls = out.map((r) => r.url.replace(O, ""));
    const want = ["/es/vocabulary?mode=idioms#idiom-bbb", "/es/vocabulary/comida", "/ru/vocabulary", "/es/stories/abc/"];
    if (out.length === 0) bad.push("склейка вернула ПУСТОЙ список на непустой выборке — сравнивать нечего");
    else if (JSON.stringify(urls) !== JSON.stringify(want)) {
      bad.push(`склейка на выборке дала ${JSON.stringify(urls)}, ожидалось ${JSON.stringify(want)} (свежая строка страницы, разные пути и языки не склеены, скачанная побеждает)`);
    }
  }
  return bad;
}

function plant() {
  const raw = readFileSync(SHELL, "utf8");
  const cases = [];
  const planted = (from, to, name, expect) => {
    const mutated = raw.replace(from, to);
    if (mutated === raw) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violationsIn(mutated).some((f) => f.includes(expect)) });
  };
  cases.push({ name: "отрицательный контроль: живой каркас сегодня чист", ok: violationsIn(raw).length === 0 });
  cases.push({ name: "пустой вход — сторож краснеет, а не молчит", ok: violationsIn("").length >= 3 });
  planted(
    "var phoneEmpty = shown.length === 0 && rows.length === 0;\n          empty.hidden = !phoneEmpty;",
    "var phoneEmpty = shown.length === 0 && rows.length === 0;\n          empty.hidden = shown.length !== 0;",
    "подсадка: фраза про телефон снова по отфильтрованному списку (как на 1.0.12) — поймано",
    "зависит от отфильтрованного",
  );
  planted('var emptyTab = document.querySelector("[data-saved-empty-tab]");', "var emptyTab = null;", "подсадка: у вкладки нет своей фразы — поймано", "своей фразы");
  planted("En esta sección aún no hay nada guardado.", "Aún no hay nada guardado.", "подсадка: es-фраза изменена — поймано", "es-фраза");
  planted("keepPresent(clean, names).then(collapseSamePage)", "keepPresent(clean, names)", "подсадка: склейка не вызывается (как на 1.0.12) — поймано", "не склеиваются после отсева");
  planted('return parsed.origin + parsed.pathname.replace(/\\/+$/, "");', "return parsed.href;", "подсадка: ключ по полному адресу — выборка ловит три строки", "склейка на выборке");
  planted("} else if (rows[i].downloaded && !out[at[key]].downloaded) {", "} else if (false) {", "подсадка: скачанная строка не побеждает — поймано", "склейка на выборке");
  planted("return parsed.origin + parsed.pathname", "return parsed.origin + parsed.pathname.split('/').slice(0, 3).join('/') + ''; parsed.pathname", "подсадка: склейка по разделу (разные страницы в одну) — поймано", "склейка на выборке");
  const empty = runCollapse(raw, []);
  cases.push({ name: "исполнение на ПУСТОЙ выборке — пусто (сравнение до/после на пустом не выдаётся за успех)", ok: Array.isArray(empty) && empty.length === 0 });
  cases.push({ name: "склейка без функции — null, и это нарушение", ok: runCollapse("", SAMPLE) === null && violationsIn("").some((f) => f.includes("исполнить нечего")) });

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:saved-list-truth --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const bad = violationsIn(readFileSync(SHELL, "utf8"));
  if (bad.length) {
    console.error("СПИСОК СОХРАНЁННОГО СНОВА ВРЁТ (Ж.3 / Р16):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(
    "[check:saved-list-truth] «ничего на телефоне» — только при пустом телефоне, у вкладки своя фраза; одна страница — одна строка, скачанная побеждает (выборка исполнена; контроль — --plant).",
  );
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
