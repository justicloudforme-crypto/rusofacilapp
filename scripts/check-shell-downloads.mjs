// ВНУТРИ ПРИЛОЖЕНИЯ НЕТ ССЫЛОК НА СКАЧИВАНИЕ ФАЙЛА — заход 7.242, долг 343
// (аудит 7.241, Р1).
//
// ОТКУДА. У оболочки нет `setDownloadListener` (ни в `MainActivity.java`, ни
// в `Bridge.java` Capacitor): ответ `Content-Disposition: attachment` WebView
// молча глотает. Замер 7.241 на эмуляторе, релиз 1.0.12: нажатие «Descargar
// presentación en PDF» — активность та же, в `Download/` 0 файлов. Кнопок
// таких было две — `/es/courses` (видит любой гость и робот предзапуска
// Google) и вкладка слайдов урока у подписчика. «Мёртвая кнопка» —
// ровно то, за что отказывают по «Broken functionality».
//
// ЧТО СТЕРЕЖЁТСЯ.
//   1. СТАТИЧЕСКАЯ (без `--base`). Маршруты, отдающие файл, НАХОДЯТСЯ
//      сканом `src/app/api/**/route.*` по `Content-Disposition: attachment`
//      — списка рукой нет. Каждый файл `src/`, который ссылается на такой
//      маршрут или ставит атрибут `download`, обязан стоять в GATES: ссылка
//      внутри условия `{<признак> && (`, а вызывающая страница выставляет
//      признак с ответом сервера «это оболочка». Новая ссылка на файл без
//      записи в GATES роняет сторож сама.
//   2. ЖИВАЯ (`--base=…`, сервер с `E2E_TEST_SEED=1`). Вся перепись адресов
//      (`route-census.mjs`) гостем и подписчиком, в вебе и в оболочке: в
//      оболочке ссылок на файл 0; в вебе ≥ 1 (встроенный контроль — иначе
//      ноль ничего не значит); `--plant` подсаживает ссылку в отдачу
//      оболочки каждой роли.
//
//   node scripts/check-shell-downloads.mjs [--plant]
//   node scripts/check-shell-downloads.mjs --base=http://… [--plant]
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { repoFiles } from "./repo-files.mjs";
import { collectAddresses } from "./route-census.mjs";

/** Файлы со ссылкой на скачивание и чем она закрыта в оболочке. */
export const GATES = [
  {
    file: "src/components/intro/IntroPresentation.tsx",
    guard: /\{showPdf && \(\s*<div[^>]*>\s*<a\s+href=\{`\/api\/intro\/pdf/,
    caller: "src/app/[lang]/courses/page.tsx",
    // 7.243: признак спрашивается один раз в `nativeShell` (он же убирает
    // Telegram из колоды) и передаётся сюда.
    callerGate: /const nativeShell = await isNativeShellRequest\(\);[\s\S]*showPdf=\{!nativeShell\}/,
  },
  {
    file: "src/components/lesson/SlidesTab.tsx",
    guard: /\{canDownloadPdf && \(\s*<a\s+href=\{`\/api\/lessons\//,
    caller: "src/app/[lang]/courses/[level]/[lesson]/page.tsx",
    callerGate: /canDownloadPdf=\{tier !== "free" && !nativeShell\}/,
  },
];

function strip(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
}

/** Маршрут файла по пути `route.*`: `[x]` — любая одна часть адреса. */
function routeOf(file) {
  const path = "/" + file.replace(/^src\/app\//, "").replace(/\/route\.(t|j)sx?$/, "");
  return path;
}

export function attachmentRoutes(files) {
  return Object.entries(files)
    .filter(([f, src]) => /^src\/app\/api\/.*\/route\.(t|j)sx?$/.test(f) && /Content-Disposition["']?\s*:\s*[`'"]attachment/i.test(src))
    .map(([f]) => routeOf(f));
}

/** Регулярка ссылки на маршрут в ИСХОДНИКЕ: `[x]` ↔ `${…}` или литерал. */
function sourceRe(route) {
  const body = route
    .split("/")
    .map((seg) => (seg.startsWith("[") ? "(?:\\$\\{[^}]+\\}|[^/\"'`\\s]+)" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(body + "(?![\\w-])");
}

/** То же в ОТДАЧЕ: `href="/api/intro/pdf?lang=es"`. */
function htmlRe(route) {
  const body = route
    .split("/")
    .map((seg) => (seg.startsWith("[") ? "[^/\"'?#\\s]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`href=["'](?:https?://[^"']*)?${body}(?:[?#][^"']*)?["']`, "gi");
}

const DOWNLOAD_ATTR = /<a\b[^>]*\sdownload(?:\s|=|>|\/)/i;

export function judgeStatic(files) {
  const bad = [];
  const routes = attachmentRoutes(files);
  if (routes.length === 0) bad.push("маршрутов с Content-Disposition: attachment 0 — скан ослеп (маршруты PDF есть в коде)");
  const res = routes.map((r) => [r, sourceRe(r)]);
  const referencing = new Set();
  for (const [file, raw] of Object.entries(files)) {
    if (!/\.(tsx|ts)$/.test(file) || file.includes(".test.") || file.startsWith("src/app/api/")) continue;
    const src = strip(raw);
    const hits = res.filter(([, re]) => re.test(src)).map(([r]) => r);
    const attr = /\sdownload(?:=\{|=["']|\s|\/?>)/.test(src.replace(/data-rf-download[\w-]*/g, "")) || /\.download\s*=/.test(src);
    if (hits.length || attr) referencing.add(file);
  }
  for (const file of referencing) {
    const gate = GATES.find((g) => g.file === file);
    if (!gate) {
      bad.push(`${file}: ссылка на скачивание файла без записи в GATES — внутри приложения она будет мёртвой (у оболочки нет setDownloadListener). Закройте её признаком оболочки и впишите сюда.`);
      continue;
    }
    if (!gate.guard.test(strip(files[file]))) bad.push(`${file}: ссылка на файл не стоит внутри условия-признака — в оболочке она нарисуется`);
    if (!gate.callerGate.test(strip(files[gate.caller] ?? ""))) bad.push(`${gate.caller}: признак ссылки на файл не выключается ответом «это оболочка» (isNativeShellRequest)`);
  }
  for (const gate of GATES) {
    if (!referencing.has(gate.file)) bad.push(`${gate.file}: в GATES, а ссылки на файл в нём нет — запись устарела, перечитайте сторож`);
  }
  return { bad, routes, referencing: [...referencing] };
}

export function countDownloadLinks(html, routes) {
  let n = 0;
  for (const r of routes) n += (html.match(htmlRe(r)) ?? []).length;
  const tags = html.match(/<a\b[^>]*>/gi) ?? [];
  n += tags.filter((t) => DOWNLOAD_ATTR.test(t + ">")).length;
  return n;
}

// ---------------------------------------------------------------- живая
const UA = "Mozilla/5.0 (Linux; Android 14; POCO) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36";

async function session(base, subscribed) {
  const email = `dlguard-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
    body: new URLSearchParams({ email, password: "TestPass123!", lang: "es", redirectTo: "/es" }).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  const jar = res.headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => !c.endsWith("=")).join("; ");
  if (!jar) throw new Error(`роль не завелась: register ответил ${res.status} без куки (сервер без E2E_TEST_SEED=1?)`);
  if (subscribed) {
    const g = await fetch(`${base}/api/test/grant-subscription`, { method: "POST", headers: { cookie: jar, "content-type": "application/json" }, body: "{}", signal: AbortSignal.timeout(30_000) });
    if (!g.ok) throw new Error(`подписка роли не выдана: ${g.status}`);
  }
  return jar;
}

async function get(base, path, shell, jar) {
  const headers = { "user-agent": shell ? `${UA} RFNativeShell/13` : UA };
  if (jar) headers.cookie = jar;
  const res = await fetch(`${base}${path}`, { headers, redirect: "manual", signal: AbortSignal.timeout(60_000) });
  return res.status === 200 ? res.text() : null;
}

async function pool(items, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  }));
  return out;
}

async function live(base, plant, routes) {
  const census = await collectAddresses(base, { perDynamic: 2 });
  const addresses = census.addresses.filter((a) => !a.includes("/admin"));
  const roles = [["гость", null], ["подписчик", await session(base, true)]];
  const problems = [];
  let web = 0;
  let judged = 0;
  let planted = 0;
  for (const [role, jar] of roles) {
    const rows = await pool(addresses, 6, async (path) => ({ path, shell: await get(base, path, true, jar), web: await get(base, path, false, jar) }));
    for (const row of rows) {
      if (row.web) web += countDownloadLinks(row.web, routes);
      if (!row.shell) continue;
      judged++;
      const n = countDownloadLinks(row.shell, routes);
      if (n) problems.push(`${row.path} (${role}, оболочка): ссылок на скачивание файла ${n}`);
      if (plant && countDownloadLinks(row.shell.replace("</body>", '<a href="/api/intro/pdf?lang=es">x</a></body>'), routes) > n) planted++;
    }
  }
  console.log(`  адресов ${addresses.length} × ролей ${roles.length}: ответов оболочки ${judged}; ссылок на файл в вебе ${web} (контроль измерителя)`);
  if (web === 0) problems.push("КОНТРОЛЬ: в вебе ссылок на файл 0 — измеритель слеп");
  if (plant) {
    const ok = problems.length === 0 && judged > 0 && planted === judged;
    console.log(ok ? `check:shell-downloads --base --plant — подсадка поймана в ${planted} из ${judged} ответов, настоящая отдача молчит` : `check:shell-downloads --base --plant — FAILED (${planted}/${judged}, проблем ${problems.length})`);
    return ok ? 0 : 1;
  }
  if (problems.length) {
    console.error("check:shell-downloads (живая) — ОТКАЗ:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(`check:shell-downloads (живая) — в оболочке ссылок на скачивание файла 0 на ${judged} ответах; в вебе ${web}.`);
  return 0;
}

function readAll() {
  const out = {};
  for (const f of repoFiles(["src"])) {
    if (!/\.(tsx?|jsx?)$/.test(f)) continue;
    try {
      out[f] = readFileSync(f, "utf8");
    } catch {
      /* нет в рабочем дереве */
    }
  }
  return out;
}

async function main() {
  const files = readAll();
  const plant = process.argv.includes("--plant");
  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  const { bad, routes, referencing } = judgeStatic(files);
  if (baseArg) return live(baseArg.slice("--base=".length), plant, routes);

  if (plant) {
    let ok = bad.length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящие исходники`);
    const edit = (file, from, to) => {
      const next = files[file].replace(from, to);
      return next === files[file] ? null : { ...files, [file]: next };
    };
    const cases = [
      ["вводная снова рисует PDF всегда (как до 7.242)", edit("src/components/intro/IntroPresentation.tsx", "{showPdf && (", "{true && ("), "IntroPresentation.tsx: ссылка на файл не стоит"],
      ["страница курсов перестала спрашивать оболочку", edit("src/app/[lang]/courses/page.tsx", "showPdf={!nativeShell}", "showPdf"), "courses/page.tsx: признак"],
      ["урок снова даёт PDF подписчику в оболочке", edit("src/app/[lang]/courses/[level]/[lesson]/page.tsx", 'canDownloadPdf={tier !== "free" && !nativeShell}', 'canDownloadPdf={tier !== "free"}'), "[lesson]/page.tsx: признак"],
      ["новая ссылка на файл без записи в GATES — скан находит её сам", { ...files, "src/components/__plant__/Export.tsx": 'export const E = () => <a href="/api/intro/pdf?lang=es">PDF</a>;' }, "__plant__/Export.tsx: ссылка на скачивание"],
      ["новый атрибут download без записи в GATES", { ...files, "src/components/__plant__/Save.tsx": 'export const S = () => <a href="/x.csv" download>CSV</a>;' }, "__plant__/Save.tsx"],
      ["новый маршрут-файл и ссылка на него", { ...files, "src/app/api/export/[id]/route.ts": 'export const GET = () => new Response("x", { headers: { "Content-Disposition": `attachment; filename="a.csv"` } });', "src/components/__plant__/Csv.tsx": "export const C = ({ id }: { id: string }) => <a href={`/api/export/${id}`}>CSV</a>;" }, "__plant__/Csv.tsx"],
    ];
    let caught = 0;
    for (const [name, patched, expect] of cases) {
      if (!patched) {
        console.log(`  НЕ ПРИМЕНИЛАСЬ — ${name}`);
        ok = false;
        continue;
      }
      const hit = judgeStatic(patched).bad.some((m) => m.includes(expect));
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
    }
    // Контроль измерителя отдачи: настоящая ссылка вводной и атрибут download считаются.
    const probe = countDownloadLinks('<a href="/api/intro/pdf?lang=ru" class="x">a</a><a href="/api/lessons/a1/2/pdf">b</a><a href="/f.zip" download>c</a><a href="/es/courses">d</a>', routes);
    const probeOk = probe === 3;
    console.log(`  ${probeOk ? "поймано" : "ПРОПУЩЕНО"} — счётчик отдачи: 3 ссылки на файл из 4 ссылок (найдено ${probe})`);
    ok &&= caught === cases.length && probeOk;
    console.log(ok ? `check:shell-downloads --plant — ${caught + 1} из ${cases.length + 1} подсадок, 1 из 1 отрицательный контроль` : "check:shell-downloads --plant — FAILED");
    return ok ? 0 : 1;
  }
  if (bad.length) {
    console.error("check:shell-downloads — ОТКАЗ:");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(
    `check:shell-downloads — маршрутов, отдающих файл, ${routes.length} (${routes.join(", ")}), найдено сканом; файлов со ссылкой на скачивание ${referencing.length}, ` +
      `каждая закрыта признаком оболочки на сервере. Контроль — --plant; живая — --base=.`,
  );
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) main().then((c) => (process.exitCode = c)).catch((e) => { console.error(e); process.exitCode = 1; });
