/**
 * ПЕРЕПИСЬ ТЕМ СПРАШИВАЕТСЯ ОДНИМ МЕСТОМ, И ЭТО МЕСТО УМЕЕТ ОТМЕНЯТЬ
 * (заход 7.199, часть 1).
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО
 * ====================================================================
 *
 * Четыре режима словаря держали по ОДИНАКОВОМУ эффекту:
 *
 *     useEffect(() => {
 *       fetchCategorySummary(levelFilter).then((body) => { …setState… });
 *     }, [levelFilter, …]);
 *
 * без единого признака отмены. Переключение уровня оставляет в воздухе два
 * запроса; ответ на предыдущий разрез приходит позже и перезаписывает
 * состояние — после чего сетка тем и строка «Продолжить» печатают заглушку
 * навсегда, потому что снять её может только новый ответ, а запрашивать
 * его больше некому. Ровно это владелец снял на телефоне 15.09.2026: на
 * уровне C1 «Продолжить» показывало слова разреза «все уровни» («молоко»,
 * «арендатор», «гибкий график») и серые полоски вместо чисел, не меньше
 * 18 секунд подряд.
 *
 * Четыре копии одного эффекта и дали четыре копии одного дефекта. Поэтому
 * здесь стоит не правка, а правило: правило живёт по одному разу.
 *
 * ====================================================================
 * ЧТО ПРОВЕРЯЕТСЯ — ТРИ УТВЕРЖДЕНИЯ, И КАЖДОЕ ПАДАЕТ ОТДЕЛЬНО
 * ====================================================================
 *
 * 1. Общий крючок `src/lib/flashcards/use-category-summary.ts` существует,
 *    и его эффект ОТМЕНЯЕМ: признак отмены объявлен, взводится уборкой
 *    эффекта и читается перед записью состояния.
 * 2. Ни один файл словаря (`src/components/flashcards/**`) не зовёт
 *    `fetchCategorySummary` сам — только через крючок.
 * 3. Всякий ОСТАЛЬНОЙ вызов `fetchCategorySummary` в `src/` стоит рядом со
 *    своим признаком отмены (сегодня такой один — `WordGamePlayer`).
 *
 * Почему это не заменяет стенд в `src/components/flashcards/level-race.test.tsx`:
 * там проверяется ПОВЕДЕНИЕ на быстром переключении уровней, здесь — форма
 * кода, из-за которой поведение было таким. Один без другого чинится
 * молча.
 *
 *   node scripts/check-summary-race.mjs
 *   node scripts/check-summary-race.mjs --plant
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const HOOK = "src/lib/flashcards/use-category-summary.ts";
const DICT_DIR = "src/components/flashcards";
const SRC = "src";
const CALL = "fetchCategorySummary(";
/** Где эта функция ОБЪЯВЛЕНА — вызовом её упоминание там не является. */
const DEFINITION = "src/lib/flashcards/summary-client.ts";
/** Файл, которому вызов разрешён напрямую: он и есть общее место. */
const OWNER = HOOK;
/** Слова, которыми в этом дереве называют признак отмены. Список закрытый:
 *  новое слово — это новое место, где правило надо прочитать глазами. */
const CANCEL_WORDS = ["cancelled", "canceled", "alive", "ignore", "stale"];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Есть ли у вызова в этом файле признак отмены: объявление, взвод в
 *  уборке и чтение перед записью. Три признака, а не один: любой из трёх
 *  по отдельности встречается и без отмены. */
function hasCancelGuard(text) {
  return CANCEL_WORDS.some((w) => {
    const declared = new RegExp(`let ${w}\\s*=\\s*(true|false)`).exec(text);
    if (!declared) return false;
    // Полярность не важна («cancelled = false → true» и «alive = true →
    // false» — одно и то же), важно, что признак ПЕРЕКЛЮЧАЕТСЯ и что его
    // читают перед записью состояния.
    const flipped = declared[1] === "false" ? "true" : "false";
    return (
      new RegExp(`${w}\\s*=\\s*${flipped}`).test(text) && new RegExp(`if \\(!?${w}\\)`).test(text)
    );
  });
}

export function audit(files, hookText) {
  const problems = [];

  if (!hookText) {
    problems.push(`${HOOK}: общего крючка нет вовсе — перепись снова спрашивается по месту`);
  } else if (!hasCancelGuard(hookText)) {
    problems.push(`${HOOK}: у эффекта нет признака отмены — опоздавший ответ снова перетрёт текущий разрез`);
  }

  for (const [path, text] of files) {
    if (!text.includes(CALL)) continue;
    if (path === OWNER || path === DEFINITION) continue;
    if (path.startsWith(DICT_DIR)) {
      problems.push(`${path}: зовёт ${CALL.slice(0, -1)} напрямую — в словаре это делает только ${HOOK}`);
      continue;
    }
    if (!hasCancelGuard(text)) {
      problems.push(`${path}: зовёт ${CALL.slice(0, -1)} без признака отмены`);
    }
  }
  return problems;
}

function read() {
  const files = walk(SRC).map((p) => [p, readFileSync(p, "utf8")]);
  let hookText = null;
  try {
    hookText = readFileSync(HOOK, "utf8");
  } catch {
    hookText = null;
  }
  return { files, hookText };
}

export async function main() {
  const plant = process.argv.slice(2).includes("--plant");
  const { files, hookText } = read();
  const callers = files.filter(([p, t]) => t.includes(CALL) && p !== DEFINITION).map(([p]) => p);

  if (!plant) {
    const problems = audit(files, hookText);
    if (problems.length) {
      console.error("ГОНКА РАЗРЕЗОВ СЛОВАРЯ:");
      for (const p of problems) console.error(`  ${p}`);
      return 1;
    }
    console.log(
      `check:summary-race — вызовов ${CALL.slice(0, -1)} в src: ${callers.length} ` +
        `(${callers.join(", ")}); у каждого признак отмены, в словаре прямых вызовов 0. Подсадки — --plant.`,
    );
    return 0;
  }

  const negative = audit(files, hookText);
  let ok = negative.length === 0;
  console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровый продукт (отрицательный контроль)`);

  const plants = [
    [
      "у крючка отобран признак отмены — код ДО правки",
      () => audit(files, hookText.replace(/let cancelled = false;/, "const cancelled = false;")),
    ],
    [
      "режим словаря снова зовёт перепись сам",
      () => audit([...files, [`${DICT_DIR}/PlantedApp.tsx`, "fetchCategorySummary(levelFilter).then(() => {});"]], hookText),
    ],
    [
      "чужой вызов без признака отмены",
      () => audit([...files, ["src/components/planted/Widget.tsx", "fetchCategorySummary('all').then(() => {});"]], hookText),
    ],
    ["крючка нет вовсе", () => audit(files, null)],
  ];

  let caught = 0;
  for (const [name, run] of plants) {
    const hit = run().length > 0;
    if (hit) caught++;
    console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
  }
  ok &&= caught === plants.length;
  console.log(
    ok
      ? `check:summary-race --plant — ${caught} из ${plants.length} подсадок, 1 из 1 отрицательный контроль`
      : `check:summary-race --plant — FAILED (${caught} из ${plants.length})`,
  );
  return ok ? 0 : 1;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
