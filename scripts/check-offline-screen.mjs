/**
 * КАРКАС БЕЗ СЕТИ И ОДИН ЯЗЫК НА ЭКРАНЕ — ЗАХОДЫ 7.218 И 7.227.
 *
 * ЧТО СНЯЛ ВЛАДЕЛЕЦ 20.09.2026: при живой сети страница рассказа на
 * несколько секунд подменилась экраном «Estás sin conexión — Вы не в
 * сети». Вторая половина этой жалобы — про язык: человек, зашедший на
 * `/ru/...`, читал половину экрана по-испански, и наоборот.
 *
 * ПОЧЕМУ ЭТО ВООБЩЕ РЕШАЕТСЯ. Файл статический и отдаётся воркером
 * вместо страницы, но АДРЕС в строке браузера остаётся исходным — то
 * есть `/ru/stories/...` или `/es/pricing`. Значит локаль известна, и
 * спрашивать её не у кого не нужно.
 *
 * ЧЕТЫРЕ ПРАВИЛА:
 *   1. обе локали в разметке есть (`data-locale="es"` и `data-locale="ru"`);
 *   2. ни один узел не печатает две локали разом — то есть строки вида
 *      «Estás sin conexión — Вы не в сети» в файле нет;
 *   3. лишняя половина УБИРАЕТСЯ скриптом по `location.pathname`, а не
 *      дописывается им: при выключенном JS человек прочтёт обе, и это
 *      хуже одной, но лучше пустого экрана;
 *   4. язык документа проставляется тем же правилом (`documentElement.lang`).
 *
 *   node scripts/check-offline-screen.mjs
 *   node scripts/check-offline-screen.mjs --plant
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");
const FILE = "public/offline.html";

/** Текст разметки без HTML-комментариев: в комментарии этого файла
 *  прежняя двуязычная строка процитирована намеренно. */
export function stripHtmlComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, " ");
}

export function violations(htmlRaw) {
  const bad = [];
  if (!htmlRaw.trim()) {
    bad.push(`${FILE}: файла нет — воркеру нечем ответить на навигацию без сети`);
    return bad;
  }
  const html = stripHtmlComments(htmlRaw);

  for (const locale of ["es", "ru"]) {
    if (!new RegExp(`data-locale="${locale}"`).test(html)) {
      bad.push(`${FILE}: половины «${locale}» нет вовсе — заглушка заговорит не на том языке`);
    }
  }
  // Два языка в одном узле: испанская и русская буквы между одной парой
  // «>» и «<». Тело `<script>` и `<style>` — не подписи, их не читают:
  // правило про ВИДИМЫЙ текст, а русская строка заголовка вкладки живёт
  // именно в скрипте.
  const visible = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const twoInOne = [...visible.matchAll(/>([^<>]{3,})</g)].filter(
    (m) => /[а-яё]/i.test(m[1]) && /[a-z]/i.test(m[1].replace(/[^a-zA-Z]/g, "")),
  );
  if (twoInOne.length > 0) {
    bad.push(
      `${FILE}: ${twoInOne.length} узлов печатают две локали разом (например «${twoInOne[0][1].trim().slice(0, 40)}») — ровно то, что видел владелец 20.09.2026`,
    );
  }
  if (!/location\.pathname/.test(html)) {
    bad.push(`${FILE}: локаль выбирается не по адресу — а больше здесь знать её неоткуда`);
  }
  if (!/\.remove\(\)/.test(html)) {
    bad.push(`${FILE}: лишняя половина не убирается, а дописывается — при выключенном JS экран окажется пустым`);
  }
  if (!/documentElement\.lang/.test(html)) {
    bad.push(`${FILE}: язык документа не проставляется — экран для озвучки и переводчика остаётся чужим`);
  }

  // 5) каркас: шапка и нижняя панель из пяти вкладок
  if (!/<header[\s>]/.test(html)) {
    bad.push(`${FILE}: шапки нет — без сети снова голый экран (замер 23.09.2026: header отсутствует, ссылок 0)`);
  }
  const tabs = [...html.matchAll(/data-href="([^"]*)"/g)].map((m) => m[1]);
  const tabLinks = tabs.filter((href) => href !== "");
  if (tabLinks.length !== 5) {
    bad.push(
      `${FILE}: вкладок в нижней панели ${tabLinks.length}, а не 5 — меню без сети перестало совпадать с BottomNav.tsx`,
    );
  }
  for (const expected of ["/stories", "/courses", "/vocabulary", "/word-games"]) {
    if (!tabLinks.includes(expected)) {
      bad.push(`${FILE}: во вкладках нет адреса ${expected} — меню без сети уже не то же, что с сетью`);
    }
  }
  // 6) адреса подставляются по локали
  if (!/setAttribute\("href", "\/" \+ lang/.test(html)) {
    bad.push(`${FILE}: адреса вкладок не получают локаль из адреса — человек с /ru уедет в испанский раздел`);
  }
  // 7) кнопка повтора
  if ((html.match(/data-retry/g) ?? []).length < 3) {
    bad.push(`${FILE}: кнопки «Повторить» нет в обеих локалях или у неё нет обработчика`);
  }
  // 8) возврат сети — без ручной перезагрузки
  if (!/addEventListener\("online"/.test(html)) {
    bad.push(`${FILE}: возврат сети не слушается — человеку придётся перезапускать приложение руками`);
  }
  if (!/setInterval\(/.test(html)) {
    bad.push(
      `${FILE}: своей пробы по таймеру нет — событие «online» приходит не на всех устройствах, и экран завис бы до ручного действия`,
    );
  }
  // 9) «нет сети» — только по признаку (долг 278)
  if (!/navigator\.onLine/.test(html)) {
    bad.push(`${FILE}: признака navigator.onLine нет — «нет сети» снова утверждается по ОДНОМУ упавшему запросу (долг 278)`);
  }
  if (!/\/api\/health/.test(html)) {
    bad.push(`${FILE}: пробы до своего /api/health нет — отличить «сеть умерла» от «страница не открылась» нечем (долг 278)`);
  }
  for (const state of ["offline", "error"]) {
    if (!new RegExp(`data-state="${state}"`).test(html)) {
      bad.push(
        `${FILE}: состояния «${state}» в разметке нет — экран снова говорит одно и то же при любой причине отказа (долг 278)`,
      );
    }
  }
  // 10) личных и платных адресов в каркасе нет
  const forbidden = [...html.matchAll(/data-href="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((href) => /(profile|admin|pricing)/.test(href));
  if (forbidden.length > 0) {
    bad.push(`${FILE}: во вкладках личный или платный адрес (${forbidden.join(", ")}) — без сети показать там нечего`);
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
  const html = read(FILE);
  const cases = [{ name: "отрицательный контроль: живой файл сегодня чист", ok: violations(html).length === 0 }];
  const add = (name, mutated, expect) => {
    if (mutated === html) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(mutated).some((x) => x.includes(expect)) });
  };

  add(
    "подсадка: заголовок снова печатает две локали разом (ровно замер владельца)",
    html.replace(
      /<h1 lang="es" data-locale="es" data-state="error">[^<]*<\/h1>/,
      '<h1 lang="es" data-locale="es" data-state="error">Estás sin conexión — Вы не в сети</h1>',
    ),
    "печатают две локали разом",
  );
  add(
    "подсадка: шапки нет — состояние ДО захода 7.227",
    html.replace(/<header[\s\S]*?<\/header>/, ""),
    "шапки нет",
  );
  add(
    "подсадка: нижняя панель убрана целиком (голый экран, ссылок 0)",
    html.replace(/<nav class="tabs"[\s\S]*?<\/nav>/, ""),
    "вкладок в нижней панели 0",
  );
  add(
    "подсадка: вкладка «Курсы» выпала из меню",
    html.replace('data-href="/courses"', 'data-href="/coursesX"'),
    "нет адреса /courses",
  );
  add(
    "подсадка: во вкладках появился кабинет",
    html.replace('data-href="/login"', 'data-href="/profile"'),
    "личный или платный адрес",
  );
  add(
    "подсадка: адреса вкладок перестали получать локаль",
    html.replace(/setAttribute\("href", "\/" \+ lang/, 'setAttribute("href", "/es"'),
    "не получают локаль",
  );
  add(
    "подсадка: возврат сети больше не слушается",
    html.replace(/addEventListener\("online"/, 'addEventListener("focus"'),
    "возврат сети не слушается",
  );
  add(
    "подсадка: своей пробы по таймеру нет",
    html.replace(/setInterval\(/g, "queueMicrotask("),
    "пробы по таймеру нет",
  );
  add(
    "подсадка: «нет сети» снова утверждается без пробы (ровно долг 278)",
    html.replaceAll("/api/health", "/nothing"),
    "пробы до своего /api/health нет",
  );
  add(
    "подсадка: признак navigator.onLine выброшен",
    html.replace(/navigator\.onLine/g, "false"),
    "признака navigator.onLine нет",
  );
  add(
    "подсадка: состояние «страница не открылась» убрано — экран снова врёт про сеть",
    html.replaceAll('data-state="error"', 'data-state="offline"'),
    "состояния «error» в разметке нет",
  );
  add("подсадка: русской половины нет вовсе", html.replaceAll('data-locale="ru"', 'data-locale="xx"'), "половины «ru» нет");
  add("подсадка: локаль выбирается не по адресу", html.replace(/location\.pathname/g, 'navigator.language.slice(0, 2)'), "не по адресу");
  add("подсадка: лишняя половина не убирается", html.replace(/\.remove\(\)/g, ".setAttribute('hidden', '')"), "не убирается");
  add("подсадка: язык документа не проставляется", html.replace(/documentElement\.lang/g, "documentElement.dataset.lang"), "язык документа не проставляется");

  for (const c of cases) {
    console.log(`  ${c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО"} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(
    ok
      ? `check:offline-screen --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль`
      : "check:offline-screen --plant — FAILED",
  );
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const bad = violations(read(FILE));
  if (bad.length) {
    console.error(`check:offline-screen — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log("check:offline-screen — 10 правил, локалей 2, вкладок 5, нарушений 0 (заходы 7.218 и 7.227)");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
