// EDGE-TO-EDGE ПОД ANDROID 15+ — РЕКОМЕНДОВАННЫЙ ПУТЬ И НИ ОДНОГО
// УСТАРЕВШЕГО ВЫЗОВА В НАШЕМ КОДЕ (заход 7.223).
//
// ЧТО НАПИСАЛА PLAY CONSOLE по сборке 7202: «edge-to-edge может
// отображаться неверно на Android 15+ при targetSDK 35» и «используются
// устаревшие API edge-to-edge».
//
// ОТКУДА ОНИ, ИЗМЕРЕНО ПО СОБРАННОМУ ПАКЕТУ 7202 (22.09.2026, dexdump
// всех четырёх classes*.dex, вызовы сгруппированы по классу-владельцу):
//
//   androidx/core/view/WindowCompat                         7
//   com/capacitorjs/plugins/splashscreen/SplashScreen        5
//   androidx/activity/EdgeToEdgeApi29 / Api26 / Api23 / Api21 11
//   androidx/core/splashscreen/SplashScreen$Impl31           3
//   com/capacitorjs/plugins/statusbar/StatusBar              2
//   androidx/core/view/WindowInsetsControllerCompat$Impl30/Impl20 4
//   прочее androidx (compose, drawerlayout, coordinatorlayout) и cordova
//   com/rusofacilapp/app/MainActivity                        0   ← НАШИХ НОЛЬ
//
// То есть ни одного устаревшего вызова в нашем коде нет и не было:
// все они приезжают из библиотек. Убрать их обновлением нельзя —
// 22.09.2026 `npm view` отвечает, что `@capacitor/status-bar` 8.0.3 и
// `@capacitor/splash-screen` 8.0.2 УЖЕ последние стабильные, а версии
// без этих вызовов есть только в ветке 9.0.0-alpha. Ставить альфу в
// пакет, который идёт тестировщикам, нельзя. Записано долгом.
//
// ЧТО ТОГДА СТЕРЕЖЁТ ЭТОТ ФАЙЛ — ровно ту половину, которая наша:
//
//  1. В нашем Java-коде НЕТ ни одного устаревшего вызова edge-to-edge.
//     Сегодня их ноль, и правило держит этот ноль: добавить их — дело
//     одной строки, а увидеть это можно только в дампе пакета.
//  2. Мы не пытаемся ОТКАЗАТЬСЯ от edge-to-edge:
//     `windowOptOutEdgeToEdgeEnforcement` на targetSdk 36 система
//     игнорирует, и строка в теме была бы ложным успокоением.
//  3. Рекомендованный путь на месте: полосы читаются
//     `ViewCompat.setOnApplyWindowInsetsListener` +
//     `WindowInsetsCompat.Type.systemBars() | displayCutout()`, и insets
//     НЕ поглощаются (их читает ещё и сам webview — иначе `env()`
//     остался бы без выреза).
//  4. targetSdk и compileSdk — 35 и выше: ниже 35 разговор про
//     edge-to-edge не про нас вовсе.
//
//   node scripts/check-edge-to-edge.mjs
//   node scripts/check-edge-to-edge.mjs --plant
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ACTIVITY = "android/app/src/main/java/com/rusofacilapp/app/MainActivity.java";
const STYLES = "android/app/src/main/res/values/styles.xml";
const VARIABLES = "android/variables.gradle";

const read = (path) => readFileSync(path, "utf8");

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Устаревшие с Android 15 способы красить и раскладывать системные
 *  полосы. Каждый — ровно то, что Play Console зовёт «deprecated
 *  edge-to-edge APIs». */
const DEPRECATED = [
  "setStatusBarColor",
  "setNavigationBarColor",
  "setNavigationBarDividerColor",
  "setStatusBarContrastEnforced",
  "setNavigationBarContrastEnforced",
  "setSystemUiVisibility",
  "SYSTEM_UI_FLAG_",
];

export function judge(sources) {
  const problems = [];
  const activity = stripComments(sources[ACTIVITY]);
  const styles = sources[STYLES];
  const variables = sources[VARIABLES];

  // 1. Ноль устаревших вызовов у нас.
  for (const api of DEPRECATED) {
    if (activity.includes(api)) {
      problems.push(
        `${ACTIVITY}: устаревший edge-to-edge вызов «${api}» — на Android 15+ он не делает того, ` +
          `что написано, и Play Console пишет об этом на каждом релизе`,
      );
    }
  }

  // 2. Отказа от edge-to-edge не бывает.
  if (/windowOptOutEdgeToEdgeEnforcement/.test(styles)) {
    problems.push(
      `${STYLES}: попытка отказаться от edge-to-edge — на targetSdk 36 система эту строку игнорирует, ` +
        `и она была бы ложным успокоением вместо правки`,
    );
  }

  // 3. Рекомендованный путь.
  if (!/ViewCompat\.setOnApplyWindowInsetsListener\(/.test(activity)) {
    problems.push(
      `${ACTIVITY}: системные полосы читаются не рекомендованным способом — значит, каким-то другим`,
    );
  }
  if (!/WindowInsetsCompat\.Type\.systemBars\(\)\s*\|\s*WindowInsetsCompat\.Type\.displayCutout\(\)/.test(activity)) {
    problems.push(
      `${ACTIVITY}: в полосы не включён вырез экрана (displayCutout) — на телефоне с вырезом содержимое ` +
        `уедет под него`,
    );
  }
  if (!/return windowInsets;/.test(activity)) {
    problems.push(
      `${ACTIVITY}: insets поглощаются — тогда их не увидит сам webview, и env(safe-area-inset-*) ` +
        `останется без выреза`,
    );
  }

  // 4. Разговор вообще про нас.
  for (const [name, re] of [
    ["targetSdkVersion", /targetSdkVersion\s*=\s*(\d+)/],
    ["compileSdkVersion", /compileSdkVersion\s*=\s*(\d+)/],
  ]) {
    const m = re.exec(variables);
    if (!m) {
      problems.push(`${VARIABLES}: ${name} не читается`);
    } else if (Number(m[1]) < 35) {
      problems.push(
        `${VARIABLES}: ${name} = ${m[1]} — ниже 35 система не включает edge-to-edge принудительно, ` +
          `и весь этот сторож судил бы не про то, что собрано`,
      );
    }
  }

  return problems;
}

export async function main() {
  const files = [ACTIVITY, STYLES, VARIABLES];
  const sources = Object.fromEntries(files.map((f) => [f, read(f)]));

  if (process.argv.includes("--plant")) {
    let ok = judge(sources).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровые исходники (отрицательный контроль)`);

    const plants = [
      ["в наш код вернулась покраска полосы статуса",
        { [ACTIVITY]: sources[ACTIVITY].replace("    @Override\n    public void onPause()", "    private void красимПолосу() { getWindow().setStatusBarColor(0xFF2D5F8A); }\n\n    @Override\n    public void onPause()") }],
      ["в наш код вернулись флаги SYSTEM_UI_FLAG",
        { [ACTIVITY]: sources[ACTIVITY].replace("    @Override\n    public void onPause()", "    private void флаги() { getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE); }\n\n    @Override\n    public void onPause()") }],
      ["в теме появился отказ от edge-to-edge, который система игнорирует",
        { [STYLES]: sources[STYLES].replace("</resources>", '    <style name="X"><item name="android:windowOptOutEdgeToEdgeEnforcement">true</item></style>\n</resources>') }],
      ["полосы читаются не рекомендованным способом",
        { [ACTIVITY]: sources[ACTIVITY].replace(/ViewCompat\.setOnApplyWindowInsetsListener\(/g, "какТоИначе(") }],
      ["из полос выпал вырез экрана",
        { [ACTIVITY]: sources[ACTIVITY].replace("WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()", "WindowInsetsCompat.Type.systemBars()") }],
      ["insets поглощаются — webview остался без выреза",
        { [ACTIVITY]: sources[ACTIVITY].replace("            return windowInsets;", "            return WindowInsetsCompat.CONSUMED;") }],
      ["targetSdk опустили ниже 35 — сторож судил бы не про то, что собрано",
        { [VARIABLES]: sources[VARIABLES].replace("targetSdkVersion = 36", "targetSdkVersion = 34") }],
      ["compileSdk опустили ниже 35",
        { [VARIABLES]: sources[VARIABLES].replace("compileSdkVersion = 36", "compileSdkVersion = 34") }],
    ];

    let caught = 0;
    for (const [name, patch] of plants) {
      const changed = Object.keys(patch).some((k) => patch[k] !== sources[k]);
      if (!changed) {
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
        ? `check:edge-to-edge --plant — ${caught} из ${plants.length} подсадок, 1 из 1 отрицательный контроль`
        : `check:edge-to-edge --plant — FAILED (${caught} из ${plants.length})`,
    );
    return ok ? 0 : 1;
  }

  const problems = judge(sources);
  if (problems.length) {
    console.error("EDGE-TO-EDGE ПОД ANDROID 15+:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(
    `check:edge-to-edge — устаревших вызовов edge-to-edge в нашем коде 0 из ${DEPRECATED.length} видов; ` +
      `отказа от edge-to-edge нет (на targetSdk 36 он игнорируется); полосы читаются ` +
      `ViewCompat.setOnApplyWindowInsetsListener с systemBars|displayCutout и не поглощаются; ` +
      `targetSdk и compileSdk ≥ 35. Устаревшие вызовы в ПАКЕТЕ приходят из библиотек — долг, а не эта ` +
      `проверка. Контроль — --plant.`,
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
