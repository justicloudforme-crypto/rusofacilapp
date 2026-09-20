/**
 * «ВЫЙТИ НА ОСТАЛЬНЫХ УСТРОЙСТВАХ» НЕ УВОДИТ БРАУЗЕР — ЗАХОД 7.218.
 *
 * ЗАМЕР ВЛАДЕЛЬЦА 20.09.2026, прод, Chrome: нажатие уводило на
 * `/api/auth/logout-everywhere`, вместо страницы показывался серый экран
 * «ERR_NETWORK_CHANGED», а после перезагрузки владельца выкидывало на
 * форму входа — при подписи «кроме этого устройства».
 *
 * И это ОДНА беда, а не две. Свежий признак сеанса ЭТОГО устройства
 * приезжает заголовком `Set-Cookie` ответа на тот самый POST: ответ
 * потерян — в базе версия сеанса увеличена, а куки на устройстве старая.
 * Пока кнопка была навигацией, любая потеря ответа означала выход из
 * аккаунта на том самом устройстве, которое обещали не трогать.
 *
 * ПЯТЬ ПРАВИЛ:
 *   1. в кабинете стоит компонент `LogoutEverywhereButton`, а не голая
 *      форма на служебный адрес;
 *   2. компонент гасит отправку формы (`preventDefault`) и шлёт запрос
 *      сам (`fetch`);
 *   3. он просит JSON (`Accept: application/json`) — иначе маршрут
 *      ответит редиректом, и браузер снова уедет;
 *   4. маршрут умеет отвечать JSON тому, кто его просит, и ПОСЛЕ выдачи
 *      новой куки (`createSession`), а не вместо неё;
 *   5. маршрут по-прежнему отвечает редиректом обычной форме — кнопка
 *      без JS обязана работать.
 *
 *   node scripts/check-logout-everywhere.mjs
 *   node scripts/check-logout-everywhere.mjs --plant
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");
const PROFILE = "src/app/[lang]/profile/page.tsx";
const BUTTON = "src/components/profile/LogoutEverywhereButton.tsx";
const ROUTE = "src/app/api/auth/logout-everywhere/route.ts";

export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

export function violations({ profile, button, route }) {
  const bad = [];
  const p = stripComments(profile);
  const b = stripComments(button);
  const r = stripComments(route);

  if (!/<LogoutEverywhereButton\b/.test(p)) {
    bad.push(`${PROFILE}: кнопка снова обычная форма на служебный адрес — браузер уедет на /api/auth/logout-everywhere и покажет что придётся`);
  }
  if (/<form action="\/api\/auth\/logout-everywhere"/.test(p)) {
    bad.push(`${PROFILE}: форма на служебный адрес осталась прямо в кабинете — ровно то, что снял владелец 20.09.2026`);
  }
  if (!b.trim()) {
    bad.push(`${BUTTON}: компонента нет — сторож ослеп, а не доволен`);
    return bad;
  }
  if (!/event\.preventDefault\(\)/.test(b)) {
    bad.push(`${BUTTON}: отправка формы не гасится — браузер уйдёт на служебный адрес, что бы ни делал fetch`);
  }
  if (!/fetch\("\/api\/auth\/logout-everywhere"/.test(b)) {
    bad.push(`${BUTTON}: запрос уходит не фоном`);
  }
  if (!/Accept:\s*"application\/json"/.test(b)) {
    bad.push(`${BUTTON}: JSON не запрошен — маршрут ответит редиректом, и страница всё равно уедет`);
  }
  if (!/credentials:\s*"same-origin"/.test(b)) {
    bad.push(`${BUTTON}: запрос уходит без куки — сервер не узнает, кто нажал`);
  }

  if (!r.trim()) {
    bad.push(`${ROUTE}: маршрута нет — сторож ослеп, а не доволен`);
    return bad;
  }
  if (!/NextResponse\.json\(/.test(r)) {
    bad.push(`${ROUTE}: маршрут не умеет отвечать JSON — фоновому запросу достанется редирект`);
  }
  if (!/NextResponse\.redirect\(/.test(r)) {
    bad.push(`${ROUTE}: обычной форме больше нечем ответить — кнопка без JS перестала работать`);
  }
  const sessionAt = r.indexOf("createSession(");
  const jsonAt = r.indexOf("NextResponse.json(");
  if (sessionAt !== -1 && jsonAt !== -1 && jsonAt < sessionAt) {
    bad.push(`${ROUTE}: JSON уходит РАНЬШЕ выдачи новой куки — то есть ответ без \`Set-Cookie\`, и это устройство останется со старым признаком сеанса`);
  }
  return bad;
}

const read = (p) => {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
};

function plant() {
  const files = { profile: read(PROFILE), button: read(BUTTON), route: read(ROUTE) };
  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(files).length === 0 }];
  const add = (name, mutated, expect) => {
    if (JSON.stringify(mutated) === JSON.stringify(files)) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(mutated).some((x) => x.includes(expect)) });
  };

  add(
    "подсадка: в кабинете снова голая форма на служебный адрес (ровно замер владельца)",
    { ...files, profile: files.profile.replace(/<LogoutEverywhereButton[\s\S]*?\/>/, '<form action="/api/auth/logout-everywhere" method="POST"><button type="submit">x</button></form>') },
    "снова обычная форма",
  );
  add(
    "подсадка: отправка формы больше не гасится",
    { ...files, button: files.button.replace("event.preventDefault();", "") },
    "не гасится",
  );
  add(
    "подсадка: JSON у маршрута не запрашивается",
    { ...files, button: files.button.replace('headers: { Accept: "application/json" },', "") },
    "JSON не запрошен",
  );
  add(
    "подсадка: маршрут разучился отвечать JSON",
    { ...files, route: files.route.replace(/return NextResponse\.json\(\{ ok: true[^;]*;/, "return NextResponse.redirect(new URL(`/${lang}/profile`, request.url), { status: 303 });") },
    "не умеет отвечать JSON",
  );
  // Порядок переставлен: ответ уходит ДО выдачи куки — то есть без
  // `Set-Cookie`, и устройство остаётся со старым признаком сеанса.
  const jsonBlock = `  if ((request.headers.get("Accept") ?? "").includes("application/json")) {\n    return NextResponse.json({ ok: true, sessionVersion: updated.sessionVersion });\n  }\n`;
  add(
    "подсадка: JSON уходит раньше новой куки (ответ без Set-Cookie)",
    {
      ...files,
      route: files.route
        .replace(jsonBlock, "")
        .replace("  await createSession(updated.id, updated.sessionVersion);", jsonBlock + "  await createSession(updated.id, updated.sessionVersion);"),
    },
    "РАНЬШЕ выдачи новой куки",
  );

  for (const c of cases) {
    console.log(`  ${c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО"} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(
    ok
      ? `check:logout-everywhere --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль`
      : "check:logout-everywhere --plant — FAILED",
  );
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const bad = violations({ profile: read(PROFILE), button: read(BUTTON), route: read(ROUTE) });
  if (bad.length) {
    console.error(`check:logout-everywhere — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log("check:logout-everywhere — 5 правил, файлов 3, нарушений 0 (заход 7.218)");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
