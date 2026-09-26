/**
 * Сторож очереди ответов без сети — заход 7.236 (офлайн-3б).
 *
 * Что он держит (каждое правило — замер 7.236, PROGRESS.md, часть 1):
 *
 *   1. Возврат сети не перезагружает страницу: `reloadOnOnline: false`
 *      в ОБОИХ местах Serwist — вебпак-плагин (`next.config.ts`) и
 *      провайдер (`[lang]/layout.tsx`). Выключили одно — страница всё равно
 *      перезагружалась, и введённые без сети ответы урока пропадали.
 *   2. Вкладка упражнений пишет вошедшего В ОЧЕРЕДЬ (`enqueueProgress`), а
 *      не в старую localStorage-очередь без ключа и владельца.
 *   3. Очередь отправляет только записи ТЕКУЩЕГО владельца и без маячка.
 *      Замер до правки: попытка A легла под B.
 *   4. Сервер: чужой владелец — отказ ДО записи; запись с ключом —
 *      `saveLessonAttemptOnce`; день занятия — по времени действия.
 *      Замер до правки: сервер обработал одну попытку дважды.
 *   5. Квитанция и попытка — одной транзакцией (`$transaction` с
 *      `offlineReceipt.create`), и таблица едет на прод сборкой
 *      (`ensure-schema-sync.ts`).
 *   6. Очередь уходит с любой страницы: `ProgressOutboxSync` в разметке.
 *   7. Копия урока без сети: вместо мёртвых упражнений — плашка
 *      (`offlineExercisesOf` в `copyMarkupOf`, метка живой панели).
 *   8. Вход уводит уже вошедшего (находка 3): форма «Inicia sesión» при
 *      аватаре в шапке после возврата сети.
 *   9. Сцена праздника, чей чанк не пришёл без сети, — пустая сцена, а не
 *      «Algo salió mal» вместо урока (Chromium без воркера и WebKit).
 *
 *   node scripts/check-progress-outbox.mjs
 *   node scripts/check-progress-outbox.mjs --plant   # подсадки: каждая обязана покраснеть
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");

const NEXT_CONFIG = "next.config.ts";
const LAYOUT = "src/app/[lang]/layout.tsx";
const TAB = "src/components/lesson/ExercisesTab.tsx";
const OUTBOX = "src/lib/progress-outbox.ts";
const ROUTE = "src/app/api/progress/route.ts";
const PROGRESS = "src/lib/progress.ts";
const SCHEMA_SYNC = "prisma/ensure-schema-sync.ts";
const SCHEMA = "prisma/schema.prisma";
const CLIENT = "src/lib/downloads-client.ts";
const LESSON_VIEW = "src/components/lesson/LessonView.tsx";
const LOGIN = "src/app/[lang]/login/page.tsx";
const STAGE = "src/components/celebration/ScenarioStage.tsx";
const FILES = [NEXT_CONFIG, LAYOUT, TAB, OUTBOX, ROUTE, PROGRESS, SCHEMA_SYNC, SCHEMA, CLIENT, LESSON_VIEW, LOGIN, STAGE];

const load = () => Object.fromEntries(FILES.map((f) => [f, readFileSync(f, "utf8")]));
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

export function violations(src) {
  const out = [];
  const next = code(src[NEXT_CONFIG]);
  const layout = code(src[LAYOUT]);
  if (!/reloadOnOnline:\s*false/.test(next)) out.push("1: next.config.ts — у withSerwistInit нет `reloadOnOnline: false`: sw-entry перезагрузит страницу по `online`");
  if (!/<SerwistProvider[\s\S]*?reloadOnOnline=\{false\}[\s\S]*?>/.test(layout)) out.push("1: layout — у <SerwistProvider> нет `reloadOnOnline={false}`");

  const tab = code(src[TAB]);
  if (!/enqueueProgress\(/.test(tab)) out.push("2: ExercisesTab не пишет ответ в очередь (enqueueProgress)");
  if (/queuePendingProgress\(/.test(tab)) out.push("2: ExercisesTab снова пишет в старую localStorage-очередь без ключа и владельца");
  if (!/key:\s*newRecordKey\(\)/.test(tab) || !/at:\s*Date\.now\(\)/.test(tab) || !/owner:\s*ownerScope/.test(tab)) {
    out.push("2: запись очереди без ключа, времени действия или владельца");
  }

  const outbox = code(src[OUTBOX]);
  const flush = /export async function flushWith\([\s\S]*?\n\}/.exec(outbox)?.[0] ?? "";
  if (!/records\.filter\(\(r\) => r\.owner === owner\)/.test(flush)) out.push("3: flushWith отправляет не только записи текущего владельца");
  if (!/beacon:\s*false/.test(flush)) out.push("3: flushWith отправляет с маячком — запись стёрлась бы без подтверждения");

  const route = code(src[ROUTE]);
  const foreignAt = route.search(
    /if \(isForeignRecord\(body\?\.owner, ownerScopeFor\(user\.id\)\)\) \{\s*return NextResponse\.json\(\{ error: "owner_mismatch" \}, \{ status: 409 \}\);/,
  );
  const saveAt = route.search(/saveLessonAttempt(Once)?\(/);
  if (foreignAt < 0 || saveAt < 0 || foreignAt > saveAt) out.push("4: /api/progress не отказывает чужой записи ДО записи попытки");
  if (!/if \(recordKey\)[\s\S]*?saveLessonAttemptOnce\(/.test(route)) out.push("4: запись с ключом пишется не через saveLessonAttemptOnce — повтор ключа запишется второй раз");
  if (!/once === "duplicate"\) return/.test(route)) out.push("4: повтор ключа не возвращается до отметки дня занятия");
  if (!/markStudyDayVisit\("lesson", user, actionInstant\(/.test(route)) out.push("4: день занятия ставится не по времени действия");

  const progress = code(src[PROGRESS]);
  const once = /export async function saveLessonAttemptOnce\([\s\S]*?\n\}/.exec(progress)?.[0] ?? "";
  if (!/\$transaction\(\[\s*db\.offlineReceipt\.create/.test(once)) out.push("5: квитанция и попытка пишутся не одной транзакцией");
  if (!/CREATE TABLE IF NOT EXISTS "OfflineReceipt"/.test(src[SCHEMA_SYNC]) || !/model OfflineReceipt \{/.test(src[SCHEMA])) {
    out.push("5: таблицы OfflineReceipt нет в схеме или её не везёт на прод ensure-schema-sync");
  }

  if (!/<ProgressOutboxSync owner=/.test(layout)) out.push("6: ProgressOutboxSync не смонтирован в разметке — очередь не уйдёт без вкладки упражнений");

  const client = code(src[CLIENT]);
  if (!/export function copyMarkupOf\([\s\S]*?offlineExercisesOf\(clone\);/.test(client)) out.push("7: copyMarkupOf не заменяет упражнения в копии — мёртвые кнопки без сети");
  if (!/data-offline-panel="exercises"\s+data-rf-exercises-live/.test(src[LESSON_VIEW])) out.push("7: живая панель упражнений без метки data-rf-exercises-live");

  const login = code(src[LOGIN]);
  if (!/if \(await getCurrentUserForChrome\(\)\) \{\s*redirect\(signedInLoginTarget\(/.test(login)) out.push("8: страница входа не уводит уже вошедшего");
  if (!/entry\.load\(\)\.catch\(\(\) => \{[\s\S]*?return \{ default: NoScenario \};/.test(code(src[STAGE]))) {
    out.push("9: ScenarioStage грузит сцену без перехвата — не пришедший чанк роняет страницу урока");
  }
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
  add("reloadOnOnline снят у плагина", NEXT_CONFIG, (s) => s.replace("reloadOnOnline: false,", ""), "1:");
  add("reloadOnOnline снят у провайдера", LAYOUT, (s) => s.replace("\n          reloadOnOnline={false}\n", "\n"), "1:");
  add("вкладка вернулась к старой очереди", TAB, (s) => s.replace("void enqueueProgress(record)", "queuePendingProgress(record); void Promise.resolve(\"queued\")"), "2:");
  add("запись без владельца", TAB, (s) => s.replace("owner: ownerScope };", "owner: \"\" };"), "2:");
  add("очередь шлёт всех владельцев", OUTBOX, (s) => s.replace("records.filter((r) => r.owner === owner)", "records.filter(() => true)"), "3:");
  add("очередь шлёт с маячком", OUTBOX, (s) => s.replace("{ beacon: false, attempts: 2", "{ beacon: true, attempts: 2"), "3:");
  add("сервер не сверяет владельца", ROUTE, (s) => s.replace("if (isForeignRecord(", "if (false && isForeignRecord("), "4:");
  add("запись с ключом пишется без квитанции", ROUTE, (s) => s.replace("const once = await saveLessonAttemptOnce(", "const once = await saveLessonAttempt("), "4:");
  add("день — по времени приёма", ROUTE, (s) => s.replace('markStudyDayVisit("lesson", user, actionInstant(body?.at, recordKey !== null))', 'markStudyDayVisit("lesson", user)'), "4:");
  add("квитанция вне транзакции", PROGRESS, (s) => s.replace("await db.$transaction([\n      db.offlineReceipt.create", "await Promise.all([\n      db.offlineReceipt.create"), "5:");
  add("таблица не едет на прод", SCHEMA_SYNC, (s) => s.replace('CREATE TABLE IF NOT EXISTS "OfflineReceipt"', 'CREATE TABLE IF NOT EXISTS "OfflineReceiptX"'), "5:");
  add("отправка очереди снята с разметки", LAYOUT, (s) => s.replace("<ProgressOutboxSync owner=", "<ProgressOutboxSyncGone owner="), "6:");
  add("копия с мёртвыми упражнениями", CLIENT, (s) => s.replace("  offlineExercisesOf(clone);\n", ""), "7:");
  add("живая панель без метки", LESSON_VIEW, (s) => s.replace("data-rf-exercises-live\n", "\n"), "7:");
  add("вход снова рисует форму вошедшему", LOGIN, (s) => s.replace("if (await getCurrentUserForChrome()) {", "if (false && (await getCurrentUserForChrome())) {"), "8:");

  add("сцена снова без перехвата", STAGE, (s) => s.replace("entry.load().catch(() => {", "entry.load().then((m) => {"), "9:");

  for (const c of cases) console.log(`  ${c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО"} — ${c.name}`);
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `check:progress-outbox --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль` : "check:progress-outbox --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const bad = violations(load());
  if (bad.length) {
    console.error(`check:progress-outbox — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log("check:progress-outbox — 9 правил, нарушений 0 (заход 7.236, офлайн-3б: очередь ответов без сети, находка 3)");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
