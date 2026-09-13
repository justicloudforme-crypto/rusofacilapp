/**
 * «Свой банк перед чужим сервисом, и отказ чужого сервиса не виден
 * ученику» — сторож долгов 169 и 168 (заход 7.188).
 *
 * ЧТО ЗАПЕРТО ЮНИТ-ТЕСТАМИ, А НЕ ЗДЕСЬ. Поведение: число запросов на
 * тап (`StoryText.tap-cost.test.tsx` — слово из банка стоит 0 запросов в
 * словарь, слово не из банка ровно 1), разбор отказа
 * (`mymemory-refusal.test.ts`), правило нормализации
 * (`translation-normalize.test.ts`), оба адреса
 * (`api/dictionary/…/route.test.ts`).
 *
 * ЗДЕСЬ ЗАПЕРТА СТРУКТУРА — те места, порознь каждое из которых
 * возвращает болезнь целиком, а тесты при этом могут остаться зелёными
 * (мок базы ответит и на запрос, которого быть не должно):
 *
 *   1) ПОРЯДОК: банк спрашивается РАНЬШЕ чужого сервиса в тексте
 *      обработчика. Переставить их местами — значит вернуть чужую квоту
 *      на каждый тап, ничего не сломав внешне.
 *   2) ЧУЖОЙ ТЕКСТ НЕ ВЫДАЁТСЯ ЗА ПЕРЕВОД: обработчик берёт перевод
 *      только через `pickMyMemoryTranslation`, а не из `responseData`
 *      или `matches` напрямую (долг 168).
 *   3) КЭШ ЧЕСТНЫЙ: на успехе стоит общий заголовок, а не `max-age=0`.
 *   4) АДРЕС ПРЕДЗАГРУЗКИ НЕ ХОДИТ НАРУЖУ ВООБЩЕ — ни `fetch`, ни
 *      имени чужого сервиса в файле. Один пролистанный рассказ иначе
 *      расстрелял бы суточную квоту.
 *   5) НОРМАЛИЗАЦИЯ НЕ РАСШИРЯЕТСЯ МОЛЧА: ни NFD (он сводит «й» к «и»),
 *      ни складывания ё с е (всё ≠ все), ни отсечения окончаний.
 *   6) ЧИТАТЕЛЬ СМОТРИТ В КЭШ ДО ЗАПРОСА и кладёт ответ в кэш, а
 *      предзагрузка ходит в банк, а не в словарь.
 *
 *   node scripts/check-translate-bank.mjs          # гейт
 *   node scripts/check-translate-bank.mjs --plant  # позитивный и отрицательный контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");

const TRANSLATE = "src/app/api/dictionary/translate/route.ts";
const BANK_ROUTE = "src/app/api/dictionary/bank/route.ts";
const NORMALIZE = "src/lib/translation-normalize.ts";
const READER = "src/components/stories/StoryText.tsx";

/** Тело блока, начиная с позиции открывающей скобки. */
function blockFrom(code, index, open, close) {
  let depth = 0;
  for (let i = index; i < code.length; i++) {
    if (code[i] === open) depth++;
    else if (code[i] === close) {
      depth--;
      if (depth === 0) return code.slice(index, i + 1);
    }
  }
  return "";
}

/** Тело функции `async function name(` или `function name(`. */
function functionBody(code, name) {
  const m = new RegExp(`function\\s+${name}\\s*\\(`).exec(code);
  if (!m) return null;
  const brace = code.indexOf("{", m.index);
  return brace === -1 ? null : blockFrom(code, brace, "{", "}");
}

/** Код без комментариев: закомментированная строка — не настройка. */
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

export function violationsIn(files) {
  const bad = [];
  const translate = stripComments(files[TRANSLATE] ?? "");
  const bankRoute = stripComments(files[BANK_ROUTE] ?? "");
  const normalize = stripComments(files[NORMALIZE] ?? "");
  const reader = stripComments(files[READER] ?? "");

  // ---- 1. Порядок источников -------------------------------------------
  const handler = functionBody(translate, "GET");
  if (handler === null) {
    bad.push(`${TRANSLATE}: обработчика GET нет вовсе — сторож ослеп, а не доволен`);
  } else {
    const bankAt = handler.search(/lookupWordBankOne\s*\(/);
    const outsideAt = handler.search(/fetch\s*\(\s*upstreamUrl/);
    if (bankAt === -1) {
      bad.push(`${TRANSLATE}: свой банк не спрашивается вовсе — каждый тап уходит в чужую квоту (долг 169)`);
    } else if (outsideAt === -1) {
      bad.push(`${TRANSLATE}: запроса в чужой сервис нет — сторож не может судить о порядке`);
    } else if (bankAt > outsideAt) {
      bad.push(`${TRANSLATE}: свой банк спрашивается ПОСЛЕ чужого сервиса — порядок перевёрнут (долг 169)`);
    }
    if (!/return[\s\S]{0,200}own\.translation/.test(handler)) {
      bad.push(`${TRANSLATE}: найденный в банке перевод не отдаётся — банк спрошен впустую`);
    }
  }

  // ---- 2. Чужой текст не выдаётся за перевод (долг 168) -----------------
  if (!/pickMyMemoryTranslation\s*\(/.test(translate)) {
    bad.push(`${TRANSLATE}: ответ чужого сервиса не проходит разбор pickMyMemoryTranslation — предупреждение встанет в карточку как перевод (долг 168)`);
  }
  if (/responseData\s*[?.]*\.\s*translatedText/.test(translate) || /data\.matches/.test(translate)) {
    bad.push(`${TRANSLATE}: перевод берётся из ответа чужого сервиса напрямую, мимо разбора отказа (долг 168)`);
  }

  // ---- 3. Честный кэш ---------------------------------------------------
  if (!/TRANSLATION_CACHE_CONTROL/.test(translate)) {
    bad.push(`${TRANSLATE}: на успешном ответе нет честного Cache-Control — повтор тапа снова стоит чужой квоты (долг 169)`);
  }
  if (/max-age=0|must-revalidate/.test(translate)) {
    bad.push(`${TRANSLATE}: вернулся max-age=0/must-revalidate — ответ не хранится нигде`);
  }
  if (!/TRANSLATION_ERROR_CACHE_CONTROL|no-store/.test(translate)) {
    bad.push(`${TRANSLATE}: отказ кэшируется наравне с переводом — чужая авария переживёт саму себя`);
  }

  // ---- 4. Адрес предзагрузки не ходит наружу ----------------------------
  if (!bankRoute) {
    bad.push(`${BANK_ROUTE}: адреса предзагрузки нет вовсе`);
  } else {
    if (/\bfetch\s*\(/.test(bankRoute)) {
      bad.push(`${BANK_ROUTE}: в адресе предзагрузки появился fetch — пачка слов способна уйти наружу и расстрелять суточную квоту (долг 169)`);
    }
    if (/mymemory|translated\.net/i.test(bankRoute)) {
      bad.push(`${BANK_ROUTE}: в адресе предзагрузки помянут чужой сервис — он обязан не знать о нём вовсе`);
    }
    if (!/lookupWordBank\s*\(/.test(bankRoute)) {
      bad.push(`${BANK_ROUTE}: адрес предзагрузки не читает свой банк — сторож ослеп`);
    }
  }

  // ---- 5. Нормализация не расширяется молча -----------------------------
  if (!normalize) {
    bad.push(`${NORMALIZE}: правила нормализации нет вовсе`);
  } else {
    if (/normalize\(\s*["']NFD["']\s*\)/.test(normalize)) {
      bad.push(`${NORMALIZE}: разложение NFD сводит «й» к «и» — «мой» станет «мои» (ложное совпадение, долг 169)`);
    }
    if (/replace\([^)]*ё[^)]*,\s*["']е["']\)/.test(normalize) || /\/ё\/g/.test(normalize)) {
      bad.push(`${NORMALIZE}: ё складывается с е — «всё» и «все» получат один перевод (ложное совпадение, долг 169)`);
    }
    const key = functionBody(normalize, "bankKey");
    if (key === null) {
      bad.push(`${NORMALIZE}: функции bankKey нет вовсе — сторож ослеп`);
    } else if (!/isSingleRussianWord\s*\(/.test(key)) {
      bad.push(`${NORMALIZE}: ключ банка строится без отсева многословных строк — слово «образ» получит перевод пары «образ мышления»`);
    }
  }

  // ---- 6. Читатель: кэш до запроса, предзагрузка в банк ------------------
  const click = functionBody(reader, "handleWordClick");
  if (click === null) {
    bad.push(`${READER}: функции handleWordClick нет вовсе — сторож ослеп`);
  } else {
    const cacheAt = click.search(/readCachedTranslation\s*\(/);
    const askAt = click.search(/fetch\(`\/api\/dictionary\/translate/);
    if (cacheAt === -1) {
      bad.push(`${READER}: тап не смотрит в кэш вкладки — повтор по тому же слову снова стоит запроса (долг 169)`);
    } else if (askAt !== -1 && cacheAt > askAt) {
      bad.push(`${READER}: кэш спрашивается ПОСЛЕ словаря — то есть не спрашивается вовсе`);
    }
    if (!/cacheTranslation\s*\(/.test(click)) {
      bad.push(`${READER}: ответ словаря не кладётся в кэш — второй тап по слову стоит столько же, сколько первый`);
    }
  }
  if (!/\/api\/dictionary\/bank\?words=/.test(reader)) {
    bad.push(`${READER}: предзагрузки видимого абзаца нет — шаг 3 долга 169 не сделан`);
  }
  if (/IntersectionObserver/.test(reader) === false) {
    bad.push(`${READER}: предзагрузка не привязана к видимости — грузится не «видимый абзац», а что попало`);
  }
  const prefetchesThroughTranslate = /prefetch[\s\S]{0,600}fetch\(`\/api\/dictionary\/translate/.test(reader);
  if (prefetchesThroughTranslate) {
    bad.push(`${READER}: предзагрузка ходит в словарь, а не в банк — пачка слов уйдёт в чужую квоту (долг 169)`);
  }

  return bad;
}

function readAll() {
  const files = {};
  for (const path of [TRANSLATE, BANK_ROUTE, NORMALIZE, READER]) files[path] = readFileSync(path, "utf8");
  return files;
}

function plant() {
  const raw = readAll();
  const cases = [];
  const planted = (path, from, to, name, expect) => {
    const mutated = { ...raw, [path]: raw[path].replace(from, to) };
    if (mutated[path] === raw[path]) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violationsIn(mutated).some((f) => f.includes(expect)) });
  };

  cases.push({ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violationsIn(raw).length === 0 });

  planted(
    TRANSLATE,
    "  const own = await lookupWordBankOne(word);",
    "  const own = null as Awaited<ReturnType<typeof lookupWordBankOne>>;",
    "подсадка: свой банк перестал спрашиваться — поймано",
    "не спрашивается вовсе",
  );
  planted(
    TRANSLATE,
    "const translation = pickMyMemoryTranslation(data);",
    "const translation = data.responseData?.translatedText as string | null;",
    "подсадка: перевод берётся из ответа сервиса напрямую (долг 168) — поймано",
    "мимо разбора отказа",
  );
  planted(
    TRANSLATE,
    "{ headers: { \"Cache-Control\": TRANSLATION_CACHE_CONTROL } },",
    "{ headers: { \"Cache-Control\": \"public, max-age=0, must-revalidate\" } },",
    "подсадка: вернулся max-age=0 на успехе — поймано",
    "max-age=0",
  );
  cases.push(
    (() => {
      // Подсадка на ВСЕ вхождения: отказ начинает кэшироваться так же,
      // как перевод, и чужая авария переживает сама себя.
      const mutated = {
        ...raw,
        [TRANSLATE]: raw[TRANSLATE].replaceAll("TRANSLATION_ERROR_CACHE_CONTROL", "TRANSLATION_CACHE_CONTROL"),
      };
      const name = "подсадка: отказ заперт в кэше наравне с переводом — поймано";
      if (mutated[TRANSLATE] === raw[TRANSLATE]) return { name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false };
      return { name, ok: violationsIn(mutated).some((f) => f.includes("переживёт саму себя")) };
    })(),
  );
  planted(
    BANK_ROUTE,
    "  const found = await lookupWordBank(words);",
    "  const found = await lookupWordBank(words);\n  await fetch(\"https://api.mymemory.translated.net/get\");",
    "подсадка: адрес предзагрузки научили ходить наружу — поймано",
    "способна уйти наружу",
  );
  planted(
    NORMALIZE,
    "    .normalize(\"NFC\")",
    "    .normalize(\"NFD\")",
    "подсадка: разложение NFD (сводит «й» к «и») — поймано",
    "«мой» станет «мои»",
  );
  planted(
    NORMALIZE,
    "    .trim()\n    .toLowerCase();",
    "    .trim()\n    .replace(/ё/g, \"е\")\n    .toLowerCase();",
    "подсадка: ё сложили с е — поймано",
    "«всё» и «все»",
  );
  planted(
    NORMALIZE,
    "  return key && isSingleRussianWord(key) ? key : null;",
    "  return key ? key : null;",
    "подсадка: отсев многословных строк снят — поймано",
    "«образ мышления»",
  );
  planted(
    READER,
    "    const cached = readCachedTranslation(word);",
    "    const cached = null as string | null;",
    "подсадка: тап перестал смотреть в кэш вкладки — поймано",
    "не смотрит в кэш",
  );
  planted(
    READER,
    "      cacheTranslation(word, data.translation);",
    "",
    "подсадка: ответ словаря не кладётся в кэш — поймано",
    "не кладётся в кэш",
  );
  planted(
    READER,
    "`/api/dictionary/bank?words=${encodeURIComponent(words.join(\",\"))}`",
    "`/api/dictionary/translate?word=${encodeURIComponent(words[0])}`",
    "подсадка: предзагрузка пошла в словарь вместо банка — поймано",
    "предзагрузки видимого абзаца нет",
  );

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:translate-bank --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const bad = violationsIn(readAll());
  if (bad.length) {
    console.error("ПЕРЕВОД ПО ТАПУ СНОВА ЖИВЁТ ЧУЖОЙ КВОТОЙ ЛИБО ПОКАЗЫВАЕТ ЧУЖОЙ ОТКАЗ (долги 169, 168):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(
    "[check:translate-bank] банк спрашивается первым, чужой отказ разбирается, кэш честный, предзагрузка наружу не ходит, нормализация не расширена (контроль — --plant).",
  );
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
