// ТЕЛО НЕ ТОЙ ФОРМЫ НЕ РОНЯЕТ ОБРАБОТЧИК (заход 7.262, Sentry JAVASCRIPT-NEXTJS-S).
//
// `request.formData()` бросает TypeError на любом типе тела, кроме формы, а
// `request.json()` — на любом не-JSON. Голый вызов в обработчике маршрута
// превращает чужой запрос (проверку безопасности, бота, кривого клиента) в
// 500 и событие Sentry. Замер 10.10.2026 на локальном сервере: 18
// обработчиков, 72 ответа 500 на 4 вида чужого тела; после правки — 0 из 480.
//
// Правила:
//   form-helper    — ни один route.ts не зовёт `.formData()` голым: только
//                    `readRequestForm` из src/lib/request-form.ts (или
//                    `.formData().catch(` с проверкой результата);
//   json-guarded   — `request.json()` / `req.json()` только с `.catch(` или
//                    внутри `try {` (не дальше трёх строк выше);
//   helper-415     — помощник отвечает 415 на чужой тип и 400 на битое тело,
//                    а разбор держит в try.
//
//   node scripts/check-request-body.mjs          # гейт
//   node scripts/check-request-body.mjs --plant  # позитивный контроль
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

const HELPER = "src/lib/request-form.ts";

function routeFiles(dir = "src/app") {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...routeFiles(p));
    else if (name === "route.ts" || name === "route.tsx") out.push(p);
  }
  return out.sort();
}

function bareForm(src) {
  const hits = [];
  src.split("\n").forEach((line, i) => {
    if (/\.formData\(\)/.test(line) && !/\.formData\(\)\s*\.catch\(/.test(line)) hits.push(i + 1);
  });
  return hits;
}

function bareJson(src) {
  const lines = src.split("\n");
  const hits = [];
  lines.forEach((line, i) => {
    if (!/\b(request|req)\.json\(\)/.test(line)) return;
    if (/\b(request|req)\.json\(\)\s*\)?\s*\.catch\(/.test(line)) return;
    const above = lines.slice(Math.max(0, i - 3), i).join("\n");
    if (/\btry\s*\{/.test(above)) return;
    hits.push(i + 1);
  });
  return hits;
}

const RULES = [
  {
    id: "form-helper",
    what: "ни один обработчик не зовёт `.formData()` голым",
    find: ({ routes }) => routes.flatMap(([f, s]) => bareForm(s).map((l) => `${f}:${l}`)),
  },
  {
    id: "json-guarded",
    what: "`request.json()` только с `.catch(` или внутри `try`",
    find: ({ routes }) => routes.flatMap(([f, s]) => bareJson(s).map((l) => `${f}:${l}`)),
  },
  {
    id: "helper-415",
    what: "помощник: 415 на чужой тип, 400 на битое тело, разбор в try",
    find: ({ helper }) =>
      /status:\s*415/.test(helper) && /status:\s*400/.test(helper) && /try\s*\{\s*return \{ ok: true, form: await request\.formData\(\) \}/.test(helper)
        ? []
        : [HELPER],
  },
  {
    id: "form-routes-use-helper",
    what: "обработчики формы (не меньше 18) читают тело через readRequestForm",
    find: ({ routes }) => {
      const n = routes.filter(([, s]) => /await readRequestForm\(request\)/.test(s)).length;
      return n >= 18 ? [] : [`readRequestForm используют ${n} из ≥18`];
    },
  },
];

function audit(files) {
  const failed = [];
  for (const r of RULES) {
    const hits = r.find(files);
    if (hits.length) failed.push({ id: r.id, what: r.what, hits });
  }
  return failed;
}

function sources() {
  return {
    routes: routeFiles().map((f) => [f, readFileSync(f, "utf-8")]),
    // Нет помощника — не падение сторожа, а нарушение правила helper-415.
    helper: existsSync(HELPER) ? readFileSync(HELPER, "utf-8") : "",
  };
}

const CHECKOUT = "src/app/api/checkout/route.ts";
const withRoute = (files, file, fn) => ({
  ...files,
  routes: files.routes.map(([f, s]) => [f, f === file ? fn(s) : s]),
});

const PLANTS = [
  {
    id: "form-helper",
    title: "касса вернулась к старому виду (`await request.formData()` — Sentry NEXTJS-S)",
    break: (f) =>
      withRoute(f, CHECKOUT, (s) =>
        s.replace(
          "const read = await readRequestForm(request);\n  if (!read.ok) return read.response;\n  const formData = read.form;",
          "const formData = await request.formData();",
        ),
      ),
  },
  {
    id: "json-guarded",
    title: "обработчик JSON потерял `.catch`",
    break: (f) =>
      withRoute(f, "src/app/api/theme/route.ts", (s) =>
        s.replace("await request.json().catch(() => null)", "await request.json()"),
      ),
  },
  {
    id: "helper-415",
    title: "помощник начал отвечать 500 вместо 415",
    break: (f) => ({ ...f, helper: f.helper.replace("status: 415", "status: 500") }),
  },
  {
    id: "helper-415",
    title: "помощник перестал ловить исключение разбора",
    break: (f) => ({
      ...f,
      helper: f.helper.replace("try {\n    return { ok: true, form: await request.formData() };", "{\n    return { ok: true, form: await request.formData() };"),
    }),
  },
];

if (IS_ENTRY_POINT) {
  const files = sources();
  if (process.argv.includes("--plant")) {
    console.log("check:request-body --plant");
    let ok = 0;
    const clean = audit(files);
    if (clean.length === 0) ok++;
    console.log(`  ${clean.length === 0 ? "СОШЛОСЬ " : "НЕ СОШЛОСЬ"} отрицательный контроль: нынешний код проходит`);
    for (const plant of PLANTS) {
      const failed = audit(plant.break(files)).map((x) => x.id);
      const caught = failed.includes(plant.id);
      if (caught) ok++;
      console.log(`  ${caught ? "ПОЙМАНО  " : "ПРОПУЩЕНО"} ${plant.title} → ${failed.join(", ") || "тишина"}`);
    }
    const total = PLANTS.length + 1;
    console.log(`  итог: ${ok} из ${total}`);
    process.exit(ok === total ? 0 : 1);
  }
  const failed = audit(files);
  const n = files.routes.length;
  if (failed.length) {
    for (const f of failed) console.error(`✗ ${f.id}: ${f.what}\n    ${f.hits.join("\n    ")}`);
    process.exit(1);
  }
  console.log(`check:request-body: ${n} обработчиков, голых formData()/json() 0, readRequestForm — ${files.routes.filter(([, s]) => /await readRequestForm\(request\)/.test(s)).length}`);
}
