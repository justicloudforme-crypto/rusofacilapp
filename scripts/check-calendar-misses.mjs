/**
 * «Пропуск считается с первого ЗАНЯТИЯ, а не с регистрации» — сторож
 * долга 157 (заход 7.187).
 *
 * ЧТО ЗАМЕРЕНО. Учётная запись владельца: регистрация 26.08.2026, занятий
 * ноль, сегодня 12.09.2026 — календарь рисовал **18 холодных значков
 * «пропуск» подряд** (6 в августе + 12 в сентябре) при серии 0. Число
 * воспроизведено на стенде (`src/lib/activity-calendar.test.ts`) и после
 * правки равно **0**; там же остался позитивный контроль прибора — те же
 * дни с границей по регистрации по-прежнему дают 18.
 *
 * ПОЧЕМУ ОДНИХ ТЕСТОВ МАЛО. Арифметика сетки живёт в `activity-calendar.ts`
 * и тестами закрыта. А вот ТО, ЧТО ИМЕННО в неё передаёт страница
 * профиля, тестом не закрыто ничем: серверный компонент на 1500 строк в
 * jsdom не рендерится. Между тем вернуть болезнь целиком можно одной
 * буквой — написать `missedFromDateKey={registeredDateKey}`. Сторож
 * следит ровно за этой буквой.
 *
 *   node scripts/check-calendar-misses.mjs          # гейт
 *   node scripts/check-calendar-misses.mjs --plant  # позитивный и отрицательный контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const PAGE = "src/app/[lang]/profile/page.tsx";
const LIB = "src/lib/activity-calendar.ts";

export function violationsIn(page, lib) {
  const bad = [];

  const passed = /missedFromDateKey=\{([^}]+)\}/.exec(page);
  if (!passed) {
    bad.push("страница профиля не передаёт календарю missedFromDateKey вовсе — пропуски снова пойдут от регистрации");
  } else {
    const value = passed[1].trim();
    if (/registered|createdAt/i.test(value)) {
      bad.push(`календарю передана ДАТА РЕГИСТРАЦИИ (\`${value}\`) — ровно то, из-за чего завёлся долг 157`);
    } else if (value !== "firstStudyDateKey") {
      bad.push(`календарю передано неизвестное значение \`${value}\`: сторож не может поручиться, что это день первого занятия`);
    }
  }

  const derivation = /const firstStudyDateKey\s*=([\s\S]{0,400}?);\n/.exec(page);
  if (!derivation) bad.push("в странице профиля нет вывода firstStudyDateKey");
  else {
    const body = derivation[1];
    if (!/activityDateKeys/.test(body)) {
      bad.push("firstStudyDateKey выведен НЕ из activityDateKeys — день первого занятия можно взять только из дней занятий");
    }
    if (!/\bnull\b/.test(body)) {
      bad.push("firstStudyDateKey не умеет быть null — «занятий не было ни одного» обязано отличаться от «первое занятие сегодня»");
    }
  }

  // Читается ИМЕННО описание входа сетки, а не весь файл: `firstDateKey`
  // законно живёт параметром `navigableMonths` (окно перелистывания
  // по-прежнему начинается с регистрации — это другая величина), и запрет
  // на слово во всём файле поймал бы её.
  const shape = /interface MonthGridInput \{([\s\S]*?)\n\}/.exec(lib);
  if (!shape) bad.push("в activity-calendar.ts не нашлось описания MonthGridInput — сторож ослеп");
  else {
    if (/\bfirstDateKey\b/.test(shape[1])) {
      bad.push("во входе сетки снова есть firstDateKey: граница пропусков обязана называться missedFromDateKey, иначе смысл подменяется молча");
    }
    if (!/missedFromDateKey/.test(shape[1])) bad.push("во входе сетки нет missedFromDateKey — сторож ослеп");
  }
  return bad;
}

function plant() {
  const page = readFileSync(PAGE, "utf8");
  const lib = readFileSync(LIB, "utf8");
  const cases = [{ name: "отрицательный контроль: живой код сегодня чист", ok: violationsIn(page, lib).length === 0 }];
  const planted = (mutated, name, expect, which = "page") => {
    if (mutated === (which === "page" ? page : lib)) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    const found = which === "page" ? violationsIn(mutated, lib) : violationsIn(page, mutated);
    cases.push({ name, ok: found.some((f) => f.includes(expect)) });
  };

  planted(
    page.replace("missedFromDateKey={firstStudyDateKey}", "missedFromDateKey={registeredDateKey}"),
    "подсадка: НАСТОЯЩАЯ болезнь — календарю передана дата регистрации",
    "ДАТА РЕГИСТРАЦИИ",
  );
  planted(
    page.replace("missedFromDateKey={firstStudyDateKey}\n", ""),
    "подсадка: свойство просто убрали — поймано",
    "не передаёт календарю",
  );
  planted(
    page.replace(
      "  const firstStudyDateKey =\n    activityDateKeys.length === 0\n      ? null\n      : activityDateKeys.reduce((earliest, key) => (key < earliest ? key : earliest));",
      "  const firstStudyDateKey = registeredDateKey;",
    ),
    "подсадка: firstStudyDateKey выведен из регистрации — поймано",
    "НЕ из activityDateKeys",
  );
  planted(
    lib.replace("missedFromDateKey: string | null;", "firstDateKey: string;\n  missedFromDateKey: string | null;"),
    "подсадка: firstDateKey вернулся в сетку — поймано",
    "снова есть firstDateKey",
    "lib",
  );

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:calendar-misses --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const bad = violationsIn(readFileSync(PAGE, "utf8"), readFileSync(LIB, "utf8"));
  if (bad.length) {
    console.error("ПРОПУСКИ СНОВА СЧИТАЮТСЯ ОТ РЕГИСТРАЦИИ (долг 157):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log("[check:calendar-misses] граница пропусков — день первого занятия, выведенный из дней занятий и умеющий быть null (контроль — --plant).");
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
