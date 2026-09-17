/**
 * «ДОСТУПНО» ОЗНАЧАЕТ ТО, ЧТО ЧЕЛОВЕК МОЖЕТ ОТКРЫТЬ — долг 240, 7.206.
 *
 * Находка владельца 17.09.2026 (заход 7.204, часть 3): бесплатный аккаунт
 * `justicloudforme@gmail.com` в режиме «Emparejar» под фильтром «TODOS»
 * читал «Llevas 0 de 4783 palabras disponibles · 988 más con Premium» —
 * ровно то же число, что подписчик. Замер по боевому банку: строк 5771,
 * не-C1 4783, тем 23, бесплатная проба 10 НА ТЕМУ → открыть он мог 230.
 * Завышение 4553 слова, и слово «disponibles» делало его утверждением.
 *
 * Причина: `availableWords` считался одним правилом уровня
 * (`canAccessLevel`) и бесплатной пробы не видел вовсе, хотя сам список
 * карточек ею же и режет выдачу.
 *
 * ЧТО СТОРОЖИТСЯ
 *
 *   1. `availableWords` собирается через `openCardIds` — ту же функцию,
 *      которой считает доступное перепись закрытого. Второго определения
 *      «доступного» в маршруте быть не должно.
 *   2. Числителю то же множество: `resolvedKnownIds` сужается по
 *      `openIds`, иначе дробь считается по двум разным банкам.
 *   3. Закрытое РАЗДЕЛЕНО ПО ПРИЧИНЕ: наружу уезжает и
 *      `premiumOnlyWords`, и `subscriptionOnlyWords`.
 *   4. Предложение умеет назвать обе причины: в `learned-progress.ts`
 *      есть ветки на `learnedProgressSubscriptionLabel` и на
 *      `learnedProgressBothLabel`.
 *   5. Каждый экран, печатающий это предложение, передаёт
 *      `lockedBySubscription`, — иначе он молча вернётся к «всё закрытое
 *      — это Premium».
 *   6. Оба словаря несут все четыре шаблона, и в шаблоне «обе причины»
 *      стоят оба места подстановки.
 *
 *   node scripts/check-available-words.mjs
 *   node scripts/check-available-words.mjs --plant
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");
const ROUTE = "src/app/api/flashcards/summary/route.ts";
const TEXT = "src/lib/flashcards/learned-progress.ts";
/** Экраны, печатающие это предложение. Список закреплён числом: новый
 *  экран обязан быть замечен, а не пропущен молча. */
const SCREENS = [
  "src/components/flashcards/MatchApp.tsx",
  "src/components/flashcards/RecallApp.tsx",
  "src/components/flashcards/FillBlankApp.tsx",
  "src/components/word-games/WordGamePlayer.tsx",
];
const DICTS = ["src/dictionaries/es.json", "src/dictionaries/ru.json"];
const TEMPLATES = [
  "learnedProgressLabel",
  "learnedProgressAvailableLabel",
  "learnedProgressSubscriptionLabel",
  "learnedProgressBothLabel",
];

export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

export function violations({ route, text, screens, dicts }) {
  const bad = [];
  const r = stripComments(route);

  if (!/const openIds = openCardIds\(wholeIndex/.test(r)) {
    bad.push(`${ROUTE}: доступное считается не через openCardIds — бесплатная проба снова невидима (долг 240)`);
  }
  if (/const availableWords = index\.filter/.test(r)) {
    bad.push(`${ROUTE}: вернулось прежнее определение доступного — одно правило уровня без пробы`);
  }
  if (!/availableWords = inCutBank\.filter\(\(card\) => openIds\.has\(card\.id\)\)/.test(r)) {
    bad.push(`${ROUTE}: знаменатель собран мимо открытых карточек`);
  }
  if (!/if \(!openIds\.has\(cardId\)\) resolvedKnownIds\.delete\(cardId\)/.test(r)) {
    bad.push(`${ROUTE}: числитель не сужен по открытым — дробь считается по двум разным банкам`);
  }
  if (!/subscriptionOnlyWords,/.test(r)) {
    bad.push(`${ROUTE}: закрытое подпиской наружу не уезжает — экран снова позовёт за ним в Premium`);
  }

  const t = stripComments(text);
  // Ищется ВЫЗОВ, а не объявление типа: объявление переживает и
  // закомментированную ветку, и сторож был бы доволен мёртвым кодом.
  for (const key of ["learnedProgressSubscriptionLabel", "learnedProgressBothLabel"]) {
    if (!new RegExp(`dict\\.${key}\\b`).test(t)) {
      bad.push(`${TEXT}: нет ветки ${key} — причина закрытого снова одна`);
    }
  }
  if (!/lockedBySubscription/.test(t)) {
    bad.push(`${TEXT}: предложение не знает про закрытое подпиской`);
  }

  for (const [file, source] of Object.entries(screens)) {
    if (!/lockedBySubscription/.test(stripComments(source))) {
      bad.push(`${file}: печатает строку «доступно», не передав закрытое подпиской (долг 240)`);
    }
  }

  for (const [file, parsed] of Object.entries(dicts)) {
    const section = parsed?.vocabulary ?? {};
    for (const key of TEMPLATES) {
      const forms = section[key];
      if (!forms || typeof forms !== "object") {
        bad.push(`${file}: нет шаблона ${key}`);
        continue;
      }
      for (const form of ["one", "few", "many"]) {
        const value = forms[form];
        if (typeof value !== "string") {
          bad.push(`${file}: у ${key} нет формы ${form}`);
          continue;
        }
        if (!value.includes("{known}") || !value.includes("{total}")) {
          bad.push(`${file}: у ${key}.${form} нет места для чисел {known}/{total}`);
        }
        if (key !== "learnedProgressLabel" && !value.includes("{locked}")) {
          bad.push(`${file}: у ${key}.${form} нет места для закрытого {locked}`);
        }
        if (key === "learnedProgressBothLabel" && !value.includes("{premium}")) {
          bad.push(`${file}: у ${key}.${form} нет второй причины {premium} — обе названы одним числом`);
        }
      }
    }
  }
  return bad;
}

function load() {
  const screens = {};
  for (const file of SCREENS) screens[file] = readFileSync(file, "utf8");
  const dicts = {};
  for (const file of DICTS) dicts[file] = JSON.parse(readFileSync(file, "utf8"));
  return {
    route: readFileSync(ROUTE, "utf8"),
    text: readFileSync(TEXT, "utf8"),
    screens,
    dicts,
  };
}

function plant() {
  const live = load();
  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(live).length === 0 }];
  const planted = (name, patch, expect) => {
    const input = { ...live, ...patch };
    if (JSON.stringify(input) === JSON.stringify(live)) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(input).some((f) => f.includes(expect)) });
  };

  planted(
    "подсадка: вернуть прежний знаменатель (правило уровня без пробы) — поймана",
    {
      route: live.route.replace(
        /const availableWords = inCutBank\.filter\(\(card\) => openIds\.has\(card\.id\)\)\.length;/,
        "const availableWords = index.filter(inCut).length;",
      ),
    },
    "прежнее определение доступного",
  );
  planted(
    "подсадка: перестать сужать числитель — поймана",
    { route: live.route.replace("if (!openIds.has(cardId)) resolvedKnownIds.delete(cardId);", "void cardId;") },
    "числитель не сужен",
  );
  planted(
    "подсадка: не отдавать закрытое подпиской — поймана",
    { route: live.route.replace("\n    subscriptionOnlyWords,", "") },
    "наружу не уезжает",
  );
  planted(
    "подсадка: закомментировать ветку обеих причин — поймана (класс 7.182)",
    { text: live.text.replace("dict.learnedProgressBothLabel", "/* dict.learnedProgressBothLabel */ dict.learnedProgressAvailableLabel") },
    "нет ветки learnedProgressBothLabel",
  );
  for (const screen of SCREENS) {
    planted(
      `подсадка: ${screen} перестал передавать закрытое подпиской — поймана`,
      { screens: { ...live.screens, [screen]: live.screens[screen].split("lockedBySubscription").join("lockedByNothing") } },
      "не передав закрытое подпиской",
    );
  }
  planted(
    "подсадка: из шаблона «обе причины» убрано второе число — поймана",
    {
      dicts: {
        ...live.dicts,
        [DICTS[0]]: {
          ...live.dicts[DICTS[0]],
          vocabulary: {
            ...live.dicts[DICTS[0]].vocabulary,
            learnedProgressBothLabel: { one: "{known}/{total} · {locked}", few: "{known}/{total} · {locked}", many: "{known}/{total} · {locked}" },
          },
        },
      },
    },
    "нет второй причины",
  );

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:available-words --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const bad = violations(load());
  if (bad.length) {
    console.error("СЛОВО «ДОСТУПНО» СНОВА ОЗНАЧАЕТ НЕ ТО (долг 240):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(`[check:available-words] знаменатель и числитель считаются по открытым карточкам, закрытое разделено на подписку и Premium, экранов ${SCREENS.length} (контроль — --plant).`);
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
