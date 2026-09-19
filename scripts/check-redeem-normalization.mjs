/**
 * ОТКАЗ В ПОГАШЕНИИ КОДА НАЗЫВАЕТ, ЧТО НОРМАЛИЗАЦИЯ УБРАЛА — ДОЛГ 103 (7.217).
 *
 * Строка долга дословно: «новая нормализация покрывает четыре класса
 * знаков, которые **найдены разбором**, а не измерением живого входа:
 * сколько людей вообще вставляет код с тире, неизвестно — маршрут
 * погашения шлёт в Sentry длину кода и причину отказа, но не то, что
 * нормализация из строки выбросила. Сегодня отказ `unknown` от опечатки и
 * отказ `unknown` от невидимого знака неразличимы в отчётах → в теге
 * Sentry появляется признак «строка изменилась нормализацией» (без
 * значения кода) → пересмотреть список классов числом; до тех пор пятый
 * класс, если он есть, найдётся только новой жалобой».
 *
 * ЧЕТЫРЕ ПРАВИЛА:
 *   а) `describeNormalization` объявлена в `access-code-format.ts` и
 *      называет ВСЕ классы, включая пятый — `other`, тот самый «если он
 *      есть»: знак, переживший нормализацию и не являющийся латинской
 *      буквой или цифрой;
 *   б) отчёт об отказе ставит тег `normalized` — иначе признака в Sentry
 *      нет и долг вернулся дословно;
 *   в) отчёт получает СЫРУЮ строку: по нормализованной сказать, что из
 *      неё выбросили, нельзя в принципе — ровно этой дырой долг и жил;
 *   г) ни значение кода, ни сырая строка в отчёт не уходят: в `tags` и
 *      `extra` разрешены только длины и счётчики классов.
 *
 *   node scripts/check-redeem-normalization.mjs          # гейт
 *   node scripts/check-redeem-normalization.mjs --plant  # контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const FORMAT = "src/lib/access-code-format.ts";
const LIB = "src/lib/access-code.ts";

export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

/** Пятый класс назван прямо: без него правило «пересмотреть список
 *  классов числом» так и осталось бы обещанием. */
const REQUIRED_CLASSES = ["case", "space", "dash", "invisible", "homoglyph", "other"];

export function violations(formatRaw, libRaw) {
  const format = stripComments(formatRaw);
  const lib = stripComments(libRaw);
  const bad = [];

  if (!format) {
    bad.push(`${FORMAT}: файл не прочитан — сторож ослеп, а не доволен`);
    return bad;
  }
  if (!/export function describeNormalization\(/.test(format)) {
    bad.push(`${FORMAT}: describeNormalization не объявлена — отчёт об отказе снова не знает, что нормализация убрала (долг 103)`);
  }
  const classes = /NORMALIZATION_CLASSES\s*=\s*\[([\s\S]*?)\]/.exec(format)?.[1] ?? "";
  for (const name of REQUIRED_CLASSES) {
    if (!new RegExp(`"${name}"`).test(classes)) {
      bad.push(`${FORMAT}: класса "${name}" в NORMALIZATION_CLASSES нет — отчёт о нём промолчит (долг 103)`);
    }
  }

  if (!lib) {
    bad.push(`${LIB}: файл не прочитан — сторож ослеп, а не доволен`);
    return bad;
  }
  const report = /async function reportRefusal\(([\s\S]*?)\n\}/.exec(lib)?.[0] ?? "";
  if (!report) {
    bad.push(`${LIB}: объявления reportRefusal не найдено — сторож ослеп`);
    return bad;
  }
  if (!/tags:\s*\{[^}]*normalized:/.test(report)) {
    bad.push(`${LIB}: у отказа нет тега normalized — отказ от опечатки и отказ от невидимого знака снова неразличимы (долг 103)`);
  }
  if (!/raw:\s*string/.test(report)) {
    bad.push(`${LIB}: reportRefusal не получает сырую строку — сказать, что из неё выбросили, нечем (долг 103)`);
  }
  // Ни одного вызова без сырой строки.
  const calls = lib.match(/reportRefusal\((?:[^()]|\([^()]*\))*\)/g) ?? [];
  const sites = calls.filter((c) => !/\braw:/.test(c));
  for (const c of sites) bad.push(`${LIB}: вызов отчёта без сырой строки: ${c.replace(/\s+/g, " ").slice(0, 80)}`);

  // Значение кода наружу не уходит: в tags и extra запрещены сами строки.
  const payload = /tags:\s*\{[\s\S]*?extra:\s*\{[\s\S]*?\},/.exec(report)?.[0] ?? report;
  if (/(^|[^A-Za-z])code\s*[,:](?!\s*Length)/.test(payload) || /\braw\s*[,:](?!\s*Length)/.test(payload)) {
    bad.push(`${LIB}: в отчёт уходит само значение кода, а не его длина (долг 103)`);
  }
  return bad;
}

function plant() {
  const format = readFileSync(FORMAT, "utf8");
  const lib = readFileSync(LIB, "utf8");
  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(format, lib).length === 0 }];
  const add = (name, f, l, expect) => {
    if (f === format && l === lib) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(f, l).some((x) => x.includes(expect)) });
  };

  add("подсадка: describeNormalization снесена (состояние до 19.09.2026)", format.replace("export function describeNormalization(", "function describeNormalizationX("), lib, "не объявлена");
  add("подсадка: пятый класс убран из списка", format.replace('"homoglyph", "other"', '"homoglyph"'), lib, 'класса "other"');
  add("подсадка: тег normalized убран", format, lib.replace(/normalized: normalizationTag\(shape\)/, ""), "нет тега normalized");
  add("подсадка: отчёт снова получает только нормализованный код", format, lib.replace("code: string; raw: string", "code: string"), "не получает сырую строку");
  add("подсадка: один вызов забыл сырую строку", format, lib.replace('await reportRefusal("already_has_access", { userId: user.id, code, raw: rawCode });', 'await reportRefusal("already_has_access", { userId: user.id, code });'), "вызов отчёта без сырой строки");
  add("подсадка: в отчёт положили само значение кода", format, lib.replace("        codeLength: context.code.length,", "        code: context.code,"), "само значение кода");

  for (const c of cases) {
    const verdict = c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО";
    console.log(`  ${verdict} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `check:redeem-normalization --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль` : "check:redeem-normalization --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const read = (p) => {
    try {
      return readFileSync(p, "utf8");
    } catch {
      return "";
    }
  };
  const bad = violations(read(FORMAT), read(LIB));
  if (bad.length) {
    console.error(`check:redeem-normalization — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log(`check:redeem-normalization — 4 правила, классов ${REQUIRED_CLASSES.length}, нарушений 0 (долг 103)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
