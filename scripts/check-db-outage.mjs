/**
 * ДОЛГ 295 (заход 7.304): ЧТО ВИДИТ ГОСТЬ НА ПУБЛИЧНЫХ СТРАНИЦАХ, КОГДА БАЗА ЛЕЖИТ.
 *
 * Перепись 7.222 (`scripts/census-page-reads.ts`) читает ИСХОДНИК и видит
 * только чтения, написанные прямо в `page.tsx`. Главная, уроки, медиа,
 * словарь читают базу через модули `src/lib/**` и в ней не появлялись
 * вовсе — ровно те страницы, куда ходит больше всего людей. Этот прибор
 * меряет ИСХОД, а не текст: поднимает собранный сайт (`next start`) с
 * базой, которую невозможно открыть (`DATABASE_URL=file:` в несуществующий
 * каталог — любое чтение отвечает отказом, как Turso при аварии квоты
 * 11.09.2026), обходит каждую публичную страницу гостем и сортирует ответ:
 *
 *   живая      — 200, есть `<h1>`, нет текста границы ошибок;
 *   граница    — понятная страница ошибки сайта (`[lang]/error.tsx`:
 *                шапка на месте, «Algo salió mal», кнопка повтора);
 *   404        — «не найдено» сайта (законно для страницы, чьё содержимое
 *                целиком в базе: рассказ, термин, пазл);
 *   переход    — 3xx (экзамен гостю уводит на вход — как и при живой базе);
 *   УПАЛА      — 5xx без границы, `global-error` (без шапки и языка) или
 *                пустой ответ: человек остаётся без сайта.
 *
 * Отказ в серверном компоненте Next отдаёт 500 с пустой оболочкой
 * `__next_error__`, а границу рисует уже браузер. Поэтому такой ответ
 * досматривается в Chromium: шапка и «Algo salió mal» на экране —
 * «граница», иначе — «УПАЛА». Боту без JavaScript такая страница пуста,
 * и это тоже записано в итог отдельным числом.
 *
 * ПРАВИЛО (решение 7.304). Страница из `MUST_LIVE` обязана быть ЖИВОЙ —
 * её содержимое лежит в коде (уроки, медиа, словарь, лендинги), база ей
 * только помогает. Остальным разрешена граница или 404, но не «УПАЛА».
 *
 * 7.305: девять игровых лендингов (`GAME_LANDINGS`) — тоже в `MUST_LIVE`:
 * текст и ссылки из кода, пазл из базы. Живой мало: каждый обязан показать
 * заметку `data-testid="puzzle-unavailable"` на месте пазла — это
 * доказательство, что сбой ДОШЁЛ до страницы, а не что пазл взялся
 * откуда-то ещё. Сами игры (`/word-games/...`), рассказы и термины — по-
 * прежнему граница с шапкой.
 *
 *   node scripts/check-db-outage.mjs           # нужен готовый `next build`
 *   node scripts/check-db-outage.mjs --plant   # позитивный контроль судьи
 *
 * Без строки в package.json: зовётся из `scripts/verify-rendered.mjs`
 * (`npm run verify` и шаг CI «Rendered surface»), сервер — свой, порт 3127.
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const PORT = Number(process.env.RF_OUTAGE_PORT ?? 3127);
const BASE = `http://localhost:${PORT}`;
/** Каталога нет и быть не может — libsql отвечает SQLITE_CANTOPEN на ЛЮБОЕ чтение. */
const BROKEN_DB = "file:/rf-db-outage-probe-no-such-dir/outage.db";

/** Маршруты, которые гостю не нужны или уводят на вход: проверяются не здесь. */
const PRIVATE = [/^\/admin(\/|$)/, /^\/account$/, /^\/profile$/, /^\/groups(\/|$)/, /^\/u\//, /^\/confirm-delete-account$/, /^\/styleguide$/, /^\/video-lesson-demo$/, /^\/reset-password$/];

/** Образцы для динамических маршрутов. Новый публичный динамический маршрут
 *  без образца роняет прибор — иначе он молча вышел бы из обхода. */
const SAMPLES = {
  "/courses/[level]": ["/courses/a1"],
  "/courses/[level]/[lesson]": ["/courses/a1/1"],
  "/courses/[level]/exam/[examSlug]": ["/courses/a1/exam/a1-exam-1"],
  "/glossary/[slug]": ["/glossary/acusativo-animado-inanimado"],
  "/media/[id]": ["/media/song-katyusha"],
  "/stories/[id]": ["/stories/cmsxtq13w000cqwnc466c87es"],
  "/vocabulary/[categoria]": ["/vocabulary/comida"],
  "/word-games/[type]/[level]/[sequence]": ["/word-games/CROSSWORD/A1/1"],
};

/** Обязаны остаться ЖИВЫМИ при лежащей базе: их содержимое — в коде. */
export const MUST_LIVE = [
  "/es", "/ru",
  "/es/courses", "/es/courses/a1", "/es/courses/a1/1", "/ru/courses/a1", "/ru/courses/a1/1",
  "/es/media", "/es/media/song-katyusha",
  "/es/vocabulary", "/es/vocabulary/comida", "/ru/vocabulary",
  "/es/gramatica", "/es/alfabeto-cirilico",
  "/es/pricing", "/es/login", "/es/register", "/es/download",
];

/** 7.305: игровые лендинги — живые при лежащей базе, с заметкой вместо пазла. */
export const GAME_LANDINGS = [
  "/es/sopa-de-letras-ruso", "/es/crucigramas-ruso-principiantes", "/es/juegos-para-aprender-ruso",
  "/es/sopa-de-letras-ruso-comida", "/es/sopa-de-letras-ruso-familia", "/es/sopa-de-letras-ruso-ropa",
  "/es/sopa-de-letras-ruso-ciudad", "/es/sopa-de-letras-ruso-clima", "/es/sopa-de-letras-ruso-compras",
];
MUST_LIVE.push(...GAME_LANDINGS);
const OUTAGE_NOTE = /data-testid="puzzle-unavailable"/;

function publicRoutes() {
  const root = join(process.cwd(), "src", "app", "[lang]");
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "page.tsx") {
        const route = ("/" + relative(root, dir).split(sep).join("/")).replace(/\/$/, "") || "";
        out.push(route);
      }
    }
  };
  walk(root);
  return out.filter((r) => !PRIVATE.some((re) => re.test(r)));
}

export function targetPaths(routes = publicRoutes()) {
  const missing = [];
  const paths = [];
  for (const route of routes) {
    if (route.includes("[")) {
      if (!SAMPLES[route]) missing.push(route);
      else paths.push(...SAMPLES[route]);
    } else paths.push(route);
  }
  const all = new Set();
  for (const p of paths) for (const lang of ["es", "ru"]) all.add(`/${lang}${p}`);
  for (const p of MUST_LIVE) all.add(p);
  all.add("/sitemap.xml");
  return { paths: [...all].sort(), missing };
}

const BOUNDARY = /Algo salió mal|Что-то пошло не так/;
const GLOBAL_ERROR = /Something went wrong/;

/** Судья. Отдельной функцией — чтобы позитивный контроль проверял ЕГО, а не копию. */
export function judge({ status, body, path }) {
  if (status >= 300 && status < 400) return "переход";
  if (path.endsWith(".xml")) {
    if (status === 200 && body.includes("<urlset")) return "живая";
    return "УПАЛА";
  }
  const hasHeader = /<header\b/i.test(body) || /<nav\b/i.test(body);
  if (status >= 500 && /id="__next_error__"/.test(body)) return "досмотр";
  if (status >= 500 && !BOUNDARY.test(body)) return "УПАЛА";
  if (GLOBAL_ERROR.test(body) && !hasHeader) return "УПАЛА";
  if (!body.trim()) return "УПАЛА";
  if (BOUNDARY.test(visibleText(body))) return hasHeader ? "граница" : "УПАЛА";
  if (status === 404) return "404";
  if (status === 200 && /<h1\b/i.test(body)) return "живая";
  return "УПАЛА";
}

/** Текст границы ищется в разметке без скриптов: словарь интерфейса и
 *  RSC-поток могут нести эти слова, не показывая их. */
function visibleText(html) {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<template\b[\s\S]*?<\/template>/gi, " ");
}

export function verdict(results) {
  const dead = results.filter((r) => r.kind === "УПАЛА");
  const notLive = results.filter((r) => MUST_LIVE.includes(r.path) && r.kind !== "живая");
  // Лендинг живой, но без заметки — сбой до него не дошёл: судить нечего.
  const noNote = results.filter(
    (r) => GAME_LANDINGS.includes(r.path) && r.kind === "живая" && !OUTAGE_NOTE.test(r.body ?? ""),
  );
  return { dead, notLive, noNote, ok: dead.length === 0 && notLive.length === 0 && noNote.length === 0 };
}

async function fetchPage(path) {
  const started = Date.now();
  try {
    const res = await fetch(BASE + path, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
    const body = await res.text();
    return { path, status: res.status, body, ms: Date.now() - started };
  } catch (error) {
    return { path, status: 0, body: "", ms: Date.now() - started, error: String(error) };
  }
}

/** Досмотр 500 с оболочкой `__next_error__` настоящим браузером. */
async function browserLook(paths) {
  const out = new Map();
  if (paths.length === 0) return out;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const path of paths) {
      await page.goto(BASE + path, { waitUntil: "load", timeout: 30_000 }).catch(() => {});
      const shown = await page
        .waitForFunction((re) => new RegExp(re).test(document.body?.innerText ?? ""), BOUNDARY.source, { timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
      const header = (await page.locator("header").count()) > 0;
      out.set(path, shown && header ? "граница" : "УПАЛА");
    }
  } finally {
    await browser.close();
  }
  return out;
}

async function waitUp(child, log) {
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`next start завершился (${child.exitCode}):\n${log().slice(-800)}`);
    try {
      await fetch(`${BASE}/robots.txt`, { signal: AbortSignal.timeout(2000) });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`next start не ответил за 60 с:\n${log().slice(-800)}`);
}

async function portBusy() {
  try {
    await fetch(`${BASE}/robots.txt`, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

function plant() {
  // ПОЗИТИВНЫЙ КОНТРОЛЬ СУДЬИ: каждая форма «упало» обязана быть пойманной,
  // каждая законная — нет. Судья, который на всё отвечает «живая», зелёный
  // прогон не отличил бы от слепого.
  const header = "<header>RusoFácil</header>";
  const cases = [
    { want: "живая", r: { path: "/es", status: 200, body: `${header}<h1>Aprende ruso</h1>` } },
    { want: "граница", r: { path: "/es/stories/x", status: 500, body: `${header}<h1>Algo salió mal · Что-то пошло не так</h1>` } },
    { want: "404", r: { path: "/es/glossary/x", status: 404, body: `${header}<h1>Página no encontrada</h1>` } },
    { want: "УПАЛА", r: { path: "/es", status: 500, body: "Internal Server Error" } },
    { want: "УПАЛА", r: { path: "/es", status: 500, body: "<html><h2>Something went wrong</h2></html>" } },
    { want: "УПАЛА", r: { path: "/es", status: 0, body: "" } },
    { want: "УПАЛА", r: { path: "/es", status: 200, body: "<html><body>Algo salió mal</body></html>" } },
    { want: "УПАЛА", r: { path: "/sitemap.xml", status: 500, body: "" } },
    { want: "живая", r: { path: "/es", status: 200, body: `${header}<h1>Hola</h1><script>"Algo salió mal"</script>` } },
    { want: "переход", r: { path: "/es/courses/a1/exam/a1-exam-1", status: 307, body: "" } },
    { want: "досмотр", r: { path: "/es/courses/a1/1", status: 500, body: '<html id="__next_error__"><body></body></html>' } },
  ];
  let ok = 0;
  for (const { want, r } of cases) {
    const got = judge(r);
    const pass = got === want;
    if (pass) ok++;
    console.log(`  ${pass ? "СОШЛОСЬ" : "НЕ СОШЛОСЬ"}  ${r.status} ${r.path} → ${got} (ждали ${want})`);
  }
  // Правило MUST_LIVE: граница на странице из списка — красное.
  const v = verdict([{ path: "/es", kind: "граница" }, { path: "/es/stories/x", kind: "граница" }]);
  const ruleOk = !v.ok && v.notLive.length === 1 && v.dead.length === 0;
  console.log(`  ${ruleOk ? "СОШЛОСЬ" : "НЕ СОШЛОСЬ"}  граница на главной → красное; граница на рассказе → допустимо`);
  // 7.305: лендинг игры — граница красная; живой без заметки — красный; живой с заметкой — зелёный.
  const note = '<div data-testid="puzzle-unavailable" role="status">';
  const landing = "/es/sopa-de-letras-ruso-comida";
  const vBoundary = verdict([{ path: landing, kind: "граница", body: "" }]);
  const vNoNote = verdict([{ path: landing, kind: "живая", body: "<h1>Sopa</h1>" }]);
  const vNote = verdict([{ path: landing, kind: "живая", body: `<h1>Sopa</h1>${note}` }]);
  const landingOk =
    !vBoundary.ok && vBoundary.notLive.length === 1 && !vNoNote.ok && vNoNote.noNote.length === 1 && vNote.ok;
  console.log(`  ${landingOk ? "СОШЛОСЬ" : "НЕ СОШЛОСЬ"}  лендинг игры: граница → красное; живой без заметки → красное; с заметкой → зелёное`);
  const { missing } = targetPaths(["/stories/[id]", "/new/[thing]"]);
  const missOk = missing.length === 1 && missing[0] === "/new/[thing]";
  console.log(`  ${missOk ? "СОШЛОСЬ" : "НЕ СОШЛОСЬ"}  динамический маршрут без образца → назван`);
  const total = cases.length + 3;
  const got = ok + (ruleOk ? 1 : 0) + (missOk ? 1 : 0) + (landingOk ? 1 : 0);
  console.log(`check:db-outage --plant: ${got} из ${total}`);
  process.exit(got === total ? 0 : 1);
}

async function main() {
  if (process.argv.includes("--plant")) return plant();
  const { paths, missing } = targetPaths();
  if (missing.length) {
    console.error(`✗ публичный динамический маршрут без образца в SAMPLES: ${missing.join(", ")}`);
    process.exit(1);
  }
  if (!existsSync(join(process.cwd(), ".next", "BUILD_ID"))) {
    console.error("✗ нет сборки (.next/BUILD_ID) — сначала npm run build");
    process.exit(1);
  }
  if (await portBusy()) {
    console.error(`✗ на ${BASE} уже кто-то отвечает — это был бы чужой сервер, не наш`);
    process.exit(1);
  }
  const env = { ...process.env, DATABASE_URL: BROKEN_DB, PORT: String(PORT) };
  delete env.TURSO_DATABASE_URL;
  delete env.TURSO_AUTH_TOKEN;
  delete env.VERCEL;
  delete env.VERCEL_ENV;
  const nextBin = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  let serverLog = "";
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], { env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (d) => (serverLog += d));
  child.stderr.on("data", (d) => (serverLog += d));
  const stop = () => {
    try { process.kill(-child.pid, "SIGTERM"); } catch {}
    setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch {} }, 1500).unref();
  };
  process.on("exit", stop);
  let failed = false;
  try {
    await waitUp(child, () => serverLog);
    // Сначала доказать, что база действительно лежит: иначе «всё живое»
    // значило бы «сбоя не было», а не «сбой пережит».
    const health = await fetchPage("/api/health");
    if (health.status === 200 && /"db":"up"/.test(health.body)) {
      console.error(`✗ подсадка не сработала: /api/health говорит, что база жива — ${health.body.slice(0, 200)}`);
      process.exit(1);
    }
    console.log(`check:db-outage — база подменена на неоткрываемую; /api/health ${health.status} ${health.body.slice(0, 80)}`);
    const results = [];
    for (const path of paths) {
      const r = await fetchPage(path);
      r.kind = judge(r);
      results.push(r);
    }
    const looked = await browserLook(results.filter((r) => r.kind === "досмотр").map((r) => r.path));
    for (const r of results) {
      if (r.kind === "досмотр") {
        r.kind = looked.get(r.path) ?? "УПАЛА";
        r.blankForBots = true;
      }
      const mark = MUST_LIVE.includes(r.path) ? "*" : " ";
      const note = r.blankForBots ? " (500, граница только в браузере)" : "";
      console.log(`  ${r.kind.padEnd(8)}${mark} ${String(r.status).padStart(3)} ${r.path}${note}${r.error ? ` (${r.error})` : ""}`);
    }
    const v = verdict(results);
    const count = (k) => results.filter((r) => r.kind === k).length;
    console.log(
      `ИТОГ: страниц ${results.length}; живая ${count("живая")}, граница ${count("граница")} (из них 500 для бота ${results.filter((r) => r.blankForBots).length}), 404 ${count("404")}, переход ${count("переход")}, УПАЛА ${count("УПАЛА")}; ` +
        `из ${MUST_LIVE.length} обязательных (*) не живы ${v.notLive.length}; ` +
      `игровых лендингов живы ${results.filter((r) => GAME_LANDINGS.includes(r.path) && r.kind === "живая").length} из ${GAME_LANDINGS.length}`,
    );
    // Позитивный контроль на живом сервере: сбой должен ДОЙТИ хотя бы до одной
    // страницы (рассказ — содержимое целиком в базе). Если нигде нет ни
    // границы, ни 404, подсадка ничего не проверила.
    if (count("граница") + count("404") === 0) {
      console.error("✗ сбой базы не дошёл ни до одной страницы — подсадка слепа");
      failed = true;
    }
    if (!v.ok) {
      for (const r of v.dead) console.error(`✗ УПАЛА: ${r.path} (${r.status})`);
      for (const r of v.notLive) console.error(`✗ обязана жить при лежащей базе, а показала «${r.kind}»: ${r.path}`);
      for (const r of v.noNote) console.error(`✗ лендинг живой, но без заметки «пазл недоступен» — сбой до него не дошёл: ${r.path}`);
      failed = true;
    }
  } catch (error) {
    console.error(String(error));
    failed = true;
  } finally {
    stop();
  }
  process.exit(failed ? 1 : 0);
}

// Только когда файл — точка входа: импорт (тесты, перепись) не должен поднимать сервер.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) await main();
