// СТОРОЖ ЗАГРУЗКИ ОБЯЗАН СЧИТАТЬ СРОК ОТ НАЧАЛА ТЕКУЩЕЙ НАВИГАЦИИ
// (заход 7.200, долг 217).
//
// ЧТО ЭТО ЗА ПРАВИЛО И ЧЕГО ОНО СТОИТ. В `MainActivity.java` живёт таймер:
// через `LOAD_TIMEOUT_MS` он спрашивает webview, дошла ли загрузка до конца
// и нарисовалось ли хоть что-то, и если нет — грузит локальный экран
// ошибки. Он заведён ради случая, которого Capacitor не ловит вовсе:
// сервер не отказал, а МОЛЧИТ (инцидент №1 — HTTP 200, пустой экран).
//
// До 16.09.2026 этот таймер заводился РОВНО ОДИН РАЗ, в `onCreate`, и
// снимался РОВНО ОДИН РАЗ, в `onDestroy`. Измерено на том файле числом:
// `postDelayed(pendingCheck` — 1 вхождение (строка 611),
// `removeCallbacks(pendingCheck` — 1 вхождение (строка 677, внутри
// `onDestroy`), слушателей перехода в теле `armLoadWatchdog()` — 0.
// Следствие видел владелец на POCO X6 Pro: сеть вернулась, «Повторить»
// нажато на 9-й секунде, главная нарисовалась на 12-й — и на 12 000 мс от
// ЗАПУСКА таймер проснулся и закрыл её свежим экраном ошибки. Со второго
// раза всё работало: стрелять было уже нечем.
//
// ПОЧЕМУ ЭТО СТОРОЖ, А НЕ ПРАВКА. Дефект не роняет ни один прогон: Java
// здесь не исполняется ничем, что есть на машине сборки (долг 176), лес и
// типы её не видят, ни один браузерный замер до неё не доходит. Увидеть
// его можно только с телефоном в руках и секундомером — то есть один раз.
// Значит форму правки обязано держать правило.
//
// ЧТО ПРОВЕРЯЕТСЯ — пять утверждений, и каждое закрывает свой способ
// вернуть дефект молча.
//
//  1. Таймер ЗАВОДИТСЯ: `postDelayed(pendingCheck, LOAD_TIMEOUT_MS)` жив.
//  2. Завод и снятие вынесены в ОТДЕЛЬНЫЕ методы, и завод снимает
//     предыдущий таймер перед тем, как завести новый. Без этого каждая
//     навигация оставляла бы за собой ещё один живой таймер.
//  3. В теле `armLoadWatchdog()` есть слушатель перехода, и его
//     `onPageStarted` ПЕРЕВЗВОДИТ срок. Это и есть «считать от начала
//     текущей навигации».
//  4. В том же слушателе есть хотя бы одно событие «страница нарисована»
//     (`onPageCommitVisible` или `onPageLoaded`), и оно СНИМАЕТ срок.
//     Оба — лучше, и оба здесь есть, но правило требует хотя бы одного:
//     на старом WebView `onPageCommitVisible` приходит не всегда.
//  5. Снятие в `onDestroy` осталось. Оно про другое — таймер не должен
//     сработать в мёртвом окне, — и заменять его снятием по навигации
//     нельзя.
//
// ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ — НАСТОЯЩИЙ ФАЙЛ ДО ПРАВКИ, а не выдуманное
// поведение: копия лежит рядом (`scripts/fixtures/before-7200/`), и когда
// история под рукой, сторож ДОПОЛНИТЕЛЬНО сличает копию с коммитом
// {@link BEFORE_FIX} побайтово. Точка отсчёта в репозитории, а не в
// `origin/main`: контроль, отсчитывающий от движущейся точки,
// самоуничтожается при первом же успехе (это уже ловили в 7.198).
//
//   node scripts/check-load-watchdog.mjs
//   node scripts/check-load-watchdog.mjs --plant
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ACTIVITY = "android/app/src/main/java/com/rusofacilapp/app/MainActivity.java";

/** Состояние `main` на 16.09.2026 — слияние PR #332, последнее до этого
 *  захода. Ровно тот код, на котором владелец снял жалобу. */
const BEFORE_FIX = "bc77b2a";
const FIXTURE = "scripts/fixtures/before-7200/main-activity.before-7200.txt";

const read = (path) => readFileSync(path, "utf8");

/** Комментарии не считаются живым кодом: закомментированная строка уже
 *  дважды проходила за настоящую (7.178, 7.181). */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Тело блока по подстроке-сигнатуре: скобки считаются, а не угадываются
 *  по отступу (отступ врал уже дважды — 7.193). */
function blockAfter(source, signature, from = 0) {
  const at = source.indexOf(signature, from);
  if (at === -1) return null;
  const open = source.indexOf("{", at);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

/** Тело обработчика webview внутри слушателя. Имя метода одно и то же в
 *  трёх слушателях этого файла, поэтому ищем ВНУТРИ переданного куска. */
function handler(body, name) {
  return blockAfter(body, `public void ${name}(`);
}

export function judge(source) {
  const bad = [];
  const live = stripComments(source);

  // --- 1. таймер вообще заводится -----------------------------------------
  const posts = (live.match(/postDelayed\(pendingCheck/g) ?? []).length;
  if (posts === 0) {
    bad.push(
      `${ACTIVITY}: нет живого \`postDelayed(pendingCheck, …)\` — сторож загрузки не заводится вовсе, ` +
        `и «сервер ответил 200 и молчит» снова не ловит никто (класс инцидента №1).`,
    );
  }

  // --- 2. завод и снятие — отдельные методы, завод снимает предыдущий -----
  const schedule = blockAfter(live, "private void scheduleLoadWatchdog()");
  const cancel = blockAfter(live, "private void cancelLoadWatchdog()");
  if (!schedule) {
    bad.push(
      `${ACTIVITY}: нет метода \`scheduleLoadWatchdog()\`. Завод срока обязан быть отдельным вызовом — ` +
        `его зовут из двух мест (создание окна и начало каждой навигации), и записанный по месту ` +
        `он молча разойдётся между ними.`,
    );
  } else {
    if (!/removeCallbacks\(pendingCheck\)/.test(schedule)) {
      bad.push(
        `${ACTIVITY}: \`scheduleLoadWatchdog()\` заводит таймер, не сняв предыдущий. Каждая навигация ` +
          `оставляла бы за собой ещё один живой таймер, и через десять страниц их было бы десять — ` +
          `первый же из них выстрелит в исправно открытую страницу.`,
      );
    }
    if (!/postDelayed\(pendingCheck,\s*LOAD_TIMEOUT_MS\)/.test(schedule)) {
      bad.push(
        `${ACTIVITY}: \`scheduleLoadWatchdog()\` не заводит таймер на \`LOAD_TIMEOUT_MS\` — ` +
          `метод есть, а срока у него нет.`,
      );
    }
  }
  if (!cancel) {
    bad.push(`${ACTIVITY}: нет метода \`cancelLoadWatchdog()\` — снимать срок по готовой странице нечем.`);
  } else if (!/removeCallbacks\(pendingCheck\)/.test(cancel)) {
    bad.push(
      `${ACTIVITY}: \`cancelLoadWatchdog()\` не зовёт \`removeCallbacks(pendingCheck)\` — ` +
        `метод называется снятием, а не снимает ничего.`,
    );
  }

  // --- 3 и 4. слушатель перехода внутри самого armLoadWatchdog ------------
  const arm = blockAfter(live, "private void armLoadWatchdog()");
  if (!arm) {
    bad.push(`${ACTIVITY}: не читается тело \`armLoadWatchdog()\`.`);
    return bad;
  }
  if (!/addWebViewListener/.test(arm)) {
    bad.push(
      `${ACTIVITY}: \`armLoadWatchdog()\` не слушает переходы вовсе (\`addWebViewListener\` в его теле нет). ` +
        `Тогда срок считается от ЗАПУСКА ПРОЦЕССА, и таймер, заведённый при старте, просыпается ` +
        `поверх страницы, открытой кнопкой «Повторить» (долг 217).`,
    );
    return bad;
  }
  const listener = blockAfter(arm, "addWebViewListener(new WebViewListener()");
  const scope = listener ?? arm;

  const started = handler(scope, "onPageStarted");
  if (!started) {
    bad.push(
      `${ACTIVITY}: у слушателя сторожа загрузки нет \`onPageStarted\` — срок не перевзводится ` +
        `в начале навигации, значит он по-прежнему отсчитывается от запуска приложения (долг 217).`,
    );
  } else if (!/scheduleLoadWatchdog\(\)/.test(started)) {
    bad.push(
      `${ACTIVITY}: \`onPageStarted\` есть, а срок в нём не перевзводится ` +
        `(\`scheduleLoadWatchdog()\` не зовётся). Обработчик без действия — это тот же дефект ` +
        `с видимостью починки.`,
    );
  }

  const paintedNames = ["onPageCommitVisible", "onPageLoaded"];
  const cancels = paintedNames.filter((name) => {
    const b = handler(scope, name);
    return b !== null && /cancelLoadWatchdog\(\)/.test(b);
  });
  if (cancels.length === 0) {
    bad.push(
      `${ACTIVITY}: срок не снимается НИ ОДНИМ событием «страница нарисована» ` +
        `(${paintedNames.join(" / ")}). Ровно это и убивало главную через один кадр после нажатия ` +
        `«Повторить» (долг 217).`,
    );
  }

  // --- 5. снятие при закрытии окна осталось -------------------------------
  const destroy = blockAfter(live, "public void onDestroy()");
  if (!destroy || !/removeCallbacks\(pendingCheck\)/.test(destroy)) {
    bad.push(
      `${ACTIVITY}: в \`onDestroy\` больше не снимается таймер. Это правило про ДРУГОЕ — ` +
        `сработавший в мёртвом окне таймер, — и заменять его снятием по навигации нельзя.`,
    );
  }

  return bad;
}

function fileBeforeFix() {
  let fixture;
  try {
    fixture = readFileSync(FIXTURE, "utf8");
  } catch {
    return null;
  }
  try {
    const fromGit = execFileSync("git", ["show", `${BEFORE_FIX}:${ACTIVITY}`], { encoding: "utf8" });
    if (fromGit !== fixture) {
      console.log(`  РАСХОЖДЕНИЕ — ${FIXTURE} не совпадает с ${BEFORE_FIX}:${ACTIVITY}`);
      return null;
    }
  } catch {
    // Истории нет (в CI забирается один коммит) — работаем по копии.
  }
  return fixture;
}

function report() {
  const source = read(ACTIVITY);
  const bad = judge(source);
  if (bad.length) {
    console.error("check:load-watchdog — ОТКАЗ\n");
    for (const b of bad) console.error(`  ${b}\n`);
    return false;
  }
  const live = stripComments(source);
  const posts = (live.match(/postDelayed\(pendingCheck/g) ?? []).length;
  const removes = (live.match(/removeCallbacks\(pendingCheck\)/g) ?? []).length;
  console.log("check:load-watchdog — срок считается от начала текущей навигации.");
  console.log(`  завод таймера: ${posts} место, снятие: ${removes} места (навигация, готовая страница, закрытие окна)`);
  console.log("  onPageStarted перевзводит срок; onPageCommitVisible и onPageLoaded его снимают");
  console.log("  «сервер молчит» по-прежнему ловится: ни одно из снимающих событий там не приходит");
  return true;
}

function plantControls() {
  const source = read(ACTIVITY);
  let ok = true;

  const healthy = judge(source).length === 0;
  console.log(`  ${healthy ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровый файл (отрицательный контроль)`);
  ok &&= healthy;

  // Контроль первый и главный: НАСТОЯЩИЙ файл до правки.
  const before = fileBeforeFix();
  if (before === null) {
    console.log(`  ПРОПУЩЕНО — копии ${FIXTURE} нет или она разошлась с ${BEFORE_FIX}`);
    ok = false;
  } else {
    const found = judge(before);
    const hit = found.length > 0;
    ok &&= hit;
    console.log(
      `  ${hit ? "поймано" : "ПРОПУЩЕНО"} — НАСТОЯЩИЙ файл ${BEFORE_FIX} (жалоба владельца снята на нём): ` +
        `${found.length} нарушени${found.length === 1 ? "е" : "й"}`,
    );
    for (const f of found) console.log(`      · ${f.split("\n")[0].slice(0, 120)}…`);
  }

  // ПОДСАДКИ ЯКОРЯТСЯ НА СТРОКИ, УНИКАЛЬНЫЕ ДЛЯ ЭТОГО СЛУШАТЕЛЯ. Первая
  // редакция подсаживала по строке `getBridge().addWebViewListener(new
  // WebViewListener() {` — и правила слушатель ЗАСТАВКИ, потому что он в
  // файле первый: слушателей четыре, и строка у всех дословно одна. Тот же
  // класс, что `swapAll` в `check-native-shell` (7.198).
  const LISTENER_HEAD =
    "        scheduleLoadWatchdog();\n" +
    "        if (getBridge() == null) {\n" +
    "            return;\n" +
    "        }\n" +
    "        getBridge().addWebViewListener(new WebViewListener() {";
  const STARTED_HANDLER =
    "            public void onPageStarted(WebView view) {\n" +
    "                // Началась НОВАЯ навигация — в том числе та, которую завела\n" +
    "                // кнопка «Повторить» на экране ошибки. Срок обязан идти от\n" +
    "                // неё, а не от запуска приложения.\n" +
    "                scheduleLoadWatchdog();\n" +
    "            }";

  const plants = [
    [
      "слушатель перехода снят целиком — срок снова от запуска процесса",
      source.replace(LISTENER_HEAD, "        scheduleLoadWatchdog();\n        if (false) new Object() {"),
      "не слушает переходы вовсе",
    ],
    [
      "onPageStarted остался, но срок в нём не перевзводится",
      source.replace(STARTED_HANDLER, "            public void onPageStarted(WebView view) {\n            }"),
      "срок в нём не перевзводится",
    ],
    [
      "оба снимающих события перестали снимать срок",
      source.replaceAll("                cancelLoadWatchdog();", "                ;"),
      "не снимается НИ ОДНИМ событием",
    ],
    [
      "завод перестал снимать предыдущий таймер — таймеры копятся по одному на страницу",
      source.replace(
        "        loadWatchdog.removeCallbacks(pendingCheck);\n        loadWatchdog.postDelayed(pendingCheck, LOAD_TIMEOUT_MS);",
        "        loadWatchdog.postDelayed(pendingCheck, LOAD_TIMEOUT_MS);",
      ),
      "не сняв предыдущий",
    ],
    [
      "снятие при закрытии окна убрано — таймер выстрелит в мёртвом окне",
      source.replace(
        "        if (pendingCheck != null) {\n            loadWatchdog.removeCallbacks(pendingCheck);\n            pendingCheck = null;\n        }",
        "",
      ),
      "в `onDestroy` больше не снимается",
    ],
    [
      "таймер не заводится вовсе",
      source.replace("        loadWatchdog.postDelayed(pendingCheck, LOAD_TIMEOUT_MS);", ""),
      "сторож загрузки не заводится вовсе",
    ],
  ];

  let caughtCount = 0;
  for (const [name, planted, needle] of plants) {
    if (planted === source) {
      console.log(`  ПОДСАДКА НЕ ПРИМЕНИЛАСЬ — ${name}`);
      ok = false;
      continue;
    }
    const found = judge(planted);
    const caught = found.some((f) => f.includes(needle));
    if (caught) caughtCount++;
    else ok = false;
    console.log(`  ${caught ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
  }

  console.log(
    ok
      ? `check:load-watchdog --plant — ${caughtCount} из ${plants.length} подсадок поймано, ` +
          `плюс настоящий файл до правки, плюс отрицательный контроль`
      : "check:load-watchdog --plant — FAILED",
  );
  return ok;
}

const IS_ENTRY_POINT =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (IS_ENTRY_POINT) {
  const ok = process.argv.includes("--plant") ? plantControls() : report();
  process.exitCode = ok ? 0 : 1;
}
