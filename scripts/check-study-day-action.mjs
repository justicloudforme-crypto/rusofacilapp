/**
 * ДЕНЬ ЗАНЯТИЯ СТАВИТ ДЕЙСТВИЕ, А НЕ ОТКРЫТИЕ СТРАНИЦЫ — сторож правила
 * от 17.09.2026 (решение владельца, заход 7.204).
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО
 * ====================================================================
 *
 * С 31.08.2026 день ставило ОТКРЫТИЕ шести поверхностей (урок, экзамен,
 * рассказ, словарь, тема словаря, медиа). 17.09.2026 владелец снял на
 * видео, как бесплатному аккаунту записался полный день занятий за одно
 * открытие словаря: строка `StudyDay`, источник `flashcards`, `markedAt`
 * 2026-09-16T14:45:12.740Z, зона ученика Asia/Vladivostok — ни одной
 * карточки отвечено не было. Решение: день ставит ДЕЙСТВИЕ.
 *
 * ====================================================================
 * ЧТО СТОРОЖИТСЯ — ОБЕ СТОРОНЫ, И КАЖДАЯ ПАДАЕТ ОТДЕЛЬНО
 * ====================================================================
 *
 *  1. НИ ОДНА СТРАНИЦА не ставит день. Ни один файл `page.tsx` или
 *     `layout.tsx` во всём `src/app/` не смеет упоминать
 *     `markStudyDayVisit` или `markStudyDay(`. Именно эта форма (вызов в
 *     теле серверного компонента) и была прежним правилом, поэтому
 *     проверяется она, а не список из шести имён: седьмая страница,
 *     дописанная завтра, обязана ловиться тем же условием.
 *  2. КАЖДОЕ ДЕЙСТВИЕ ИЗ СПИСКА ВЛАДЕЛЬЦА ставит день — поимённо, с
 *     нужным источником, в нужном маршруте (таблица ACTIONS ниже).
 *  3. РАССКАЗ — НЕ ЗА ОТКРЫТИЕ, А ЗА ПОЛОВИНУ: вызов в
 *     `/api/reading-progress` обязан стоять за порогом
 *     `STUDY_DAY_READ_PERCENT`, иначе первая же перевёрнутая страница
 *     (то есть почти открытие) снова давала бы день.
 *  4. БОЛЬШЕ НИКТО. Всякое упоминание `markStudyDayVisit` в `src/`,
 *     которого нет в таблице, — падение: правило живёт списком, а не
 *     привычкой.
 *
 * Чего сторож НЕ проверяет, и это сказано прямо: он читает ФОРМУ кода, а
 * не поведение живой базы. Поведение заперто рядом — юнит-тестами
 * маршрутов и сценариями `scripts/scenarios/study-day.scenario.ts`.
 *
 *   node scripts/check-study-day-action.mjs          # гейт
 *   node scripts/check-study-day-action.mjs --plant  # положительный контроль
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");

/** Маршрут → источник, который он обязан ставить. Список закрытый: это и
 *  есть правило владельца, переписанное в проверяемую форму. */
const ACTIONS = {
  "src/app/api/flashcard-progress/route.ts": "flashcards",
  "src/app/api/progress/route.ts": "lesson",
  "src/app/api/exams/[level]/[examSlug]/attempt/route.ts": "exam",
  "src/app/api/word-games/check/route.ts": "word-game",
  "src/app/api/reading-progress/route.ts": "story",
  "src/app/api/study-day/route.ts": "media",
};

/** Файл, которому упоминание разрешено всегда: он и есть общее место. */
const OWNER = "src/lib/study-day-visit.ts";

const MENTION = /markStudyDayVisit\s*\(/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Все файлы `src/`, кроме тестов: у тестов упоминание законно всегда. */
function sourceFiles() {
  return walk("src").filter((f) => !/\.test\.tsx?$/.test(f)).map((f) => f.split("\\").join("/"));
}

/** `read(path)` подменяем в подсадке, поэтому чтение всегда через него. */
export function violations(read, files) {
  const bad = [];

  // 1. Страницы не ставят день.
  for (const file of files) {
    if (!/\/(page|layout)\.tsx$/.test(file)) continue;
    const code = read(file);
    if (MENTION.test(code) || /\bmarkStudyDay\s*\(/.test(code)) {
      bad.push(`${file}: страница ставит день занятия — с 17.09.2026 день ставит ДЕЙСТВИЕ, а не открытие`);
    }
  }

  // 2. Каждое действие ставит свой день.
  for (const [file, source] of Object.entries(ACTIONS)) {
    if (!files.includes(file)) {
      bad.push(`${file}: маршрута нет вовсе — действие из списка владельца день больше не ставит`);
      continue;
    }
    const code = read(file);
    const re = new RegExp(`markStudyDayVisit\\(\\s*(?:body\\.source|"${source}")`);
    if (!re.test(code)) {
      bad.push(`${file}: не ставит день занятия источником "${source}" (список правила — в шапке src/lib/study-day.ts)`);
    }
  }

  // 3. Рассказ — только за половину.
  const reading = files.includes("src/app/api/reading-progress/route.ts")
    ? read("src/app/api/reading-progress/route.ts")
    : "";
  if (reading && !/percent\s*>=\s*STUDY_DAY_READ_PERCENT[^\n]*markStudyDayVisit/.test(reading)) {
    bad.push(
      "src/app/api/reading-progress/route.ts: отметка дня не стоит за порогом STUDY_DAY_READ_PERCENT — " +
        "первая же перевёрнутая страница снова давала бы день за почти-открытие",
    );
  }

  // 4. Больше никто.
  for (const file of files) {
    if (file === OWNER || file in ACTIONS) continue;
    if (MENTION.test(read(file))) {
      bad.push(`${file}: зовёт markStudyDayVisit, и этого места нет в списке правила`);
    }
  }
  return bad;
}

const realRead = (file) => readFileSync(file, "utf8");

function plant() {
  const files = sourceFiles();
  const cases = [];
  const check = (name, read, list, expect) => {
    const found = violations(read, list);
    cases.push({ name, ok: found.some((f) => f.includes(expect)) });
  };

  cases.push({ name: "отрицательный контроль: живое дерево сегодня чисто", ok: violations(realRead, files).length === 0 });

  // Подсадка 1: вернуть отметку на ОТКРЫТИЕ страницы словаря.
  const VOCAB = "src/app/[lang]/vocabulary/page.tsx";
  check(
    "подсадка: открытие словаря снова ставит день — поймано",
    (f) => (f === VOCAB ? realRead(f) + '\nawait markStudyDayVisit("flashcards");\n' : realRead(f)),
    files,
    "страница ставит день занятия",
  );

  // Подсадка 2: у каждого действия по очереди отнять отметку.
  for (const [file, source] of Object.entries(ACTIONS)) {
    check(
      `подсадка: «${source}» перестал ставить день (${file}) — поймано`,
      (f) => (f === file ? realRead(f).replace(/markStudyDayVisit\(/g, "noop(") : realRead(f)),
      files,
      `источником "${source}"`,
    );
  }

  // Подсадка 3: снять порог половины у рассказа.
  check(
    "подсадка: рассказ снова засчитывается с первой страницы — поймано",
    (f) =>
      f === "src/app/api/reading-progress/route.ts"
        ? realRead(f).replace("if (percent >= STUDY_DAY_READ_PERCENT) await markStudyDayVisit", "await markStudyDayVisit")
        : realRead(f),
    files,
    "STUDY_DAY_READ_PERCENT",
  );

  // Подсадка 4: отметка в файле, которого нет в списке.
  const STRANGER = "src/lib/streaks.ts";
  check(
    "подсадка: отметка дня в месте вне списка — поймана",
    (f) => (f === STRANGER ? realRead(f) + '\nmarkStudyDayVisit("lesson");\n' : realRead(f)),
    files,
    "нет в списке правила",
  );

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:study-day-action --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const bad = violations(realRead, sourceFiles());
  if (bad.length) {
    console.error("ДЕНЬ ЗАНЯТИЯ СНОВА СТАВИТСЯ НЕ ТЕМ СОБЫТИЕМ (правило 17.09.2026):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(
    `[check:study-day-action] ни одна страница день не ставит; ${Object.keys(ACTIONS).length} действий из списка владельца ставят его сами, рассказ — только с половины (контроль — --plant).`,
  );
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
