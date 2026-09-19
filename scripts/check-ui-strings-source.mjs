/**
 * У ИНТЕРФЕЙСНОЙ СТРОКИ ОДИН ИСТОЧНИК — ДОЛГ 23 (заход 7.217).
 *
 * Строка долга дословно: «интерфейсные строки живут в двух местах:
 * `src/dictionaries/*.json` и `src/lib/ui-strings.ts` (19 строк для
 * клиентских компонентов) → третья локаль либо переработка цепочки
 * `GlossaryText → GlossaryTermPopover` → свести к одному источнику;
 * раньше не трогать — сегодня это 19 строк и два теста».
 *
 * Источник сведён к словарям: `src/lib/ui-strings.ts` собирается из ветки
 * `clientUi` обоих словарей скриптом `scripts/build-ui-strings.mjs`.
 * Сторож держит это правдой, а не соглашением.
 *
 * ТРИ ПРАВИЛА:
 *   а) собранный файл совпадает со словарями ЗНАК В ЗНАК — иначе правка
 *      руками переживёт мерж и второе место вернётся;
 *   б) у файла стоит шапка «НЕ ПРАВИТЬ РУКАМИ» — человек, открывший его,
 *      обязан узнать об этом раньше, чем начнёт печатать;
 *   в) ветка `clientUi` есть в КАЖДОМ словаре: локаль, которой её не
 *      завели, молча получила бы испанские подписи.
 *
 * ЧИСЛО, КОТОРОЕ ПЕЧАТАЕТСЯ: сколько подписей в ветке. Строка долга
 * называла 19, и это число теперь считается, а не помнится.
 *
 *   node scripts/check-ui-strings-source.mjs          # гейт
 *   node scripts/check-ui-strings-source.mjs --plant  # контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { CLIENT_UI_KEY, render } from "./build-ui-strings.mjs";

const PLANT = process.argv.slice(2).includes("--plant");
const OUT = "src/lib/ui-strings.ts";
const LOCALES = ["es", "ru"];

function leafCount(node) {
  let n = 0;
  for (const v of Object.values(node)) n += typeof v === "string" ? 1 : leafCount(v);
  return n;
}

export function violations(dictionaries, generated) {
  const bad = [];
  const byLocale = {};
  for (const lang of LOCALES) {
    const block = dictionaries[lang]?.[CLIENT_UI_KEY];
    if (!block) {
      bad.push(`src/dictionaries/${lang}.json: ветки "${CLIENT_UI_KEY}" нет — эта локаль молча получит чужие подписи (долг 23)`);
      continue;
    }
    byLocale[lang] = block;
  }
  if (bad.length) return bad;

  if (!/НЕ ПРАВИТЬ РУКАМИ/.test(generated.split("\n").slice(0, 3).join("\n"))) {
    bad.push(`${OUT}: шапки «НЕ ПРАВИТЬ РУКАМИ» нет — файл снова читается как место, где строку можно завести (долг 23)`);
  }
  const want = render(byLocale);
  if (want !== generated) {
    bad.push(`${OUT}: разошёлся со словарями — второе место для интерфейсной строки вернулось (долг 23). Пересобрать: npm run ui-strings:build`);
  }
  return bad;
}

function live() {
  const dictionaries = {};
  for (const lang of LOCALES) dictionaries[lang] = JSON.parse(readFileSync(`src/dictionaries/${lang}.json`, "utf8"));
  return { dictionaries, generated: readFileSync(OUT, "utf8") };
}

function plant() {
  const { dictionaries, generated } = live();
  const clone = () => JSON.parse(JSON.stringify(dictionaries));
  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(dictionaries, generated).length === 0 }];
  const add = (name, d, g, expect) => {
    if (JSON.stringify(d) === JSON.stringify(dictionaries) && g === generated) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(d, g).some((x) => x.includes(expect)) });
  };

  const changedDict = clone();
  changedDict.ru[CLIENT_UI_KEY].glossary.appearsIn = "ПОДСАЖЕНО";
  add("подсадка: строку поправили в словаре и забыли пересобрать", changedDict, generated, "разошёлся со словарями");

  add(
    "подсадка: строку поправили РУКАМИ в собранном файле (ровно второе место из долга 23)",
    dictionaries,
    generated.replace('"Послушать по-русски"', '"ПОДСАЖЕНО"'),
    "разошёлся со словарями",
  );
  add("подсадка: шапка «НЕ ПРАВИТЬ РУКАМИ» снята", dictionaries, generated.replace("НЕ ПРАВИТЬ РУКАМИ", "справочно"), "шапки");

  const noBranch = clone();
  delete noBranch.ru[CLIENT_UI_KEY];
  add("подсадка: у локали нет ветки clientUi вовсе", noBranch, generated, `ветки "${CLIENT_UI_KEY}" нет`);

  for (const c of cases) {
    const verdict = c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО";
    console.log(`  ${verdict} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `check:ui-strings-source --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль` : "check:ui-strings-source --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const { dictionaries, generated } = live();
  const bad = violations(dictionaries, generated);
  if (bad.length) {
    console.error(`check:ui-strings-source — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  const n = leafCount(dictionaries.es[CLIENT_UI_KEY]);
  console.log(
    `check:ui-strings-source — источник один: словари. Подписей в ветке "${CLIENT_UI_KEY}" ${n}, локалей ${LOCALES.length}, нарушений 0 (долг 23)`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
