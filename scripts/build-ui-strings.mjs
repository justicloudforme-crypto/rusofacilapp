/**
 * ИНТЕРФЕЙСНЫЕ СТРОКИ ЖИВУТ В ОДНОМ МЕСТЕ — ДОЛГ 23 (заход 7.217).
 *
 * Строка долга дословно: «интерфейсные строки живут в двух местах:
 * `src/dictionaries/*.json` и `src/lib/ui-strings.ts` (19 строк для
 * клиентских компонентов) → третья локаль либо переработка цепочки
 * `GlossaryText → GlossaryTermPopover` → свести к одному источнику;
 * раньше не трогать — сегодня это 19 строк и два теста».
 *
 * ЧТО СДЕЛАНО И ПОЧЕМУ ИМЕННО ТАК. Свести к одному источнику можно было
 * тремя способами, и два из них плохи по замеренной причине:
 *
 *   1. импортировать словари в клиентском модуле — нельзя: es.json и
 *      ru.json это 70 КиБ и 94 КиБ, и обе локали уехали бы в браузер
 *      каждому посетителю ради девятнадцати подписей;
 *   2. протащить `lang` через всю цепочку `GrammarTab → SlidesTab →
 *      GlossaryText → GlossaryTermPopover → GlossaryTermCardBody` —
 *      переработка, от которой сама строка долга и просила воздержаться;
 *   3. ОСТАВИТЬ клиентский модуль, но сделать его ПРОИЗВОДНЫМ: источник
 *      один — словари, — а `src/lib/ui-strings.ts` собирается из них этим
 *      скриптом и сверяется сторожем `check:ui-strings-source`.
 *
 * Выбран третий. Третья локаль теперь заводится добавлением файла словаря
 * и одной строки в `LOCALES` ниже; руками переписывать нечего, и
 * разойтись двум местам больше нечем — второго МЕСТА нет, есть место и
 * его отпечаток.
 *
 *   node scripts/build-ui-strings.mjs          # пересобрать
 *   node scripts/build-ui-strings.mjs --check  # сверить, ничего не писать
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Ветка словаря, которая уезжает клиентским компонентам. Одна на всё. */
export const CLIENT_UI_KEY = "clientUi";
const OUT = "src/lib/ui-strings.ts";
const LOCALES = ["es", "ru"];

function dictionary(lang) {
  return JSON.parse(readFileSync(`src/dictionaries/${lang}.json`, "utf8"));
}

/** Тип по форме испанского словаря: ключи одни и те же в обеих локалях —
 *  это отдельно стережёт `dictionary-parity.test.ts`. */
function typeOf(node, indent = "") {
  const lines = ["{"];
  for (const [k, v] of Object.entries(node)) {
    lines.push(
      typeof v === "string"
        ? `${indent}  ${k}: string;`
        : `${indent}  ${k}: ${typeOf(v, `${indent}  `)};`,
    );
  }
  lines.push(`${indent}}`);
  return lines.join("\n");
}

export function render(byLocale) {
  const shape = byLocale[LOCALES[0]];
  const body = LOCALES.map((lang) => `  ${lang}: ${JSON.stringify(byLocale[lang], null, 2).split("\n").join("\n  ")},`).join("\n");
  return `// СОБРАНО scripts/build-ui-strings.mjs ИЗ src/dictionaries/*.json — НЕ ПРАВИТЬ РУКАМИ.
//
// Долг 23. Интерфейсные строки жили в ДВУХ местах: в словарях и здесь,
// литералами. Теперь место одно — словари, ветка "${CLIENT_UI_KEY}", — а этот
// файл её отпечаток для клиентских компонентов, которым словарь целиком
// отдать нельзя (70 КиБ и 94 КиБ на девятнадцать подписей).
//
// Правка руками роняет \`npm run check:ui-strings-source\`: сторож
// пересобирает файл в памяти и сличает знак в знак.
//
// Пересобрать: npm run ui-strings:build
import type { Locale } from "@/i18n/config";

export interface UiStrings ${typeOf(shape)}

export const UI_STRINGS: Record<Locale, UiStrings> = {
${body}
};

/** Испанский — запасной для всего, что не известная локаль: на нём
 *  написан продукт, и в него по умолчанию уходит любой маршрут. */
export function uiStrings(lang: string): UiStrings {
  return lang === "ru" ? UI_STRINGS.ru : UI_STRINGS.es;
}
`;
}

export function expected() {
  const byLocale = {};
  for (const lang of LOCALES) {
    const block = dictionary(lang)[CLIENT_UI_KEY];
    if (!block) throw new Error(`src/dictionaries/${lang}.json: ветки "${CLIENT_UI_KEY}" нет`);
    byLocale[lang] = block;
  }
  return render(byLocale);
}

function main() {
  const want = expected();
  if (process.argv.includes("--check")) {
    const have = readFileSync(OUT, "utf8");
    if (have === want) {
      console.log(`ui-strings:check — ${OUT} совпадает со словарями знак в знак`);
      return;
    }
    console.error(`ui-strings:check — ОТКАЗ: ${OUT} разошёлся со словарями. Пересобрать: npm run ui-strings:build`);
    process.exitCode = 1;
    return;
  }
  writeFileSync(OUT, want);
  console.log(`ui-strings:build — ${OUT} собран из ${LOCALES.length} словарей`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) main();
