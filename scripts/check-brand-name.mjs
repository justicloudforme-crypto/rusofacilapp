// Три ЗАКОННЫХ написания имени — и ни одного четвёртого.
//
// Why this exists. On 05.09.2026 the name was spelled `RusoFásil` in 53
// places at once, and two of them were surfaces the owner sees on a phone:
// the Android app label (`android/app/src/main/res/values/strings.xml`),
// which is the sender line the OS prints above every local notification,
// and the introductory presentation (`src/lib/intro/content.ts`, and the
// PDF built from it). The project was renamed on 16.08.2026; those places
// were simply never swept. Fixing them one at a time is what let the old
// spelling survive nine renames' worth of edits, so the sweep is now a
// check that runs in `npm run verify`.
//
// ЧТО ИЗМЕНИЛОСЬ 09.09.2026 (долг 70, половина «б»). До этого дня
// законное написание было ровно одно — `RusoFácilapp`, — и именно поэтому
// витринное имя нельзя было поправить: правка красила эту проверку.
// Владелец решил, что имён РАЗНЫХ три и совпадать они не обязаны. Все три
// объявлены в `src/lib/brand.ts`, и этот файл читает их оттуда, а не
// хранит своей копией:
//
//   SITE_BRAND        `RusoFácilapp`         — сайт и тексты
//   APP_DISPLAY_NAME  `RusoFácil`            — витрина обеих платформ и
//                                              имя разработчика в Play
//   APP_ID            `com.rusofacilapp.app` — идентификатор пакета
//
// ЧТО ПРОВЕРЯЕТСЯ — четыре прохода.
//
// 1. ВИД ИМЕНИ. Каждый отслеживаемый текстовый файл просматривается на
//    предмет отображаемой формы:
//
//        /Rus[a-zá-ú] ?F[áaà][cs][ií]l[A-Za-z]*/
//
//    Шаблон шире прежнего намеренно: прежний начинался с буквального
//    `Ruso` и поэтому НЕ ловил `RusuFácil` — опечатку, которая в истории
//    проекта реально была. Попадание законно, только если оно в точности
//    равно `SITE_BRAND` или `APP_DISPLAY_NAME`. Проверяется и СОДЕРЖИМОЕ
//    файлов, и их ПУТИ: имя скачанного PDF человек тоже читает. Одна
//    форма пропускается: попадание, за которым сразу идёт `.com`, — это
//    хост, а домен диакритики не несёт (`rusofacilapp.com`);
//    `canonical-host.test.ts` пишет его в смешанном регистре нарочно,
//    доказывая, что редирект приводит хост к нижнему регистру.
//
// 2. ИДЕНТИФИКАТОРНАЯ ФОРМА. Строчное `rusofasil` — это адрес, а не имя:
//    ключи localStorage (`rusofasil:pending-progress`), telegram-хэндлы
//    (`@rusofasil_history_bot`), имена файлов памяти. Переименование
//    выбросило бы состояние пользователей или указало бы на несуществующий
//    аккаунт. Запретить его целиком нельзя — но и оставить без счёта тоже:
//    ровно этим написанием проект был испорчен один раз. Поэтому оно
//    ЗАКРЕПЛЕНО ЧИСЛОМ по каждому файлу кода (`IDENT_ALLOWED` ниже):
//    новое вхождение в незнакомом файле — отказ, лишнее вхождение в
//    знакомом — тоже отказ, потому что число перестало сходиться.
//    Журналы (`PROGRESS.md`, `docs/*.md`) из этого прохода исключены
//    целиком: они цитируют написания как улику.
//
// 3. ПЯТЬ ВИТРИННЫХ ЛИТЕРАЛОВ. Витринное имя физически не может жить в
//    одной точке: подпись под иконкой Xcode берёт из `Info.plist`, Gradle
//    — из `strings.xml`, и ни один из них не читает ни `src/lib/brand.ts`,
//    ни `capacitor.config.ts` (`cap sync` эти поля не переписывает,
//    `appName` используется единожды при `cap add`). Цена — пять
//    литералов в трёх файлах. Она выплачена здесь: `SHOWCASE` ниже
//    сличает все пять с `APP_DISPLAY_NAME`, и расхождение любого одного —
//    отказ. Плюс два поля манифеста PWA сличаются с `SITE_BRAND`.
//
// 4. СВОДКА ТАБЛИЦЫ ДОЛГОВ. Сумма категорий обязана сходиться с числом
//    строк — см. `scripts/count-debts.mjs`; проверка живёт там.
//
// СПИСОК ИСКЛЮЧЕНИЙ ЗАКРЕПЛЁН ЧИСЛОМ. The files in ALLOWED below are
// allowed to keep the old spelling, each for a reason written next to it,
// and each with the exact number of hits expected. A new mistake in an
// allowlisted file therefore still fails the check: the count no longer
// matches. A hit that disappears fails too, so a fixed file cannot quietly
// keep its exemption.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Only when this file is the process entry point. Everything below the
// definitions writes files and exits; importing it must do neither. Same
// rule and same inlined form as scripts/check-tokens.mjs — see
// src/lib/entry-point.ts for the incident behind it.
const IS_ENTRY_POINT = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

// Три написания читаются ИЗ src/lib/brand.ts, а не дублируются здесь:
// вторая копия значения — это второе место, где оно может разойтись.
// Файл разбирается текстом, а не импортом, потому что это .mjs под
// голым node, а brand.ts — TypeScript.
const BRAND_SOURCE = "src/lib/brand.ts";
function readBrand(name) {
  const src = readFileSync(BRAND_SOURCE, "utf8");
  const m = src.match(new RegExp(`export const ${name} = "([^"]+)";`));
  if (!m) {
    console.error(
      `check:brand — не могу прочитать ${name} из ${BRAND_SOURCE}. ` +
        `Сторож без канона не сторож: правьте разбор, а не молчите.`,
    );
    process.exit(2);
  }
  return m[1];
}
const SITE_BRAND = readBrand("SITE_BRAND");
const APP_DISPLAY_NAME = readBrand("APP_DISPLAY_NAME");
/** Единственные два законных написания вида имени. */
const LEGAL = new Set([SITE_BRAND, APP_DISPLAY_NAME]);
const CORRECT = `${SITE_BRAND}» или «${APP_DISPLAY_NAME}`;
// Шире прежнего: `Rus[a-z]`, а не буквальное `Ruso`, — иначе `RusuFácil`
// проходит насквозь. `[ií]` — иначе `RusoFácll`/`RusoFácIl` тоже.
const NAME = /Rus[a-zá-ú] ?F[áaà][cs][ií]l[A-Za-z]*/g;

/**
 * Пять литералов витринного имени + два поля манифеста PWA.
 * `expect` — какое из трёх имён обязано там стоять.
 */
const SHOWCASE = [
  { file: "ios/App/App/Info.plist", what: "CFBundleDisplayName",
    re: /<key>CFBundleDisplayName<\/key>\s*<string>([^<]*)<\/string>/, expect: () => APP_DISPLAY_NAME },
  { file: "ios/App/App/Info.plist", what: "CFBundleName",
    re: /<key>CFBundleName<\/key>\s*<string>([^<]*)<\/string>/, expect: () => APP_DISPLAY_NAME },
  { file: "android/app/src/main/res/values/strings.xml", what: "app_name",
    re: /<string name="app_name">([^<]*)<\/string>/, expect: () => APP_DISPLAY_NAME },
  { file: "android/app/src/main/res/values/strings.xml", what: "title_activity_main",
    re: /<string name="title_activity_main">([^<]*)<\/string>/, expect: () => APP_DISPLAY_NAME },
  { file: "capacitor.config.ts", what: "appName",
    re: /appName:\s*"([^"]*)"/, expect: () => APP_DISPLAY_NAME },
  { file: "src/app/manifest.ts", what: "manifest name", 
    re: /\n\s*name: (\w+|"[^"]*"),/, expect: () => "SITE_BRAND" },
  { file: "src/app/manifest.ts", what: "manifest short_name",
    re: /short_name: (\w+|"[^"]*"),/, expect: () => "SITE_BRAND" },
];

/**
 * Идентификаторная форма `rusofasil` — закреплена числом по файлам КОДА.
 * Журналы и отчёты (`PROGRESS.md`, `docs/*.md`) из прохода исключены: они
 * цитируют написания как улику, и число там растёт каждый заход.
 */
const IDENT = "rusofasil";
const IDENT_SKIP = /^(PROGRESS\.md|docs\/|AUDIT\.md|MOBILE\.md)/;
const IDENT_ALLOWED = new Map([
  [".github/workflows/ci.yml", 1],
  ["bots/history_bot/bot.py", 1],
  ["bots/logs/history_bot.err.log", 1],
  ["bots/logs/notifier_bot.err.log", 1],
  ["bots/logs/vocabulary_bot.err.log", 1],
  ["bots/notifier_bot/bot.py", 1],
  ["bots/vocabulary_bot/bot.py", 1],
  ["e2e/offline.spec.ts", 1],
  ["prisma/check-lessons-grammar.ts", 1],
  ["prisma/check-media-embeds.ts", 2],
  ["prisma/generate-lesson-audio.ts", 1],
  ["prisma/generate-media-subtitles.ts", 1],
  ["prisma/schema.prisma", 3],
  ["prisma/seed-ty-uydyosh-override.ts", 1],
  ["prisma/vocabulary-idioms-audit.ts", 1],
  ["scripts/check-app-id.mjs", 4],
  ["src/components/word-games/WordGamesPicker.tsx", 1],
  ["src/lib/flashcard-progress.ts", 1],
  ["src/lib/flashcards/level-progress.ts", 1],
  ["src/lib/flashcards/recall-round.ts", 1],
  ["src/lib/glossary-client.ts", 5],
  ["src/lib/media/checkEmbeds.ts", 1],
  ["src/lib/media/data.ts", 1],
  ["src/lib/media/generateSubtitlesWithClaude.ts", 1],
  ["src/lib/media/types.ts", 1],
  ["src/lib/progress-client.ts", 1],
  ["src/lib/ttl-cache.ts", 1],
]);

/** file → { hits, why }. `hits` is exact; see the header on why. */
const ALLOWED = new Map([
  [
    "prisma/stories-data.ts",
    {
      hits: 278,
      why:
        "`author: \"RusoFásil (relato original)\"` — a value, not a label. It is " +
        "printed as the byline of 114 of the 330 frozen pages measured in " +
        "docs/frozen-baseline-2026-08-30.json, and the same string lives in the " +
        "production Story.author column. Rewriting it is a frozen-page regression " +
        "plus a production write; it waits for 25.09.2026 together with debt 34.",
    },
  ],
  [
    // Найдено 08.09.2026: этот файл приехал в main с PR #220 и сделал
    // `npm run check:brand` — а значит и весь `npm run verify` — КРАСНЫМ,
    // и никто этого не заметил, потому что check:brand в ci.yml не входит.
    // Оба попадания — цитата боевого значения `Story.author`
    // («RusoFásil (relato original)», 277 строк, долг 49), то есть ровно
    // тот класс, ради которого список исключений и существует. Число
    // закреплено: третья цитата в этом файле снова уронит проверку.
    "docs/audit-2026-09-07-A.md",
    {
      hits: 2,
      why:
        "Quotes the production Story.author literal twice while reporting debt 49. " +
        "The value cannot be rewritten before 25.09.2026 (frozen-page byline), so " +
        "the report that names it cannot spell it any other way.",
    },
  ],
  [
    // Заведено 08.09.2026 (PROGRESS.md 7.150). Фикстура рассказов —
    // побайтовая выгрузка НАСТОЯЩИХ строк прода, и `author` в ней тот же
    // самый литерал `Story.author`, что и в двух исключениях выше (долг
    // 49, 277 живых строк). Переписать его здесь значило бы держать в
    // фикстуре значение, которого на проде нет, — то есть проверять
    // страницу, которой не существует. Два попадания: два из трёх
    // рассказов фикстуры — оригиналы проекта, третий («Хамелеон») —
    // Чехов. Число закреплено: третий оригинал в фикстуре снова уронит
    // проверку.
    "e2e/fixtures/stories.json",
    {
      hits: 2,
      why:
        "Byte-for-byte export of two real production Story rows whose author column " +
        "still holds «RusoFásil (relato original)» (debt 49). The value cannot be " +
        "rewritten before 25.09.2026, and a fixture that spells it differently would " +
        "no longer be a copy of production.",
    },
  ],
  [
    "src/lib/stories.ts",
    {
      hits: 3,
      why: "ORIGINAL_STORY_AUTHOR must equal the value in prisma/stories-data.ts exactly.",
    },
  ],
  [
    "src/lib/story-author.ts",
    { hits: 1, why: "Documents the same author literal it must not translate." },
  ],
  [
    "src/lib/story-author.test.ts",
    { hits: 4, why: "Pins the author literal and its row count (277)." },
  ],
  [
    "src/lib/story-culture.test.ts",
    { hits: 2, why: "Splits classics from originals by that same author literal." },
  ],
  [
    "src/lib/stories-catalog.ts",
    { hits: 1, why: "Comment naming the author literal above." },
  ],
  [
    "docs/frozen-baseline-2026-08-30.json",
    {
      hits: 114,
      why:
        "A record of what production served on 30.08.2026. Editing a measurement " +
        "to make a check pass would destroy the measurement.",
    },
  ],
  [
    "ios/App/App/RusoFacilappPRO.storekit",
    {
      hits: 0,
      path: true,
      why:
        "A StoreKit configuration FILE NAME, referenced by that exact string from " +
        "App.xcscheme. Xcode resolves it by path; renaming it is an Xcode change, " +
        "not a copy change, and no user ever sees it.",
    },
  ],
  [
    "ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme",
    { hits: 1, why: "Path to the StoreKit file above." },
  ],
  [
    "MOBILE.md",
    { hits: 3, why: "Instructions that name the StoreKit file above by its file name." },
  ],
  [
    "PROGRESS.md",
    {
      hits: null,
      why:
        "The project log. It quotes wrong spellings as evidence of what was found " +
        "and when; a log that cannot record a mistake cannot record its fix.",
    },
  ],
  [
    "bots/logs/history_bot.err.log",
    { hits: 1, why: "Telegram's own name for the bot account, printed by aiogram." },
  ],
  [
    "bots/logs/moderator_bot.err.log",
    { hits: 1, why: "Telegram's own name for the bot account, printed by aiogram." },
  ],
  [
    "bots/logs/notifier_bot.err.log",
    { hits: 1, why: "Telegram's own name for the bot account, printed by aiogram." },
  ],
  [
    "bots/logs/testing_bot.err.log",
    { hits: 1, why: "Telegram's own name for the bot account, printed by aiogram." },
  ],
  [
    "bots/logs/vocabulary_bot.err.log",
    { hits: 1, why: "Telegram's own name for the bot account, printed by aiogram." },
  ],
]);

const BINARY =
  /\.(png|jpg|jpeg|gif|webp|ico|mp3|wav|m4a|pdf|zip|ttf|otf|woff2?|jar|keystore|xcuserstate)$/i;

// This file is skipped entirely, and it is the one exemption that needs no
// pinned count: a checker for wrong spellings has to WRITE the wrong
// spellings — in the pattern, in the reasons, and in the three plants
// below. Checking itself would mean it can never be clean. Stated plainly
// rather than hidden: a genuine mistake in this file's own prose is the one
// place nothing catches.
const SELF = "scripts/check-brand-name.mjs";

function scan() {
  const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter((f) => f && f !== SELF && !BINARY.test(f));

  /** [{file, line, text, context}] for every hit that is not a legal spelling. */
  const wrong = [];
  /** file → number of wrong hits, for the allowlist arithmetic. */
  const perFile = new Map();
  /** file → number of `rusofasil` hits, for the identifier arithmetic. */
  const identPerFile = new Map();
  const note = (file, line, text, context) => {
    perFile.set(file, (perFile.get(file) ?? 0) + 1);
    wrong.push({ file, line, text, context });
  };

  for (const file of files) {
    // File paths are a surface too — a downloaded PDF is named by one.
    for (const match of file.matchAll(NAME)) {
      if (LEGAL.has(match[0])) continue;
      note(file, 0, match[0], `file path: ${file}`);
    }

    let source;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    // Быстрый отсев. Раньше здесь стояло `source.includes("uso")` — и это
    // была ДЫРА: `RusuFácil` содержит «usu», а не «uso», то есть опечатка,
    // ради которой шаблон расширяли, всё равно проходила насквозь. Поймано
    // подсадкой «RusuFácil», а не глазами.
    if (!/[Rr]us/.test(source)) continue;

    // Проход 2: идентификаторная форма, закреплённая числом.
    if (!IDENT_SKIP.test(file)) {
      const n = source.split(IDENT).length - 1;
      if (n) identPerFile.set(file, n);
    }

    source.split("\n").forEach((line, i) => {
      for (const match of line.matchAll(NAME)) {
        if (LEGAL.has(match[0])) continue;
        // A host name, not a label: the domain carries no accent.
        const after = line.slice(match.index + match[0].length, match.index + match[0].length + 4);
        if (after === ".com") continue;
        note(file, i + 1, match[0], line.trim().slice(0, 120));
      }
    });
  }

  const failures = [];
  const unexpected = wrong.filter((hit) => !ALLOWED.has(hit.file));
  for (const hit of unexpected) {
    failures.push(
      `${hit.file}:${hit.line}  «${hit.text}» — expected «${CORRECT}»\n      ${hit.context}`,
    );
  }

  for (const [file, rule] of ALLOWED) {
    if (rule.hits === null) continue;
    const found = perFile.get(file) ?? 0;
    // `path: true` — the hit is in the file's own name, so the path pass
    // counts one on top of whatever the content holds.
    const expected = rule.hits + (rule.path ? 1 : 0);
    if (found === expected) continue;
    failures.push(
      `${file}: allowed ${expected} old spelling(s), found ${found}.\n` +
        `      Reason on record: ${rule.why}\n` +
        `      A changed count means either a NEW mistake in this file or a fixed one; ` +
        `update scripts/check-brand-name.mjs deliberately, do not widen the exemption.`,
    );
  }

  // Проход 2 (арифметика): каждое строчное `rusofasil` в коде — либо в
  // списке с тем же числом, либо отказ.
  const identFailures = [];
  for (const [file, n] of identPerFile) {
    const expected = IDENT_ALLOWED.get(file);
    if (expected === undefined) {
      identFailures.push(
        `${file}: ${n} вхождение(й) «${IDENT}» в файле, которого нет в IDENT_ALLOWED.\n` +
          `      Строчная форма — это АДРЕС (ключ localStorage, telegram-хэндл), а не имя. ` +
          `Новый адрес заводится осознанно: впишите файл и число в scripts/check-brand-name.mjs.`,
      );
      continue;
    }
    if (n !== expected) {
      identFailures.push(
        `${file}: разрешено ${expected} вхождение(й) «${IDENT}», найдено ${n}.\n` +
          `      Число закреплено: и лишнее вхождение, и исчезнувшее — повод посмотреть глазами.`,
      );
    }
  }
  for (const [file, expected] of IDENT_ALLOWED) {
    if (!identPerFile.has(file)) {
      identFailures.push(
        `${file}: разрешено ${expected} вхождение(й) «${IDENT}», найдено 0 ` +
          `(файл исчез, переименован или вычищен — снимите строку осознанно).`,
      );
    }
  }
  failures.push(...identFailures);

  // Проход 3: пять витринных литералов + два поля манифеста.
  const showcase = [];
  for (const rule of SHOWCASE) {
    let text;
    try {
      text = readFileSync(rule.file, "utf8");
    } catch {
      showcase.push({ ...rule, found: null, want: rule.expect() });
      failures.push(`${rule.file}: файла нет, а витринное имя обязано в нём стоять (${rule.what}).`);
      continue;
    }
    const m = text.match(rule.re);
    const want = rule.expect();
    const found = m ? m[1] : null;
    showcase.push({ file: rule.file, what: rule.what, found, want });
    if (found === want) continue;
    failures.push(
      `${rule.file}: ${rule.what} = ${found === null ? "НЕ НАЙДЕНО" : `«${found}»`}, ` +
        `а обязано быть «${want}».\n` +
        `      Витринное имя объявлено в ${BRAND_SOURCE} и физически не может жить в одной ` +
        `точке: Xcode и Gradle читают свои файлы. Расхождение ловится только здесь.`,
    );
  }

  const allowedTotal = [...perFile].reduce((n, [f, c]) => (ALLOWED.has(f) ? n + c : n), 0);
  const identTotal = [...identPerFile].reduce((n, [, c]) => n + c, 0);
  return {
    failures,
    unexpected,
    scanned: files.length,
    allowedTotal,
    identFailures,
    identTotal,
    identFiles: identPerFile.size,
    showcase,
  };
}

function report(r) {
  const { failures, unexpected, scanned, allowedTotal, identTotal, identFiles, showcase } = r;
  if (failures.length) {
    console.error("check:brand — FAILED\n");
    for (const f of failures) console.error(`  ${f}\n`);
    console.error(
      `Scanned ${scanned} tracked files. ` +
        `${unexpected.length} hit(s) outside the allowlist, ${allowedTotal} inside it.`,
    );
    return false;
  }
  console.log(
    `check:brand — три законных написания и ни одного четвёртого: ` +
      `«${SITE_BRAND}» (сайт), «${APP_DISPLAY_NAME}» (витрина и разработчик), ` +
      `«${readBrand("APP_ID")}» (идентификатор).`,
  );
  console.log(
    `  вид имени: просмотрено ${scanned} отслеживаемых файлов, ` +
      `неверных написаний вне списка исключений 0, ` +
      `внутри него ${allowedTotal} в ${ALLOWED.size} файлах, каждое закреплено числом`,
  );
  console.log(
    `  идентификаторная форма «${IDENT}»: ${identTotal} вхождений в ${identFiles} файлах кода, ` +
      `все закреплены числом (${IDENT_ALLOWED.size} строк списка); журналы из прохода исключены`,
  );
  console.log(`  витринных литералов сведено: ${showcase.length}`);
  for (const c of showcase) console.log(`    ${c.file} → ${c.what} = «${c.found}»`);
  return true;
}

// `--plant` is the positive control, and it is the whole point of the file:
// a check that has never been seen to fail is not evidence of anything.
// Подсадки закрывают три прохода сразу и, отдельно, ТРИ НАСТОЯЩИЕ
// ОПЕЧАТКИ ИЗ ИСТОРИИ ПРОЕКТА — `rusofasil`, `RusuFácil`, `RusoFásil`, — а
// отрицательный контроль требует молчания на трёх ЗАКОННЫХ написаниях.
// Без последнего проверка «ловит всё подряд» выглядела бы точно так же.
function plantControls() {
  const PLANTED = "scripts/__brand-plant__.generated.ts";
  const writeTracked = (file, body) => {
    writeFileSync(file, body);
    execFileSync("git", ["add", "-N", file]);
  };
  const dropTracked = (file) => {
    execFileSync("git", ["rm", "-q", "--cached", file]);
    rmSync(file);
  };
  const swap = (file, from, to) => {
    const before = readFileSync(file, "utf8");
    if (!before.includes(from)) throw new Error(`подсадка не нашла «${from}» в ${file}`);
    writeFileSync(file, before.replace(from, to));
    return () => writeFileSync(file, before);
  };

  const controls = [
    // --- проход 1: вид имени ------------------------------------------
    {
      name: "настоящая опечатка «RusoFásil» в обычном файле",
      plant: () => writeTracked(PLANTED, "// RusoFásil\nexport {};\n"),
      undo: () => dropTracked(PLANTED),
      expect: (r) => r.unexpected.some((h) => h.file === PLANTED && h.text === "RusoFásil"),
    },
    {
      name: "настоящая опечатка «RusuFácil» — прежний шаблон её НЕ ловил",
      plant: () => writeTracked(PLANTED, "// RusuFácil\nexport {};\n"),
      undo: () => dropTracked(PLANTED),
      expect: (r) => r.unexpected.some((h) => h.file === PLANTED && h.text === "RusuFácil"),
    },
    {
      name: "витринное имя без диакритики: «RusoFacil»",
      plant: () => writeTracked(PLANTED, "// RusoFacil\nexport {};\n"),
      undo: () => dropTracked(PLANTED),
      expect: (r) => r.unexpected.some((h) => h.file === PLANTED && h.text === "RusoFacil"),
    },
    {
      name: "one EXTRA old spelling inside an allowlisted file",
      plant: function () {
        this.restore = swap("src/lib/stories.ts", "export", "// RusoFásil\nexport");
      },
      undo: function () {
        this.restore();
      },
      expect: (r) => r.failures.some((m) => m.startsWith("src/lib/stories.ts: allowed 3")),
    },
    {
      name: "old spelling in a file NAME",
      plant: () => writeTracked("scripts/RusoFasil-plant.generated.ts", "export {};\n"),
      undo: () => dropTracked("scripts/RusoFasil-plant.generated.ts"),
      expect: (r) => r.unexpected.some((h) => h.line === 0 && h.text === "RusoFasil"),
    },
    // --- проход 2: идентификаторная форма ------------------------------
    {
      name: "настоящая опечатка «rusofasil» в НОВОМ файле кода",
      plant: () => writeTracked(PLANTED, 'export const K = "rusofasil:plant";\n'),
      undo: () => dropTracked(PLANTED),
      expect: (r) => r.identFailures.some((m) => m.startsWith(PLANTED) && m.includes("IDENT_ALLOWED")),
    },
    {
      name: "лишнее «rusofasil» в знакомом файле — число перестало сходиться",
      plant: function () {
        this.restore = swap(
          "src/lib/ttl-cache.ts",
          "export",
          '// rusofasil:extra\nexport',
        );
      },
      undo: function () {
        this.restore();
      },
      expect: (r) => r.identFailures.some((m) => m.startsWith("src/lib/ttl-cache.ts") && m.includes("найдено 2")),
    },
    // --- проход 3: пять витринных литералов ---------------------------
    {
      name: "Android app_name уехал на бренд сайта вместо витринного имени",
      plant: function () {
        this.restore = swap(
          "android/app/src/main/res/values/strings.xml",
          `<string name="app_name">${APP_DISPLAY_NAME}</string>`,
          `<string name="app_name">${SITE_BRAND}</string>`,
        );
      },
      undo: function () {
        this.restore();
      },
      expect: (r) =>
        r.failures.some((m) => m.includes("app_name") && m.includes(`«${SITE_BRAND}»`)),
    },
    {
      name: "iOS CFBundleDisplayName разошёлся с CFBundleName",
      plant: function () {
        this.restore = swap(
          "ios/App/App/Info.plist",
          `<key>CFBundleDisplayName</key>\n\t<string>${APP_DISPLAY_NAME}</string>`,
          `<key>CFBundleDisplayName</key>\n\t<string>Ruso Fácil</string>`,
        );
      },
      undo: function () {
        this.restore();
      },
      expect: (r) => r.failures.some((m) => m.includes("CFBundleDisplayName")),
    },
    {
      name: "appName в capacitor.config.ts потерял диакритику",
      plant: function () {
        this.restore = swap("capacitor.config.ts", 'appName: "RusoFácil"', 'appName: "RusoFacil"');
      },
      undo: function () {
        this.restore();
      },
      expect: (r) => r.failures.some((m) => m.includes("appName")),
    },
    {
      name: "манифест PWA подписан витринным именем вместо бренда сайта",
      plant: function () {
        this.restore = swap("src/app/manifest.ts", "name: SITE_BRAND,", 'name: "RusoFácil",');
      },
      undo: function () {
        this.restore();
      },
      expect: (r) => r.failures.some((m) => m.includes("manifest name")),
    },
    // --- отрицательные контроли ---------------------------------------
    {
      name: "ОТРИЦАТЕЛЬНЫЙ: три ЗАКОННЫХ написания в новом файле — молчание",
      plant: () =>
        writeTracked(
          PLANTED,
          `// ${SITE_BRAND} — сайт\n// ${APP_DISPLAY_NAME} — витрина\n` +
            `export const ID = "com.rusofacilapp.app";\n`,
        ),
      undo: () => dropTracked(PLANTED),
      expect: (r) => !r.unexpected.some((h) => h.file === PLANTED) && r.failures.length === 0,
      negative: true,
    },
    {
      name: "ОТРИЦАТЕЛЬНЫЙ: домен rusofacilapp.com в новом файле — молчание",
      plant: () => writeTracked(PLANTED, '// https://rusofacilapp.com\nexport {};\n'),
      undo: () => dropTracked(PLANTED),
      expect: (r) => r.failures.length === 0,
      negative: true,
    },
  ];

  let ok = true;
  let caughtN = 0;
  let negN = 0;
  for (const control of controls) {
    control.plant();
    let caught;
    try {
      caught = control.expect(scan());
    } finally {
      control.undo();
    }
    const verb = control.negative ? (caught ? "промолчал" : "ЛОЖНО КРАСНЫЙ") : caught ? "поймано" : "ПРОПУЩЕНО";
    console.log(`  ${verb} — ${control.name}`);
    if (caught) (control.negative ? negN++ : caughtN++);
    ok &&= caught;
  }
  const clean = scan();
  const cleanAgain = clean.failures.length === 0;
  console.log(`  ${cleanAgain ? "чисто" : "ВСЁ ЕЩЁ ГРЯЗНО"} — после отката всех подсадок`);
  ok &&= cleanAgain;
  const positives = controls.filter((c) => !c.negative).length;
  const negatives = controls.length - positives;
  console.log(
    ok
      ? `check:brand --plant — ${caughtN} из ${positives} подсадок поймано, ` +
          `${negN} из ${negatives} отрицательных контролей промолчали, откат чистый`
      : "check:brand --plant — FAILED",
  );
  return ok;
}

if (IS_ENTRY_POINT) {
  const ok = process.argv.includes("--plant") ? plantControls() : report(scan());
  process.exitCode = ok ? 0 : 1;
}
