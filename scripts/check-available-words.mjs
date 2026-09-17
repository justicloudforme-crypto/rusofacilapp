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
 * ЧТО ДОБАВЛЕНО 18.09.2026 (видео проверки 7.207)
 *
 *   7. ДРОБИ С НУЛЁМ В ЗНАМЕНАТЕЛЕ НЕ БЫВАЕТ. На уровне C1 и бесплатный
 *      аккаунт, и доступ по коду читали «Llevas 0 de 0 palabras
 *      disponibles · 988 más con Premium» / «Вы выучили 0 из 0 доступных ·
 *      ещё 988 в Premium»: делить не на что, а человек читает «тут пусто»
 *      — тот же класс, что убран в 7.204. Ветка `available <= 0` обязана
 *      стоять в `learned-progress.ts` и звать ТРИ отдельных шаблона, у
 *      которых мест под `{known}`/`{total}` нет вовсе.
 *   8. МНЕНИЕ СЕРВЕРА СИЛЬНЕЕ ЗАЯВЛЕНИЯ БРАУЗЕРА. Маршрут сводки обязан
 *      спрашивать `serverAnyUpdatedAt` — «есть ли у сервера СТРОКА про
 *      эту карточку», — а не `serverKnownUpdatedAt` («сказал ли он про
 *      неё „знаю“»). Из-за второго строка «не знаю» была неотличима от
 *      отсутствия строки, и у проверяющего кабинет печатал «0 palabras
 *      aprendidas», а сетка словаря — «Вы выучили 4 из 4783» (замер
 *      боевой базы 17.09.2026: четыре строки, все `known = 0`).
 *
 *   node scripts/check-available-words.mjs
 *   node scripts/check-available-words.mjs --plant
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");
const ROUTE = "src/app/api/flashcards/summary/route.ts";
const TEXT = "src/lib/flashcards/learned-progress.ts";
/** Тот самый один кусочек разметки, через который проходят все четыре режима. */
const LINE = "src/components/flashcards/LearnedProgressLine.tsx";
/** Экраны, печатающие это предложение. Список закреплён числом: новый
 *  экран обязан быть замечен, а не пропущен молча. */
const SCREENS = [
  "src/components/flashcards/MatchApp.tsx",
  "src/components/flashcards/RecallApp.tsx",
  "src/components/flashcards/FillBlankApp.tsx",
  // ДОЛГ 258, 18.09.2026: режим карточек тоже печатает это предложение.
  "src/components/flashcards/FlashcardsApp.tsx",
  "src/components/word-games/WordGamePlayer.tsx",
];
/**
 * РЕЖИМЫ СЛОВАРЯ, В КОТОРЫХ СТРОКА «СКОЛЬКО МНЕ ОТКРЫТО» ОБЯЗАНА СТОЯТЬ
 * НА САМОМ ЭКРАНЕ — долг 258, решение владельца 18.09.2026.
 *
 * Список закреплён числом (четыре), и каждый из четырёх обязан звать ОДИН
 * И ТОТ ЖЕ компонент `LearnedProgressLine` с одними и теми же четырьмя
 * числами ответа. Копия предложения в пятом месте — это второй источник
 * правды, ровно то, из-за чего окно итога раунда и сетка тем в 7.208
 * говорили про одно разное.
 *
 * «Expresiones y refranes» сюда НЕ входит намеренно: у идиом другой банк
 * и другой ответ сервера (`/api/idioms`), и решение владельца 18.09.2026 —
 * не трогать.
 */
const GRID_MODES = [
  "src/components/flashcards/FlashcardsApp.tsx",
  "src/components/flashcards/MatchApp.tsx",
  "src/components/flashcards/RecallApp.tsx",
  "src/components/flashcards/FillBlankApp.tsx",
];
/** Четыре числа ответа, которыми собирается предложение. Все четыре обязаны
 *  доехать до компонента в каждом режиме — иначе режимы разойдутся числом. */
const LINE_PROPS = ["known=", "available=", "locked=", "lockedBySubscription="];
const DICTS = ["src/dictionaries/es.json", "src/dictionaries/ru.json"];
const TEMPLATES = [
  "learnedProgressLabel",
  "learnedProgressAvailableLabel",
  "learnedProgressSubscriptionLabel",
  "learnedProgressBothLabel",
];
/** Шаблоны на случай «доступного ноль»: дроби в них нет по построению. */
const NONE_TEMPLATES = [
  "learnedProgressNonePremiumLabel",
  "learnedProgressNoneSubscriptionLabel",
  "learnedProgressNoneBothLabel",
];

export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

export function violations(read) {
  const { route, text, screens, dicts } = read;
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
  // Правило 8. Ищется ровно то условие, которым карта браузера
  // дополняет ответ сервера.
  /**
   * ПРАВИЛО 10 — ПЕРЕПИСЬ ТЕМ СЧИТАЕТСЯ ПО ОТКРЫТОМУ (долг 260,
   * 18.09.2026). Третьего основания «доступного» в маршруте быть не
   * должно: цикл по `index` без `openIds` печатал бесплатному аккаунту
   * «Comida y restaurante 0/266» рядом со строкой «0 de 230 disponibles».
   */
  if (!/if \(!openIds\.has\(card\.id\)\) continue;/.test(r)) {
    bad.push(`${ROUTE}: перепись тем считается мимо openIds — у знаменателя темы снова своё основание (долг 260)`);
  }
  const merge = /if \(entry\.known && !(server\w+)\.has\(cardId\)\) resolvedKnownIds\.add\(cardId\);/.exec(r);
  if (!merge) {
    bad.push(`${ROUTE}: условия слияния карты браузера с ответом сервера нет вовсе — сторож ослеп, а не доволен`);
  } else if (merge[1] !== "serverAnyUpdatedAt") {
    bad.push(
      `${ROUTE}: заявление браузера сверяется с ${merge[1]}, а не с serverAnyUpdatedAt — ` +
        `строка сервера «не знаю» снова неотличима от отсутствия строки (17.09.2026)`,
    );
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
  // Правило 7. Ветка нулевого знаменателя и все три её шаблона.
  if (!/if \(available <= 0\)/.test(t)) {
    bad.push(`${TEXT}: ветки «доступного ноль» нет — вернётся дробь «0 из 0» (17.09.2026)`);
  }
  for (const key of NONE_TEMPLATES) {
    if (!new RegExp(`dict\\.${key}\\b`).test(t)) {
      bad.push(`${TEXT}: нет ветки ${key} — причина закрытого при нулевом знаменателе не названа`);
    }
  }

  /**
   * ПРАВИЛО 9 — СТРОКА СТОИТ ВО ВСЕХ ЧЕТЫРЁХ РЕЖИМАХ И ПРИХОДИТ ИЗ ОДНОГО
   * МЕСТА (долг 258, 18.09.2026).
   *
   * Замер 18.09.2026 по исходнику: вызовов `LearnedProgressLine` было
   * ТРИ — «Emparejar», «Escribir la palabra», «Completa la frase»; в
   * режиме карточек ноль. Владелец смотрел на видео именно режим
   * карточек. Сторож падает и когда строка пропала, и когда она собрана
   * на месте своими руками мимо общего компонента: второй случай и есть
   * «разошлась по числу».
   */
  if (!/const text = learnedProgressText\(/.test(stripComments(read.line ?? ""))) {
    bad.push(`${LINE}: строка собирается не общим \`learnedProgressText\` — источников текста стало два (долг 258)`);
  }
  for (const [file, source] of Object.entries(screens)) {
    const clean = stripComments(source);
    if (!/lockedBySubscription/.test(clean)) {
      bad.push(`${file}: печатает строку «доступно», не передав закрытое подпиской (долг 240)`);
    }
    if (!GRID_MODES.includes(file)) continue;
    if (!/<LearnedProgressLine\b/.test(clean)) {
      bad.push(`${file}: сетка тем этого режима не печатает строку «сколько мне открыто» (долг 258)`);
      continue;
    }
    const at = clean.indexOf("<LearnedProgressLine");
    const call = clean.slice(at, clean.indexOf("/>", at));
    for (const prop of LINE_PROPS) {
      if (!call.includes(prop)) {
        bad.push(`${file}: \`LearnedProgressLine\` зовётся без \`${prop}\` — число этого режима разойдётся с остальными (долг 258)`);
      }
    }
    if (!/available=\{totalProgress\.total\}/.test(call)) {
      bad.push(`${file}: знаменатель строки взят не из общей переписи \`totalProgress\` (долг 258)`);
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
    for (const key of NONE_TEMPLATES) {
      const forms = section[key];
      if (!forms || typeof forms !== "object") {
        bad.push(`${file}: нет шаблона ${key}`);
        continue;
      }
      for (const form of ["one", "few", "many"]) {
        const value = forms[form];
        if (typeof value !== "string") {
          bad.push(`${file}: у ${key}.${form} нет формы`);
          continue;
        }
        if (value.includes("{total}") || value.includes("{known}")) {
          bad.push(`${file}: у ${key}.${form} снова стоит дробь {known}/{total} — знаменатель там ноль`);
        }
        if (!value.includes("{locked}")) {
          bad.push(`${file}: у ${key}.${form} нет места для закрытого {locked}`);
        }
        if (key === "learnedProgressNoneBothLabel" && !value.includes("{premium}")) {
          bad.push(`${file}: у ${key}.${form} нет второй причины {premium}`);
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
    line: readFileSync(LINE, "utf8"),
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
    "подсадка: убрана ветка «доступного ноль» — поймана (17.09.2026)",
    { text: live.text.replace("if (available <= 0) {", "if (false) {") },
    "ветки «доступного ноль» нет",
  );
  planted(
    "подсадка: шаблон нулевого знаменателя снова печатает дробь — поймана",
    {
      dicts: {
        ...live.dicts,
        [DICTS[1]]: {
          ...live.dicts[DICTS[1]],
          vocabulary: {
            ...live.dicts[DICTS[1]].vocabulary,
            learnedProgressNonePremiumLabel: {
              one: "{known} из {total} · {locked}",
              few: "{known} из {total} · {locked}",
              many: "{known} из {total} · {locked}",
            },
          },
        },
      },
    },
    "снова стоит дробь",
  );
  planted(
    "подсадка: сводка снова спрашивает только строки «знаю» — поймана (17.09.2026)",
    {
      route: live.route.replace(
        "if (entry.known && !serverAnyUpdatedAt.has(cardId)) resolvedKnownIds.add(cardId);",
        "if (entry.known && !serverKnownUpdatedAt.has(cardId)) resolvedKnownIds.add(cardId);",
      ),
    },
    "а не с serverAnyUpdatedAt",
  );
  planted(
    "подсадка: условие слияния уехало целиком — поймана",
    {
      route: live.route.replace(
        "if (entry.known && !serverAnyUpdatedAt.has(cardId)) resolvedKnownIds.add(cardId);",
        "void entry;",
      ),
    },
    "условия слияния карты браузера",
  );
  // ── ДОЛГ 258: строка «сколько мне открыто» в четырёх режимах ──
  for (const mode of GRID_MODES) {
    planted(
      `подсадка: ${mode} перестал печатать строку «сколько мне открыто» — поймана (долг 258)`,
      { screens: { ...live.screens, [mode]: live.screens[mode].replace("<LearnedProgressLine", "<LearnedProgressLineOFF") } },
      "не печатает строку «сколько мне открыто»",
    );
    planted(
      `подсадка: ${mode} считает знаменатель строки сам — поймана (долг 258)`,
      { screens: { ...live.screens, [mode]: live.screens[mode].replace("available={totalProgress.total}", "available={categoryCards.length}") } },
      "взят не из общей переписи",
    );
  }
  planted(
    "подсадка: строка собирается мимо общего текста — поймана (долг 258)",
    { line: live.line.replace("const text = learnedProgressText(", "const text = String(") },
    "источников текста стало два",
  );
  // ── ДОЛГ 260: перепись тем по открытому ──
  planted(
    "подсадка: перепись тем снова считается мимо openIds — поймана (долг 260)",
    { route: live.route.replace("    if (!openIds.has(card.id)) continue;\n", "") },
    "мимо openIds",
  );
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
