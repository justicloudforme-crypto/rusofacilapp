// ПРИЛОЖЕНИЕ ОБЯЗАНО САМО ПОДНЯТЬСЯ, КОГДА СЕТЬ ВЕРНУЛАСЬ
// (заход 7.223, долг 250, шаг 2).
//
// ЧТО ИЗМЕРЕНО. Офлайн-проба владельца 18.09.2026, POCO X6 Pro,
// Android 16, сборка 7202: Wi-Fi выключен → экран ошибки оболочки
// примерно через СЕКУНДУ; Wi-Fi включён обратно → приложение САМО НЕ
// ПОДНЯЛОСЬ, понадобилось 5–7 секунд и НЕСКОЛЬКО нажатий «Повторить».
// Сервер при этом был жив — это доказывает само нажатие. То есть
// единственным датчиком возврата сети у оболочки был человек.
//
// ПОЧЕМУ ЭТО СТОРОЖ, А НЕ ПРАВКА. Ровно та же причина, что у
// `check:load-watchdog`: `MainActivity.java` не исполняется ничем, что
// есть на машине сборки (долг 176). Ни лес, ни типы, ни один браузерный
// замер до этого кода не доходят. Увидеть отказ можно только с телефоном
// в руках — то есть один раз. Значит форму правки обязано держать
// правило.
//
// ЧТО ПРОВЕРЯЕТСЯ — восемь утверждений, и каждое закрывает свой способ
// вернуть дефект молча.
//
//  1. Слушается НАСТОЯЩИЙ сигнал сети, а не таймер:
//     `ConnectivityManager` + `registerDefaultNetworkCallback` +
//     `onAvailable`. Таймер на экране ошибки перезагружал бы сайт и при
//     выключенной сети — жёг бы батарею на заведомо невозможном запросе.
//  2. Разрешение ACCESS_NETWORK_STATE объявлено в НАШЕМ манифесте.
//     Без него `registerDefaultNetworkCallback` бросает
//     SecurityException. В пакете оно было и раньше — его приносил
//     RevenueCat, — но разрешение, от которого зависит НАШ код, обязано
//     стоять у нас: уйдёт чужая зависимость, и множество разрешений
//     пакета не изменится ни на строку, а код перестанет работать.
//  3. Повтор ОГРАНИЧЕН числом (`AUTO_RETRY_LIMIT`). Живая сеть и мёртвый
//     сервер не должны давать бесконечную перезагрузку.
//  4. Пауза РАСТЁТ (сдвиг на номер попытки) и упирается в потолок.
//  5. Счётчик попыток ОБНУЛЯЕТСЯ — иначе после первой же серии неудач
//     оболочка замолчала бы навсегда, до перезапуска.
//  6. Повтор заводится только НАД ЭКРАНОМ ОШИБКИ и перед самой загрузкой
//     ещё раз спрашивает, что на экране: человек мог успеть нажать
//     «Повторить» сам, и стирать нарисованную страницу нельзя.
//  7. Кнопка «Повторить» на экране ошибки ОСТАЁТСЯ. Автоматический
//     подъём её не заменяет: пять попыток кончаются, а человек остаётся.
//  8. Слушатель сети СНИМАЕТСЯ в `onDestroy`, и ступень лестницы тоже.
//
//   node scripts/check-network-retry.mjs
//   node scripts/check-network-retry.mjs --plant
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ACTIVITY = "android/app/src/main/java/com/rusofacilapp/app/MainActivity.java";
const MANIFEST = "android/app/src/main/AndroidManifest.xml";
const ERROR_SCREEN = "capacitor-shell/error.html";

const read = (path) => readFileSync(path, "utf8");

/** Комментарии не считаются живым кодом: закомментированная строка уже
 *  дважды проходила за настоящую (7.178, 7.181). */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Тело блока по подстроке-сигнатуре: скобки считаются, а не угадываются
 *  по отступу (отступ врал уже дважды — 7.193). */
function blockAfter(source, signature) {
  const at = source.indexOf(signature);
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

/** Судит ТЕКСТЫ, а не диск: подсадка подменяет их по одному. */
export function judge(sources) {
  const problems = [];
  const activity = stripComments(sources[ACTIVITY]);
  const manifest = sources[MANIFEST];
  const errorScreen = sources[ERROR_SCREEN];

  // 1. Настоящий сигнал сети.
  const arm = blockAfter(activity, "private void armNetworkRecovery()");
  if (!arm) {
    problems.push(`${ACTIVITY}: armNetworkRecovery() нет вовсе — возврат сети по-прежнему замечает только человек`);
  } else {
    if (!/registerDefaultNetworkCallback\(/.test(arm)) {
      problems.push(
        `${ACTIVITY}: armNetworkRecovery не подписывается на сеть системы ` +
          `(ConnectivityManager.registerDefaultNetworkCallback) — значит, слушает что-то другое`,
      );
    }
    if (!/public void onAvailable\(Network /.test(arm)) {
      problems.push(`${ACTIVITY}: у слушателя сети нет onAvailable — возврат сети не событие, а догадка`);
    }
    if (!/scheduleAutoRetry\(\)/.test(arm)) {
      problems.push(`${ACTIVITY}: сигнал сети ни к чему не приводит — повтор не заводится`);
    }
  }

  // 2. Разрешение — в НАШЕМ манифесте.
  if (!/<uses-permission\s+android:name="android\.permission\.ACCESS_NETWORK_STATE"\s*\/>/.test(manifest)) {
    problems.push(
      `${MANIFEST}: ACCESS_NETWORK_STATE не объявлено нами — registerDefaultNetworkCallback бросит ` +
        `SecurityException, как только разрешение уйдёт вместе с чужой зависимостью`,
    );
  }

  // 3–5. Предел, растущая пауза, обнуление счётчика.
  const limit = /AUTO_RETRY_LIMIT\s*=\s*(\d+)/.exec(activity);
  if (!limit) {
    problems.push(`${ACTIVITY}: у повтора нет предела — живая сеть и мёртвый сервер дали бы вечную перезагрузку`);
  } else if (Number(limit[1]) < 1 || Number(limit[1]) > 10) {
    problems.push(`${ACTIVITY}: предел повторов ${limit[1]} — это уже не предел, а разрешение`);
  }
  const schedule = blockAfter(activity, "private void scheduleAutoRetry()");
  if (!schedule) {
    problems.push(`${ACTIVITY}: scheduleAutoRetry() нет вовсе`);
  } else {
    if (!/autoRetryAttempt\s*>=\s*AUTO_RETRY_LIMIT/.test(schedule)) {
      problems.push(`${ACTIVITY}: scheduleAutoRetry не смотрит на предел — число попыток названо, но не действует`);
    }
    if (!/AUTO_RETRY_BASE_MS\s*<<\s*autoRetryAttempt/.test(schedule)) {
      problems.push(`${ACTIVITY}: пауза между повторами не растёт — это ровный опрос, а не отступление`);
    }
    if (!/Math\.min\([^)]*AUTO_RETRY_MAX_MS\)/.test(schedule)) {
      problems.push(`${ACTIVITY}: у растущей паузы нет потолка — восьмая ступень ушла бы за пределы разумного`);
    }
    if (!/removeCallbacks|cancelAutoRetry\(\)/.test(schedule)) {
      problems.push(`${ACTIVITY}: завод ступени не снимает предыдущую — ступени копились бы одна на другой`);
    }
  }
  if (!/autoRetryAttempt\s*=\s*0/.test(activity)) {
    problems.push(
      `${ACTIVITY}: счётчик попыток нигде не обнуляется — после первой серии неудач оболочка замолчала бы ` +
        `до перезапуска приложения`,
    );
  }

  // 6. Повтор — только над экраном ошибки, и спрашивает дважды.
  const note = blockAfter(activity, "private void noteScreenShown(String url)");
  if (!note) {
    problems.push(`${ACTIVITY}: оболочка не замечает, что на экране показан экран ошибки`);
  } else if (!/isErrorScreen\(url\)/.test(note)) {
    problems.push(`${ACTIVITY}: повтор заводится, не спросив, экран ли ошибки на экране`);
  }
  if (schedule && !/onErrorScreenNow\(\)/.test(schedule)) {
    problems.push(
      `${ACTIVITY}: перед самой перезагрузкой оболочка не спрашивает, что на экране, — человек мог нажать ` +
        `«Повторить» сам, и его страницу стёрли бы у него на глазах`,
    );
  }

  // 7. Кнопка «Повторить» осталась.
  if (!/__rfRetry|onclick|addEventListener\(\s*["']click["']/.test(errorScreen)) {
    problems.push(`${ERROR_SCREEN}: на экране ошибки не осталось нажимаемой кнопки — автоподъём её не заменяет`);
  }

  // 8. Снятие в onDestroy.
  const destroy = blockAfter(activity, "public void onDestroy()");
  if (!destroy) {
    problems.push(`${ACTIVITY}: onDestroy нет вовсе`);
  } else {
    if (!/unregisterNetworkCallback\(/.test(destroy)) {
      problems.push(`${ACTIVITY}: слушатель сети не снимается в onDestroy — он переживёт окно, которое его завело`);
    }
    if (!/cancelAutoRetry\(\)/.test(destroy)) {
      problems.push(`${ACTIVITY}: ступень повтора не снимается в onDestroy — она выстрелит в мёртвом окне`);
    }
  }

  return problems;
}

export async function main() {
  const files = [ACTIVITY, MANIFEST, ERROR_SCREEN];
  const sources = Object.fromEntries(files.map((f) => [f, read(f)]));

  if (process.argv.includes("--plant")) {
    let ok = judge(sources).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровые исходники (отрицательный контроль)`);

    const plants = [
      ["слушателя сети нет вовсе — возврат сети снова замечает только человек",
        { [ACTIVITY]: sources[ACTIVITY].replace(/private void armNetworkRecovery\(\)/, "private void неСлушаемСеть()") }],
      ["подписка на сеть заменена чем-то другим",
        { [ACTIVITY]: sources[ACTIVITY].replace(/registerDefaultNetworkCallback\(/g, "неПодписываемся(") }],
      ["onAvailable убран — сигнала возврата сети нет",
        { [ACTIVITY]: sources[ACTIVITY].replace(/public void onAvailable\(Network /g, "public void неСобытие(Network ") }],
      ["сигнал сети ни к чему не приводит",
        { [ACTIVITY]: sources[ACTIVITY].replace("                    if (onErrorScreenNow()) {\n                        scheduleAutoRetry();\n                    }", "") }],
      ["ACCESS_NETWORK_STATE снова взято транзитивно у чужой зависимости",
        { [MANIFEST]: sources[MANIFEST].replace('<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />', "") }],
      ["у повтора отобрали предел — вечная перезагрузка при мёртвом сервере",
        { [ACTIVITY]: sources[ACTIVITY].replace("AUTO_RETRY_LIMIT = 5", "AUTO_RETRY_LIMIT = 999") }],
      ["предел назван, но не действует",
        { [ACTIVITY]: sources[ACTIVITY].replace("if (getBridge() == null || autoRetryAttempt >= AUTO_RETRY_LIMIT) {", "if (getBridge() == null) {") }],
      ["пауза перестала расти — это ровный опрос",
        { [ACTIVITY]: sources[ACTIVITY].replace("Math.min(AUTO_RETRY_BASE_MS << autoRetryAttempt, AUTO_RETRY_MAX_MS)", "AUTO_RETRY_BASE_MS") }],
      ["у растущей паузы убрали потолок",
        { [ACTIVITY]: sources[ACTIVITY].replace("Math.min(AUTO_RETRY_BASE_MS << autoRetryAttempt, AUTO_RETRY_MAX_MS)", "AUTO_RETRY_BASE_MS << autoRetryAttempt") }],
      ["завод ступени не снимает предыдущую — ступени копятся",
        { [ACTIVITY]: sources[ACTIVITY].replace("        cancelAutoRetry();\n        pendingAutoRetry = new Runnable()", "        pendingAutoRetry = new Runnable()") }],
      ["счётчик попыток нигде не обнуляется",
        { [ACTIVITY]: sources[ACTIVITY].replace(/autoRetryAttempt = 0/g, "autoRetryAttempt += 0") }],
      ["повтор заводится, не спросив, экран ли ошибки",
        { [ACTIVITY]: sources[ACTIVITY].replace("        if (isErrorScreen(url) || offlineShellVisible) {\n            scheduleAutoRetry();\n            return;\n        }", "        scheduleAutoRetry();") }],
      ["перед перезагрузкой не спрашивают, что на экране — стёрли бы нажатие «Повторить»",
        { [ACTIVITY]: sources[ACTIVITY].replace("                if (!onErrorScreenNow() || getBridge() == null) {", "                if (getBridge() == null) {") }],
      ["с экрана ошибки убрали кнопку «Повторить»",
        { [ERROR_SCREEN]: sources[ERROR_SCREEN].replace(/onclick/g, "неНажатие").replace(/addEventListener\(\s*["']click["']/g, "неСлушаем(").replace(/__rfRetry/g, "__rfНеПовтор") }],
      ["слушатель сети не снимается в onDestroy",
        { [ACTIVITY]: sources[ACTIVITY].replace(/unregisterNetworkCallback\(/g, "неСнимаем(") }],
      ["ступень повтора не снимается в onDestroy",
        { [ACTIVITY]: sources[ACTIVITY].replace("        cancelAutoRetry();\n        if (connectivity != null", "        if (connectivity != null") }],
    ];

    let caught = 0;
    for (const [name, patch] of plants) {
      const key = Object.keys(patch)[0];
      if (patch[key] === sources[key]) {
        console.log(`  ПОДСАДКА НЕ СРАБОТАЛА (текст не изменился) — ${name}`);
        continue;
      }
      const found = judge({ ...sources, ...patch });
      const hit = found.length > 0;
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}${hit ? ` (${found[0]})` : ""}`);
    }
    ok &&= caught === plants.length;
    console.log(
      ok
        ? `check:network-retry --plant — ${caught} из ${plants.length} подсадок, 1 из 1 отрицательный контроль`
        : `check:network-retry --plant — FAILED (${caught} из ${plants.length})`,
    );
    return ok ? 0 : 1;
  }

  const problems = judge(sources);
  if (problems.length) {
    console.error("САМОСТОЯТЕЛЬНЫЙ ПОДЪЁМ ПОСЛЕ ВОЗВРАТА СЕТИ (долг 250, шаг 2):");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(
    "check:network-retry — оболочка слушает НАСТОЯЩИЙ сигнал сети (registerDefaultNetworkCallback/onAvailable), " +
      "ACCESS_NETWORK_STATE объявлено нами, повтор ограничен числом с растущей паузой и потолком, счётчик " +
      "обнуляется, перезагрузка идёт только над экраном ошибки и спрашивает экран дважды, кнопка «Повторить» " +
      "на месте, слушатель и ступень снимаются в onDestroy. Контроль — --plant.",
  );
  return 0;
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
