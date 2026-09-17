/**
 * У ВХОДА ЕСТЬ ПРИЗНАК ЗАГРУЗКИ — ДОЛГ 241, заход 7.206.
 *
 * Владелец снял 17.09.2026 на POCO, внутри оболочки: после нажатия
 * «Iniciar sesión» экран около трёх секунд не меняется ничем. Нажатие
 * второй раз в такой момент — не ошибка человека, а единственное, что ему
 * остаётся.
 *
 * ПОЧЕМУ СТОРОЖ СТАТИЧЕСКИЙ, ЕСЛИ ЕСТЬ ПРОВЕРКА В БРАУЗЕРЕ. Поведение
 * заперто в `e2e/login-loading-state.spec.ts` (и без правки она краснеет —
 * проверено подсадкой прежнего кода). Но браузерный прогон стоит минут и
 * живёт в `ci.yml`, а `verify` на ноутбуке его не гоняет; и форм входа
 * ТРИ, а забыть легко одну. Этот сторож дёшев, стоит и в `verify`, и в
 * `ci.yml`, и отвечает ровно на вопрос «жив ли сам механизм и подключён
 * ли он к каждой форме».
 *
 * ЧТО ПРОВЕРЯЕТСЯ
 *
 *   1. Все три формы (вход, регистрация, восстановление пароля) кончаются
 *      `AuthSubmitButton`, а не голой кнопкой.
 *   2. У каждой передана подпись ожидания, и она НЕ равна обычной.
 *   3. Сам компонент: слушает `submit` формы (а не только нажатие — Enter
 *      в поле пароля отправляет форму, а `onClick` его не видит), гасит
 *      второй `submit` через `preventDefault`, и показывает ожидание
 *      кнопке (`loading`).
 *   4. Обе локали несут все три подписи ожидания.
 *
 *   node scripts/check-auth-pending.mjs
 *   node scripts/check-auth-pending.mjs --plant
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");
const BUTTON = "src/components/auth/AuthSubmitButton.tsx";
const FORMS = [
  { file: "src/app/[lang]/login/page.tsx", label: "dict.auth.submit", pending: "dict.auth.submitPending" },
  { file: "src/app/[lang]/register/page.tsx", label: "dict.auth.registerSubmit", pending: "dict.auth.registerSubmitPending" },
  { file: "src/app/[lang]/forgot-password/page.tsx", label: "dict.auth.forgotSubmit", pending: "dict.auth.forgotSubmitPending" },
];
const DICTS = ["src/dictionaries/es.json", "src/dictionaries/ru.json"];
const PENDING_KEYS = ["submitPending", "registerSubmitPending", "forgotSubmitPending"];
const PLAIN_KEYS = { submitPending: "submit", registerSubmitPending: "registerSubmit", forgotSubmitPending: "forgotSubmit" };

export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

export function violations({ button, forms, dicts }) {
  const bad = [];
  const b = stripComments(button);

  if (!/addEventListener\("submit"/.test(b)) {
    bad.push(`${BUTTON}: признак вешается не на \`submit\` формы — Enter в поле пароля его не поднимет (долг 241)`);
  }
  if (!/event\.preventDefault\(\)/.test(b)) {
    bad.push(`${BUTTON}: второй \`submit\` ничем не гасится — двойное нажатие снова отправит два запроса`);
  }
  if (!/loading=\{pending\}/.test(b)) {
    bad.push(`${BUTTON}: кнопка не показывает ожидания — человек снова смотрит на неизменившийся экран`);
  }
  if (!/pending \? pendingLabel : label/.test(b)) {
    bad.push(`${BUTTON}: подпись ожидания не печатается`);
  }

  for (const form of FORMS) {
    const source = stripComments(forms[form.file] ?? "");
    if (!source) {
      bad.push(`${form.file}: файла нет — сторож ослеп, а не доволен`);
      continue;
    }
    if (!/<AuthSubmitButton\b/.test(source)) {
      bad.push(`${form.file}: форма кончается голой кнопкой — признака загрузки у неё нет (долг 241)`);
      continue;
    }
    const tag = /<AuthSubmitButton[\s\S]*?\/>/.exec(source)?.[0] ?? "";
    if (!tag.includes(`label={${form.label}}`)) {
      bad.push(`${form.file}: у кнопки не та обычная подпись (${form.label})`);
    }
    if (!tag.includes(`pendingLabel={${form.pending}}`)) {
      bad.push(`${form.file}: у кнопки нет подписи ожидания (${form.pending})`);
    }
  }

  for (const [file, parsed] of Object.entries(dicts)) {
    const auth = parsed?.auth ?? {};
    for (const key of PENDING_KEYS) {
      const value = auth[key];
      if (typeof value !== "string" || !value.trim()) {
        bad.push(`${file}: нет подписи ожидания auth.${key}`);
        continue;
      }
      if (value === auth[PLAIN_KEYS[key]]) {
        bad.push(`${file}: auth.${key} совпадает с обычной подписью — на экране ничего не меняется`);
      }
    }
  }
  return bad;
}

function load() {
  const forms = {};
  for (const form of FORMS) forms[form.file] = readFileSync(form.file, "utf8");
  const dicts = {};
  for (const file of DICTS) dicts[file] = JSON.parse(readFileSync(file, "utf8"));
  return { button: readFileSync(BUTTON, "utf8"), forms, dicts };
}

function plant() {
  const live = load();
  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(live).length === 0 }];
  const planted = (name, patch, expect) => {
    const input = { ...live, ...patch };
    if (JSON.stringify(input) === JSON.stringify(live)) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(input).some((f) => f.includes(expect)) });
  };

  planted(
    "подсадка: перестать гасить второй submit — поймана",
    { button: live.button.replace("event.preventDefault();", "void event;") },
    "ничем не гасится",
  );
  planted(
    "подсадка: слушать нажатие вместо отправки формы — поймана",
    { button: live.button.replace('addEventListener("submit"', 'addEventListener("click"') },
    "не на `submit` формы",
  );
  planted(
    "подсадка: кнопка перестала показывать ожидание — поймана",
    { button: live.button.replace("loading={pending}", "loading={false}") },
    "не показывает ожидания",
  );
  for (const form of FORMS) {
    planted(
      `подсадка: ${form.file} вернулся к голой кнопке — поймана`,
      { forms: { ...live.forms, [form.file]: live.forms[form.file].split("<AuthSubmitButton").join("<Button") } },
      "голой кнопкой",
    );
    planted(
      `подсадка: ${form.file} потерял подпись ожидания — поймана`,
      { forms: { ...live.forms, [form.file]: live.forms[form.file].replace(`pendingLabel={${form.pending}}`, "") } },
      "нет подписи ожидания",
    );
  }
  planted(
    "подсадка: подпись ожидания равна обычной — поймана",
    {
      dicts: {
        ...live.dicts,
        [DICTS[0]]: { ...live.dicts[DICTS[0]], auth: { ...live.dicts[DICTS[0]].auth, submitPending: live.dicts[DICTS[0]].auth.submit } },
      },
    },
    "совпадает с обычной подписью",
  );

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:auth-pending --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const bad = violations(load());
  if (bad.length) {
    console.error("ВХОД СНОВА МОЖЕТ МОЛЧАТЬ ТРИ СЕКУНДЫ (долг 241):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(`[check:auth-pending] все ${FORMS.length} формы входа показывают ожидание и не отправляют второго запроса (контроль — --plant).`);
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
