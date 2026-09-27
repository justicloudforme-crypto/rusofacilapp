/**
 * Сторож захода 7.238 — зачёт урока и честные состояния экрана.
 *
 * Каждое правило — находка на видео владельца (POCO, 1.0.9) и замер
 * PROGRESS.md 7.238, часть 1:
 *
 *   1. Зачёт урока держится по ЛУЧШЕЙ попытке. Строка `LessonProgress` одна
 *      на урок; обновление обязано ставить `passed` только в `true` и
 *      никогда не писать туда исход неудачной попытки. Замер до правки:
 *      20/25 → повторная 8/25 — галочка на уровне пропала, «Siguiente
 *      lección» серая (и на сборке до 7.236 — «было всегда»).
 *   2. Время попытки — время ДЕЙСТВИЯ: `completedAt: at` при записи, и
 *      маршрут передаёт одно `at` и в попытку, и в день занятия. Замер до
 *      правки: ответ из очереди «позавчера» — `completedAt` сегодня, и
 *      календарь (день урока берётся из этой колонки) получал «сегодня».
 *   3. Клиент берёт зачёт по лучшей: при ждущей неудачной записи зачёт —
 *      сданная ждущая или сервер; восстановленный зачёт запоминается на
 *      телефоне.
 *   4. Пока неизвестно — не показывать ложное (А2): вкладка упражнений до
 *      восстановления попытки — заглушка, а не пустая форма «0/17»;
 *      кнопка скачивания начинает с «checking», а не с «↓ Descargar».
 *   5. Кнопки итога не сжимаются рядом с подсказкой «Completa…» (А3).
 *   6. «Borrar todo» в кабинете спрашивает своим окном на языке страницы,
 *      а не `window.confirm` с английскими «CANCEL / OK» (А4).
 *
 *   node scripts/check-lesson-credit.mjs
 *   node scripts/check-lesson-credit.mjs --plant   # подсадки: каждая обязана покраснеть
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");

const PROGRESS = "src/lib/progress.ts";
const ROUTE = "src/app/api/progress/route.ts";
const OUTBOX = "src/lib/progress-outbox.ts";
const TAB = "src/components/lesson/ExercisesTab.tsx";
const BUTTON = "src/components/DownloadButton.tsx";
const PANEL = "src/components/profile/DownloadsPanel.tsx";
const FILES = [PROGRESS, ROUTE, OUTBOX, TAB, BUTTON, PANEL];

const load = () => Object.fromEntries(FILES.map((f) => [f, readFileSync(f, "utf8")]));
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

export function violations(src) {
  const out = [];
  const progress = code(src[PROGRESS]);
  const upsert = /function lessonAttemptUpsert\([\s\S]*?\n\}/.exec(progress)?.[0] ?? "";
  const update = /update:\s*\{([^\n]*)\},?\n/.exec(upsert)?.[1] ?? "";
  if (!upsert) out.push("1: нет lessonAttemptUpsert — запись попытки урока ушла в другое место, правило не проверить");
  if (!/\.\.\.\(passed \? \{ passed: true \} : \{\}\)/.test(update)) out.push("1: обновление попытки не держит зачёт — `passed` не «только в true»");
  if (/(^|[\s{,])passed\s*[,}]/.test(update) || /passed:(?!\s*true\b)/.test(update)) out.push("1: обновление попытки пишет в `passed` исход этой попытки — неудачная снимет зачёт");

  if (!/completedAt:\s*at\b/.test(update) || !/create:\s*\{[^\n]*completedAt:\s*at\b/.test(upsert)) out.push("2: время попытки — не время действия (`completedAt: at`)");
  const route = code(src[ROUTE]);
  if (!/const at = actionInstant\(body\?\.at, recordKey !== null\);/.test(route)) out.push("2: маршрут не вычисляет время действия до записи попытки");
  if (!/saveLessonAttemptOnce\([^)]*, at(?:, timeZone)?\)/.test(route) || !/saveLessonAttempt\([^)]*, at(?:, timeZone)?\)/.test(route)) out.push("2: попытка пишется без времени действия");
  // 7 (заход 7.239): повторная попытка переписывает `completedAt`, и день
  // прошлой попытки пропадал из календаря (дни до 31.08.2026 без StudyDay).
  // Обе записи попытки читают прошлое время ДО записи и сохраняют его день;
  // маршрут передаёт зону ученика в обе.
  const keepCalls = (progress.match(/await keepPreviousLessonDay\(userId, previousAt, at, timeZone\);/g) ?? []).length;
  const prevReads = (progress.match(/const previousAt = await previousAttemptAt\(userId, level, lessonSlug\);/g) ?? []).length;
  if (keepCalls !== 2 || prevReads !== 2) out.push(`7: повторная попытка стирает день прошлой из календаря (сохранений дня ${keepCalls} из 2, чтений прошлого времени ${prevReads} из 2)`);
  if (!/keepStudyDay\(userId, timeZone, "lesson", previousAt\)/.test(progress)) out.push("7: день прошлой попытки не записывается строкой дня");
  if (!/saveLessonAttemptOnce\([^)]*, at, timeZone\)/.test(route) || !/saveLessonAttempt\([^)]*, at, timeZone\)/.test(route)) out.push("7: маршрут не передаёт зону ученика — день прошлой попытки не сохранится");
  if (!/markStudyDayVisit\("lesson", user, at\)/.test(route)) out.push("2: день занятия и попытка берут разное время");

  const outbox = code(src[OUTBOX]);
  const restore = /export async function restoreAttemptWith\([\s\S]*?\n\}/.exec(outbox)?.[0] ?? "";
  if (!/pending\.passed \|\|\s*\(await pendingPassedWith\(/.test(restore) || !/\(await fromServer\(\)\.catch\(\(\) => null\)\)\?\.passed/.test(restore)) {
    out.push("3: при ждущей неудачной записи зачёт берётся только из неё — сданный раньше урок снова закрыт");
  }
  const tab = code(src[TAB]);
  if (!/if \(attempt\?\.passed\) \{[\s\S]{0,200}writeLocal\(storageKey, "1"\)/.test(tab)) out.push("3: восстановленный зачёт не запоминается на телефоне");

  if (!/const \[restoring, setRestoring\] = useState\(true\);/.test(tab) || !/if \(restoring\) \{\s*return \(/.test(tab)) {
    out.push("4: вкладка упражнений до восстановления попытки рисует пустую форму («Progreso 0/17»)");
  }
  const button = code(src[BUTTON]);
  if (!/useState<Phase>\(\{ kind: "checking" \}\)/.test(button)) out.push("4: кнопка скачивания начинает с «↓ Descargar», пока опись не прочитана");

  const buttons = [...tab.matchAll(/className="tap ([^"]*)rounded-full/g)].map((m) => m[1]);
  if (buttons.length < 2 || !buttons.every((c) => /\bshrink-0\b/.test(c) && /\bwhitespace-nowrap\b/.test(c))) {
    out.push("5: кнопка итога («Comprobar»/«Volver a intentar») сжимается рядом с подсказкой «Completa…»");
  }

  const panel = code(src[PANEL]);
  if (/\bconfirm\(/.test(panel)) out.push("6: «Borrar todo» спрашивает системным окном (английские CANCEL / OK)");
  if (!/<Modal open=\{confirmAll\}/.test(panel)) out.push("6: у «Borrar todo» нет своего окна подтверждения");
  return out;
}

function plant() {
  const live = load();
  const cases = [{ name: "отрицательный контроль: на живых файлах молчит", ok: violations(live).length === 0 }];
  const add = (name, file, mutate, expect) => {
    const mutated = { ...live, [file]: mutate(live[file]) };
    if (mutated[file] === live[file]) return cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
    cases.push({ name, ok: violations(mutated).some((v) => v.startsWith(expect)) });
  };
  add("обновление снова пишет passed как есть (код до 7.238)", PROGRESS, (s) => s.replace("update: { ...(passed ? { passed: true } : {}), score,", "update: { score, passed,"), "1:");
  add("зачёт — исходом попытки", PROGRESS, (s) => s.replace("...(passed ? { passed: true } : {}), score,", "...(passed ? { passed: true } : {}), passed: passed, score,"), "1:");
  add("время попытки — время приёма", PROGRESS, (s) => s.replace("answers: answersJson, completedAt: at },\n    create", "answers: answersJson, completedAt: new Date() },\n    create"), "2:");
  add("маршрут не передаёт время в попытку", ROUTE, (s) => s.replace("await saveLessonAttempt(user.id, level, lesson, score, passed, mistakes, answers, at, timeZone);", "await saveLessonAttempt(user.id, level, lesson, score, passed, mistakes, answers);"), "2:");
  add("повтор снова стирает прошлый день (код 7.238)", PROGRESS, (s) => s.replace("  await lessonAttemptUpsert(userId, level, lessonSlug, score, passed, mistakes, answers, at);\n  await keepPreviousLessonDay(userId, previousAt, at, timeZone);", "  await lessonAttemptUpsert(userId, level, lessonSlug, score, passed, mistakes, answers, at);"), "7:");
  add("очередь стирает прошлый день", PROGRESS, (s) => s.replace("    ]);\n    await keepPreviousLessonDay(userId, previousAt, at, timeZone);", "    ]);"), "7:");
  add("маршрут не передаёт зону", ROUTE, (s) => s.replace("mistakes, answers, at, timeZone);\n  }", "mistakes, answers, at);\n  }"), "7:");
  add("день — по своему времени", ROUTE, (s) => s.replace('markStudyDayVisit("lesson", user, at)', 'markStudyDayVisit("lesson", user)'), "2:");
  add("зачёт из очереди — только последняя запись", OUTBOX, (s) => s.replace("        pending.passed ||\n", "        pending.passed && false ||\n"), "3:");
  add("зачёт не запоминается", TAB, (s) => s.replace('          writeLocal(storageKey, "1");\n        }\n        if (!attempt', '        }\n        if (!attempt'), "3:");
  add("пустая форма до восстановления", TAB, (s) => s.replace("useState(true);\n  const [sending", "useState(false);\n  const [sending"), "4:");
  add("кнопка снова начинает с «Descargar»", BUTTON, (s) => s.replace('useState<Phase>({ kind: "checking" })', 'useState<Phase>({ kind: "idle" })'), "4:");
  add("«Volver a intentar» снова сжимается", TAB, (s) => s.replace('className="tap shrink-0 whitespace-nowrap rounded-full border', 'className="tap rounded-full border'), "5:");
  add("снова window.confirm", PANEL, (s) => s.replace("onClick={() => setConfirmAll(true)}", "onClick={() => window.confirm(t.removeAllConfirm) && setConfirmAll(true)}"), "6:");
  add("окна подтверждения нет", PANEL, (s) => s.replace("<Modal open={confirmAll}", "<Modal open={false}"), "6:");

  for (const c of cases) console.log(`  ${c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО"} — ${c.name}`);
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `check:lesson-credit --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль` : "check:lesson-credit --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const bad = violations(load());
  if (bad.length) {
    console.error(`check:lesson-credit — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log("check:lesson-credit — 7 правил, нарушений 0 (заходы 7.238–7.239: зачёт по лучшей попытке, время действия, честные состояния, своё окно, прошлый день урока)");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
