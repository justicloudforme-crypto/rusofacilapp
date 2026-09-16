/**
 * ТЕКСТ ИНТЕРФЕЙСА НЕ ОСКОРБЛЯЕТ И НЕ ГОВОРИТ С ЧЕЛОВЕКОМ СВОИМИ
 * ВНУТРЕННИМИ ИМЕНАМИ — заход 7.203, часть 2.
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО — ДВЕ НАХОДКИ ВЛАДЕЛЬЦА, 16.09.2026
 * ====================================================================
 *
 * (а) Выбор аватара, испанская локаль: группа лисы называлась «Zorra».
 *     В Мексике и большей части Латинской Америки `zorra` — не «лисица»,
 *     а грубое оскорбление женщины. Заменено на «Zorro», и вместе с ним
 *     на мужской род ушла подпись выражения («Tranquila» → «Tranquilo»):
 *     иначе имя и подпись говорили бы о разном.
 *
 * (б) Настройки → «Apariencia del sitio» → «Claro»: описание «El estilo
 *     clásico claro de «Gorodets»». «Gorodets» — ВНУТРЕННЕЕ имя палитры
 *     проекта. Человеку, выбирающему светлую тему, оно не говорит
 *     ничего. Русская строка страдала тем же («Городецкой росписи») и
 *     переписана тоже.
 *
 * ====================================================================
 * ГРАНИЦА ПРАВИЛА — НАЗВАНА ЧИСЛОМ, А НЕ ОБЕЩАНИЕМ
 * ====================================================================
 *
 * Судятся СТРОКИ ИНТЕРФЕЙСА, то есть оба словаря целиком. НЕ судится
 * учебное содержимое: в `src/lib/media/mediaData.json` слово `zorra`
 * стоит 23 раза — это русские народные сказки и басни Крылова, где лиса
 * женского рода («El cuervo y la zorra»), и переписывать классику ради
 * правила об интерфейсе значило бы врать о содержании. Число вхождений
 * печатается в отчёте каждый раз: граница видна, а не подразумевается.
 *
 * Не судятся и комментарии кода: `Gorodets` там — имя палитры для того,
 * кто её правит, и это ровно тот читатель, которому оно понятно.
 *
 * ====================================================================
 * ПОЧЕМУ СТОРОЖ ДВУСТОРОННИЙ
 * ====================================================================
 *
 * Правило «слова нет» выполняется удалением строки целиком, и тогда у
 * человека пропадает подпись. Поэтому вторая половина: названные ключи
 * обязаны ПРИСУТСТВОВАТЬ и быть непустыми в обеих локалях.
 *
 *   node scripts/check-ui-wording.mjs
 *   node scripts/check-ui-wording.mjs --plant
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const RU = "src/dictionaries/ru.json";
const ES = "src/dictionaries/es.json";
const CONTENT = "src/lib/media/mediaData.json";

/** Запрещённые в интерфейсе слова: что ищем и почему. Регистр не важен,
 * границы слова не проверяются намеренно — «Zorras» и «zorra.» это то же
 * самое слово. */
const FORBIDDEN = [
  {
    needle: "zorra",
    why: "в Мексике и Латинской Америке это оскорбление женщины, а не название животного; в интерфейсе — «Zorro»",
  },
  {
    needle: "gorodets",
    why: "внутреннее имя палитры проекта: человеку, выбирающему тему, оно не говорит ничего",
  },
  {
    needle: "городец",
    why: "то же внутреннее имя палитры по-русски — «Городецкая роспись» в описании темы",
  },
];

/** Ключи, которые обязаны существовать и быть непустыми: правило «слова
 * нет» не должно выполняться удалением подписи. */
const REQUIRED_KEYS = ["avatarCharacterFox", "themeLightDescription", "themeDarkDescription", "themeReadingDescription"];

const read = (path) => readFileSync(path, "utf8");

/** Все строковые значения словаря с путями до них. Читается разобранный
 * JSON, а не текст: ключи правилу неинтересны, судятся только те строки,
 * которые человек видит. */
function stringsOf(json, prefix = "") {
  const out = [];
  for (const [key, value] of Object.entries(json)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.push([path, value]);
    else if (value && typeof value === "object") out.push(...stringsOf(value, path));
  }
  return out;
}

function findKey(json, key, prefix = "") {
  for (const [name, value] of Object.entries(json)) {
    const path = prefix ? `${prefix}.${name}` : name;
    if (name === key) return [path, value];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const found = findKey(value, key, path);
      if (found) return found;
    }
  }
  return null;
}

export function judge(sources) {
  const problems = [];
  for (const file of [RU, ES]) {
    let dict;
    try {
      dict = JSON.parse(sources[file]);
    } catch (error) {
      problems.push(`${file}: не разбирается как JSON (${error.message})`);
      continue;
    }

    for (const [path, value] of stringsOf(dict)) {
      for (const { needle, why } of FORBIDDEN) {
        if (value.toLowerCase().includes(needle)) {
          problems.push(`${file}: строка ${path} — «${value}» содержит «${needle}»: ${why}`);
        }
      }
    }

    for (const key of REQUIRED_KEYS) {
      const found = findKey(dict, key);
      if (!found) {
        problems.push(`${file}: подписи ${key} нет вовсе — правило «слова нет» выполнено удалением текста`);
      } else if (typeof found[1] !== "string" || found[1].trim() === "") {
        problems.push(`${file}: подпись ${found[0]} пуста — человек увидит дырку вместо названия`);
      }
    }
  }
  return problems;
}

export function main() {
  const plant = process.argv.includes("--plant");
  const sources = Object.fromEntries([RU, ES].map((f) => [f, read(f)]));
  const contentHits = (read(CONTENT).toLowerCase().match(/zorra/g) ?? []).length;

  if (plant) {
    let ok = judge(sources).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровые словари (отрицательный контроль)`);

    const plants = [
      ["в испанском словаре вернулось «Zorra» (находка 16.09.2026)",
        { [ES]: sources[ES].replace('"avatarCharacterFox": "Zorro"', '"avatarCharacterFox": "Zorra"') }],
      ["то же слово во множественном числе и в другом месте словаря",
        { [ES]: sources[ES].replace('"avatarModalTitle": "Elige tu avatar"', '"avatarModalTitle": "Elige entre las zorras"') }],
      ["в описание светлой темы вернулось внутреннее имя палитры (es)",
        { [ES]: sources[ES].replace('"themeLightDescription": "El estilo claro clásico del sitio."',
          '"themeLightDescription": "El estilo clásico claro de «Gorodets»."') }],
      ["то же по-русски",
        { [RU]: sources[RU].replace('"themeLightDescription": "Классический светлый стиль сайта."',
          '"themeLightDescription": "Классический светлый стиль «Городецкой росписи»."') }],
      ["внутреннее имя переехало в описание ДРУГОЙ темы",
        { [RU]: sources[RU].replace('"themeDarkDescription": "Тёмная тема — удобно заниматься вечером."',
          '"themeDarkDescription": "Тёмная тема «Городецкой росписи»."') }],
      ["подпись группы аватара опустела — правило выполнено удалением текста",
        { [ES]: sources[ES].replace('"avatarCharacterFox": "Zorro"', '"avatarCharacterFox": ""') }],
      ["описание светлой темы удалено целиком",
        { [ES]: sources[ES].replace('    "themeLightDescription": "El estilo claro clásico del sitio.",\n', "") }],
    ];

    let caught = 0;
    for (const [name, patch] of plants) {
      const changed = Object.entries(patch).every(([file, text]) => text !== sources[file]);
      const found = judge({ ...sources, ...patch });
      const hit = changed && found.length > 0;
      if (hit) caught++;
      console.log(
        `  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}` + (hit ? ` (${found[0]})` : changed ? "" : " [подсадка НЕ ИЗМЕНИЛА файл]"),
      );
    }
    ok &&= caught === plants.length;
    console.log(
      ok
        ? `check:ui-wording --plant — ${caught} из ${plants.length} подсадок, 1 из 1 отрицательный контроль`
        : `check:ui-wording --plant — FAILED (${caught} из ${plants.length})`,
    );
    return ok ? 0 : 1;
  }

  const problems = judge(sources);
  if (problems.length) {
    console.error("ТЕКСТ ИНТЕРФЕЙСА:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(
    `check:ui-wording — в обоих словарях нет ни «zorra», ни внутреннего имени палитры, ` +
      `а названные ${REQUIRED_KEYS.length} подписи на месте и непусты. Учебное содержимое не судится: ` +
      `в ${CONTENT} слово «zorra» стоит ${contentHits} раз — это сказки и басни, где лиса женского рода. ` +
      `Контроль — --plant.`,
  );
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
