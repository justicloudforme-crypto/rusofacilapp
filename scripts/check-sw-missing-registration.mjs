// РЕГИСТРАЦИИ НЕТ — ЭТО НЕ ДЕФЕКТ, А ЗАГЛУШКА (заход 7.262, Sentry JAVASCRIPT-NEXTJS-1B).
//
// `Serwist.register()` читает `.waiting` у ответа `navigator.serviceWorker.register()`;
// заглушка (Playwright `serviceWorkers: 'block'`, блокировщик) отдаёт
// `undefined`, и TypeError уходил в Sentry как «неожиданный отказ». Правило
// `isMissingRegistrationError` в src/lib/sw-registration-failure.ts относит
// его к ожидаемому классу (консоль, не Sentry).
//
// Сторож исполняет САМО правило (типы снимаются `stripTypeScriptTypes`, файл
// импортируется из памяти) на текстах трёх движков и на контрольных
// ошибках, и проверяет проводку: ожидаемый отказ в SerwistRegister.tsx
// пишется только в консоль.
//
//   node scripts/check-sw-missing-registration.mjs          # гейт
//   node scripts/check-sw-missing-registration.mjs --plant  # позитивный контроль
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { pathToFileURL } from "node:url";

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

const RULE = "src/lib/sw-registration-failure.ts";
const COMPONENT = "src/components/SerwistRegister.tsx";
const LIB = "node_modules/@serwist/window/dist/index.mjs";

const MUST_BE_EXPECTED = [
  // Текст события 1B (Chrome 145) — дословно.
  { name: "TypeError", message: "Cannot read properties of undefined (reading 'waiting')" },
  { name: "TypeError", message: "undefined is not an object (evaluating 'this._registration.waiting')" },
  { name: "TypeError", message: 'can\'t access property "waiting", this._registration is undefined' },
  // Прежние ожидаемые — не потеряны.
  { name: "SecurityError", message: "Script https://rusofacilapp.com/sw.js load failed" },
];
const MUST_REPORT = [
  { name: "TypeError", message: "Cannot read properties of undefined (reading 'scriptURL')" },
  { name: "SyntaxError", message: "Unexpected token '<'" },
  { name: "Error", message: "что-то своё сломалось" },
];

async function loadRule(text) {
  const js = stripTypeScriptTypes(text);
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}

async function audit({ rule, component, lib }) {
  const failed = [];
  const mod = await loadRule(rule);
  const missExpected = MUST_BE_EXPECTED.filter((e) => !mod.isExpectedServiceWorkerFailure(e));
  if (missExpected.length) failed.push({ id: "missing-registration-expected", hits: missExpected.map((e) => `${e.name}: ${e.message}`) });
  const missReport = MUST_REPORT.filter((e) => mod.isExpectedServiceWorkerFailure(e));
  if (missReport.length) failed.push({ id: "other-failures-reported", hits: missReport.map((e) => `${e.name}: ${e.message}`) });

  const expectedBlock = component.match(/onExpectedFailure:\s*\(error\)\s*=>\s*\{([\s\S]*?)\n\s{6}\},/)?.[1] ?? null;
  if (expectedBlock === null || /Sentry/.test(expectedBlock) || !/console\.warn/.test(expectedBlock))
    failed.push({ id: "expected-only-console", hits: [COMPONENT] });

  // Предпосылка правила: библиотека и сейчас читает `.waiting` у ответа
  // register(). Если обновление @serwist/window это изменит, сторож скажет,
  // что правило пора перемерить, а не будет молча верить старому коду.
  if (!/this\._registration = await this\._registerScript\(\);[\s\S]{0,600}?this\._registration\.waiting/.test(lib))
    failed.push({ id: "library-premise", hits: [LIB] });
  return failed;
}

const PLANTS = [
  {
    id: "missing-registration-expected",
    title: "правило 7.262 вынуто (старый вид — событие 1B снова уходит в Sentry)",
    break: (f) => ({ ...f, rule: f.rule.replace("if (isMissingRegistrationError(error)) return true;", "") }),
  },
  {
    id: "other-failures-reported",
    title: "правило расширено до «любой TypeError ожидаем»",
    break: (f) => ({ ...f, rule: f.rule.replace('return name === "TypeError" && MISSING_REGISTRATION.test(message);', 'return name === "TypeError";') }),
  },
  {
    id: "expected-only-console",
    title: "ожидаемый отказ начал уходить в Sentry",
    break: (f) => ({
      ...f,
      component: f.component.replace(
        "onExpectedFailure: (error) => {\n",
        "onExpectedFailure: (error) => {\n        Sentry.captureException(error);\n",
      ),
    }),
  },
  {
    id: "library-premise",
    title: "библиотека перестала читать `.waiting` после register()",
    break: (f) => ({ ...f, lib: f.lib.replace("const waitingSW = this._registration.waiting;", "const waitingSW = this._registration?.waitingWorker;") }),
  },
];

if (IS_ENTRY_POINT) {
  const files = {
    rule: readFileSync(RULE, "utf-8"),
    component: readFileSync(COMPONENT, "utf-8"),
    lib: readFileSync(LIB, "utf-8"),
  };
  if (process.argv.includes("--plant")) {
    console.log("check:sw-missing-registration --plant");
    let ok = 0;
    const clean = await audit(files);
    if (clean.length === 0) ok++;
    console.log(`  ${clean.length === 0 ? "СОШЛОСЬ " : "НЕ СОШЛОСЬ"} отрицательный контроль: нынешний код проходит`);
    for (const plant of PLANTS) {
      const failed = (await audit(plant.break(files))).map((x) => x.id);
      const caught = failed.includes(plant.id);
      if (caught) ok++;
      console.log(`  ${caught ? "ПОЙМАНО  " : "ПРОПУЩЕНО"} ${plant.title} → ${failed.join(", ") || "тишина"}`);
    }
    console.log(`  итог: ${ok} из ${PLANTS.length + 1}`);
    process.exit(ok === PLANTS.length + 1 ? 0 : 1);
  }
  const failed = await audit(files);
  if (failed.length) {
    for (const f of failed) console.error(`✗ ${f.id}\n    ${f.hits.join("\n    ")}`);
    process.exit(1);
  }
  console.log(
    `check:sw-missing-registration: ожидаемых ${MUST_BE_EXPECTED.length} из ${MUST_BE_EXPECTED.length}, в Sentry ${MUST_REPORT.length} из ${MUST_REPORT.length}, проводка и предпосылка библиотеки — на месте`,
  );
}
