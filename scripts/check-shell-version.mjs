// САЙТ ОБЯЗАН ЗНАТЬ ВЕРСИЮ ОБОЛОЧКИ — И ОБЯЗАН РАБОТАТЬ СО СТАРОЙ
// (заход 7.223, долг 235).
//
// ЧЕГО НЕ ХВАТАЛО. Признаков оболочки было два, и оба бесверсионные по
// построению: токен `RFNativeShell` — литерал без чисел, кука
// `rf_native_shell` имела единственное значение "1". Сайт не мог отличить
// залитую в закрытый тест сборку 7202 (`versionCode 2`) от любой
// следующей. На `versionCode 4` это понадобится: касса Google должна
// включаться ТОЛЬКО в той оболочке, которая её умеет.
//
// ГЛАВНОЕ ЗДЕСЬ — НЕ «НОВОЕ РАБОТАЕТ», А «СТАРОЕ НЕ СЛОМАНО». 25
// тестировщиков обновятся не в один день, и обе сборки будут жить
// одновременно. Признак оболочки — это то, от чего зависит нативная
// витрина вместо веб-кассы; сломай его на обновлении, и человек внутри
// приложения увидит запрещённую магазином внешнюю оплату.
//
// ЧТО ПРОВЕРЯЕТСЯ — девять утверждений по пяти файлам.
//
//   node scripts/check-shell-version.mjs
//   node scripts/check-shell-version.mjs --plant
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const CAP_CONFIG = "capacitor.config.ts";
const GRADLE = "android/app/build.gradle";
const PBXPROJ = "ios/App/App.xcodeproj/project.pbxproj";
const TOKEN_LIB = "src/lib/native-shell-token.ts";
const PROXY = "src/proxy.ts";

const read = (path) => readFileSync(path, "utf8");

/** Сборка 7202 — единственная опубликованная оболочка без версии.
 *  Число записано здесь, а не выведено: вывести его неоткуда, это факт
 *  из Play Console (трек «Closed testing – Alpha», 21.09.2026). */
const LEGACY_SHELL_VERSION = 2;

export function judge(sources) {
  const problems = [];
  const config = sources[CAP_CONFIG];
  const gradle = sources[GRADLE];
  const pbxproj = sources[PBXPROJ];
  const lib = sources[TOKEN_LIB];
  const proxy = sources[PROXY];

  // 1. Версия названа в конфиге оболочки и приклеена к токену.
  const declared = /const NATIVE_SHELL_VERSION = (\d+);/.exec(config);
  if (!declared) {
    problems.push(`${CAP_CONFIG}: NATIVE_SHELL_VERSION не объявлена — оболочка снова безымянна для сайта`);
  }
  if (!/appendUserAgent:\s*`\$\{NATIVE_USER_AGENT_TOKEN\}\/\$\{NATIVE_SHELL_VERSION\}`/.test(config)) {
    problems.push(
      `${CAP_CONFIG}: версия не дописывается к User-Agent — число объявлено, но до сайта не доезжает`,
    );
  }

  // 2–3. Одна версия на три проекта: номер сборки обязан быть один.
  const versionCode = /\bversionCode\s+(\d+)/.exec(gradle);
  if (!versionCode) {
    problems.push(`${GRADLE}: versionCode не читается`);
  } else if (declared && declared[1] !== versionCode[1]) {
    problems.push(
      `${CAP_CONFIG}: NATIVE_SHELL_VERSION = ${declared[1]}, а versionCode в ${GRADLE} = ${versionCode[1]} — ` +
        `сайт узнал бы про оболочку не тот номер, под которым она лежит в Play`,
    );
  }
  const iosVersions = [...pbxproj.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((m) => m[1]);
  if (iosVersions.length === 0) {
    problems.push(`${PBXPROJ}: CURRENT_PROJECT_VERSION не читается`);
  } else if (declared) {
    for (const v of new Set(iosVersions)) {
      if (v !== declared[1]) {
        problems.push(
          `${PBXPROJ}: CURRENT_PROJECT_VERSION = ${v}, а NATIVE_SHELL_VERSION = ${declared[1]} — ` +
            `у одной версии оболочки два разных номера на двух платформах`,
        );
      }
    }
  }

  // 4. Функция чтения на сайте — одна, и она называется.
  if (!/export function nativeShellVersion\(/.test(lib)) {
    problems.push(`${TOKEN_LIB}: функции чтения версии нет — каждый читатель заведёт свою догадку`);
  }
  if (!/export const NATIVE_SHELL_VERSION_COOKIE = "rf_shell_version";/.test(lib)) {
    problems.push(`${TOKEN_LIB}: куки версии нет — запрос service worker'а останется без числа`);
  }

  // 5. СОВМЕСТИМОСТЬ СО СТАРОЙ ОБОЛОЧКОЙ, названная числом.
  const legacy = /export const LEGACY_NATIVE_SHELL_VERSION = (\d+);/.exec(lib);
  if (!legacy) {
    problems.push(
      `${TOKEN_LIB}: у бесверсионной оболочки нет номера — 7202 читалась бы как «неизвестно сколько»`,
    );
  } else if (Number(legacy[1]) !== LEGACY_SHELL_VERSION) {
    problems.push(
      `${TOKEN_LIB}: LEGACY_NATIVE_SHELL_VERSION = ${legacy[1]}, а в закрытом тесте Google Play лежит ` +
        `versionCode ${LEGACY_SHELL_VERSION} (сборка 7202)`,
    );
  }
  const min = /export const MIN_SUPPORTED_NATIVE_SHELL_VERSION = (\d+);/.exec(lib);
  if (!min) {
    problems.push(`${TOKEN_LIB}: минимальная поддерживаемая версия не названа`);
  } else if (legacy && Number(min[1]) > Number(legacy[1])) {
    problems.push(
      `${TOKEN_LIB}: минимум поддержки ${min[1]} выше версии 7202 (${legacy[1]}) — в день выката часть ` +
        `тестировщиков получила бы блокирующий экран вместо приложения`,
    );
  }

  // 6. Признак оболочки остался ПОДСТРОКОЙ, а не равенством: иначе
  //    `RFNativeShell/3` перестал бы быть оболочкой вовсе.
  if (!/return typeof userAgent === "string" && userAgent\.includes\(NATIVE_USER_AGENT_TOKEN\);/.test(lib)) {
    problems.push(
      `${TOKEN_LIB}: признак оболочки опознаётся не подстрокой — токен с версией перестал бы считаться ` +
        `оболочкой, и внутри приложения появилась бы веб-касса`,
    );
  }

  // 7. Версию НЕ засунули в куку признака: у неё одно значение и строгое
  //    равенство, и «3» там сделало бы старую и новую оболочку разными
  //    сущностями ровно на обновлении.
  if (!/export const NATIVE_SHELL_COOKIE_VALUE = "1";/.test(lib)) {
    problems.push(
      `${TOKEN_LIB}: значение куки признака перестало быть "1" — оболочка 7202 перестала бы узнаваться`,
    );
  }

  // 8. Кука версии ставится проксей, и только из токена.
  if (!/NATIVE_SHELL_VERSION_COOKIE/.test(proxy)) {
    problems.push(`${PROXY}: кука версии не ставится — запрос service worker'а останется без числа навсегда`);
  }
  if (!/userAgentIsNativeShell\(request\.headers\.get\("user-agent"\)\)\s*\n?\s*\?\s*nativeShellVersion/.test(proxy)) {
    problems.push(
      `${PROXY}: версия пишется не из токена — браузер получил бы куку версии, и ответ ` +
        `замороженным адресам перестал бы быть побайтово прежним`,
    );
  }

  return problems;
}

export async function main() {
  const files = [CAP_CONFIG, GRADLE, PBXPROJ, TOKEN_LIB, PROXY];
  const sources = Object.fromEntries(files.map((f) => [f, read(f)]));

  if (process.argv.includes("--plant")) {
    let ok = judge(sources).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровые исходники (отрицательный контроль)`);

    const plants = [
      ["версия оболочки не объявлена вовсе",
        { [CAP_CONFIG]: sources[CAP_CONFIG].replace("const NATIVE_SHELL_VERSION = 3;", "") }],
      ["версия объявлена, но к User-Agent не приклеена",
        { [CAP_CONFIG]: sources[CAP_CONFIG].replace("appendUserAgent: `${NATIVE_USER_AGENT_TOKEN}/${NATIVE_SHELL_VERSION}`", "appendUserAgent: NATIVE_USER_AGENT_TOKEN") }],
      ["версия оболочки разошлась с versionCode",
        { [CAP_CONFIG]: sources[CAP_CONFIG].replace("const NATIVE_SHELL_VERSION = 3;", "const NATIVE_SHELL_VERSION = 4;") }],
      ["версия оболочки разошлась с номером сборки iOS",
        { [GRADLE]: sources[GRADLE].replace(/versionCode 3/, "versionCode 4"), [CAP_CONFIG]: sources[CAP_CONFIG].replace("const NATIVE_SHELL_VERSION = 3;", "const NATIVE_SHELL_VERSION = 4;") }],
      ["функции чтения версии нет — каждый читатель заведёт свою",
        { [TOKEN_LIB]: sources[TOKEN_LIB].replace("export function nativeShellVersion(", "function nativeShellVersion(") }],
      ["куки версии нет — запрос service worker'а без числа",
        { [TOKEN_LIB]: sources[TOKEN_LIB].replace('export const NATIVE_SHELL_VERSION_COOKIE = "rf_shell_version";', "") }],
      ["у бесверсионной оболочки отобрали номер",
        { [TOKEN_LIB]: sources[TOKEN_LIB].replace("export const LEGACY_NATIVE_SHELL_VERSION = 2;", "") }],
      ["бесверсионной оболочке назначили не тот номер, что лежит в Play",
        { [TOKEN_LIB]: sources[TOKEN_LIB].replace("export const LEGACY_NATIVE_SHELL_VERSION = 2;", "export const LEGACY_NATIVE_SHELL_VERSION = 1;") }],
      ["минимум поддержки поднят вперёд выката — блокирующий экран половине теста",
        { [TOKEN_LIB]: sources[TOKEN_LIB].replace("export const MIN_SUPPORTED_NATIVE_SHELL_VERSION = 2;", "export const MIN_SUPPORTED_NATIVE_SHELL_VERSION = 3;") }],
      ["признак оболочки стал равенством — токен с версией перестал быть оболочкой",
        { [TOKEN_LIB]: sources[TOKEN_LIB].replace('return typeof userAgent === "string" && userAgent.includes(NATIVE_USER_AGENT_TOKEN);', 'return userAgent === NATIVE_USER_AGENT_TOKEN;') }],
      ["версию засунули в куку признака — старая и новая оболочка стали разными сущностями",
        { [TOKEN_LIB]: sources[TOKEN_LIB].replace('export const NATIVE_SHELL_COOKIE_VALUE = "1";', 'export const NATIVE_SHELL_COOKIE_VALUE = "3";') }],
      ["кука версии не ставится вовсе",
        { [PROXY]: sources[PROXY].replace(/NATIVE_SHELL_VERSION_COOKIE/g, "НЕТ_ТАКОЙ_КУКИ") }],
      ["версия пишется не из токена — браузер получил бы куку версии",
        { [PROXY]: sources[PROXY].replace('userAgentIsNativeShell(request.headers.get("user-agent"))\n    ? nativeShellVersion', "true\n    ? nativeShellVersion") }],
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
        ? `check:shell-version --plant — ${caught} из ${plants.length} подсадок, 1 из 1 отрицательный контроль`
        : `check:shell-version --plant — FAILED (${caught} из ${plants.length})`,
    );
    return ok ? 0 : 1;
  }

  const problems = judge(sources);
  if (problems.length) {
    console.error("ВЕРСИЯ ОБОЛОЧКИ (долг 235):");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  const n = /const NATIVE_SHELL_VERSION = (\d+);/.exec(sources[CAP_CONFIG])[1];
  console.log(
    `check:shell-version — версия оболочки ${n} одна на три проекта (capacitor.config.ts, build.gradle, ` +
      `project.pbxproj), едет и токеном, и кукой rf_shell_version; бесверсионная оболочка 7202 читается как ` +
      `${LEGACY_SHELL_VERSION}, минимум поддержки её не выше, признак оболочки остался подстрокой, а кука ` +
      `признака — прежней "1". Контроль — --plant.`,
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
