/**
 * ДВЕ НАСТОЯЩИЕ СБОРКИ, ОДНА БАЗА: ПОБАЙТОВОЕ СЛИЧЕНИЕ HTML.
 *
 * Заход 7.222. Правило захода: видимое поведение не меняется, и на
 * главной, странице рассказа, термине, словаре и `/sitemap.xml` HTML до и
 * после совпадает знак в знак — для гостя, standard и Premium.
 *
 * ПОЛ ШУМА СНИМАЕТСЯ ПЕРВЫМ, И БЕЗ НЕГО ВЫВОДОВ НЕТ. У сырого HTML два
 * замеренных источника непостоянства (7.173, 7.176):
 *   1. теги Sentry `sentry-trace` и `baggage` в `<head>` — новые у
 *      каждого запроса и разной длины;
 *   2. ГРАНИЦЫ ПОТОКОВЫХ КУСКОВ React: одна и та же нагрузка приходит то
 *      одним `self.__next_f.push`, то тремя. Куски склеиваются обратно.
 * Сверх снятия шума ОДНА И ТА ЖЕ сборка снимается ДВАЖДЫ: её расхождение
 * с самой собой — пол, ниже которого «0 различий» ничего не значит, а
 * «N различий» может не значить ничего.
 *
 * Роли: гость, standard и Premium — настоящими cookie сессии, подписанными
 * `SESSION_SECRET`, и настоящими строками `Subscription` в базе.
 *
 *   node prisma/run-7222/html-parity.mjs --before=<.next> --after=<.next> --db=<файл.db>
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BEFORE = arg("before"), AFTER = arg("after"), DB = path.resolve(arg("db"));
const SECRET = process.env.SESSION_SECRET;
if (!BEFORE || !AFTER || !DB || !SECRET) {
  console.error("нужны --before, --after, --db и SESSION_SECRET в окружении");
  process.exit(1);
}

const SENTRY = [/<meta name="sentry-trace" content="[^"]*"\/?>/g, /<meta name="baggage" content="[^"]*"\/?>/g];
const SPLIT = /\\n"\]\)<\/script><script>self\.__next_f\.push\(\[1,"/g;
const norm = (html) => SENTRY.reduce((h, re) => h.replace(re, ""), html).replace(SPLIT, "\\n");

const sqlite = (sql) => execFileSync("sqlite3", [DB, sql], { encoding: "utf8" }).trim();

/** Три роли — настоящими строками в базе, а не подменой функции. */
function ensureRoles() {
  const now = new Date();
  const far = new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString();
  const rows = [
    { id: "parity-free", email: "parity-free@example.com" },
    { id: "parity-standard", email: "parity-standard@example.com" },
    { id: "parity-premium", email: "parity-premium@example.com" },
  ];
  for (const row of rows) {
    sqlite(
      `INSERT OR REPLACE INTO User (id,email,name,avatarId,role,sessionVersion,createdAt,updatedAt,timezone)
       VALUES ('${row.id}','${row.email}','Parity','matryoshka_calm','student',0,'${now.toISOString()}','${now.toISOString()}','America/Tijuana');`,
    );
  }
  sqlite(`DELETE FROM Subscription WHERE userId LIKE 'parity-%';`);
  sqlite(
    `INSERT INTO Subscription (id,userId,plan,status,currentPeriodEnd,createdAt,updatedAt)
     VALUES ('parity-sub-standard','parity-standard','monthly','active','${far}','${now.toISOString()}','${now.toISOString()}');`,
  );
  sqlite(
    `INSERT INTO Subscription (id,userId,plan,status,currentPeriodEnd,createdAt,updatedAt)
     VALUES ('parity-sub-premium','parity-premium','lifetime','active','${far}','${now.toISOString()}','${now.toISOString()}');`,
  );
  const sign = (id) => `session=${id}.0.${createHmac("sha256", SECRET).update(`${id}.0`).digest("hex")}`;
  return [
    { role: "гость", cookie: null },
    { role: "standard", cookie: sign("parity-standard") },
    { role: "premium", cookie: sign("parity-premium") },
  ];
}

function urls() {
  const story = sqlite(`SELECT id FROM Story ORDER BY createdAt LIMIT 1;`);
  const term = sqlite(`SELECT slug FROM GlossaryTerm ORDER BY slug LIMIT 1;`);
  const category = sqlite(`SELECT category FROM FlashcardCard ORDER BY createdAt LIMIT 1;`);
  const pages = ["/es", "/ru", "/es/stories", "/es/glossary", `/es/stories/${story}`, `/es/glossary/${term}`];
  if (category) pages.push(`/es/vocabulary/${category}`);
  return { pages, sitemap: "/sitemap.xml" };
}

function start(nextDir, port) {
  if (existsSync(".next")) rmSync(".next", { recursive: true, force: true });
  cpSync(nextDir, ".next", { recursive: true });
  const env = { ...process.env, DATABASE_URL: `file:${DB}`, NODE_ENV: "production" };
  delete env.TURSO_DATABASE_URL;
  delete env.TURSO_AUTH_TOKEN;
  delete env.MEASURE_DB_READS;
  const child = spawn(`${process.cwd()}/node_modules/.bin/next`, ["start", "-p", String(port)], { env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  return child;
}

async function waitUp(port) {
  for (let i = 0; i < 180; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/es`);
      if (r.status < 500) return true;
    } catch { /* ещё не поднялся */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function snapshot(nextDir, port, roles, targets) {
  const child = start(nextDir, port);
  try {
    if (!(await waitUp(port))) throw new Error("сервер не поднялся");
    const out = new Map();
    for (const { role, cookie } of roles) {
      for (const p of [...targets.pages, targets.sitemap]) {
        const headers = cookie ? { cookie } : {};
        const r = await fetch(`http://127.0.0.1:${port}${p}`, { headers, redirect: "manual" });
        out.set(`${role} ${p}`, { status: r.status, html: norm(await r.text()) });
      }
    }
    return out;
  } finally {
    child.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 1200));
  }
}

function diffOf(a, b) {
  const keys = [...new Set([...a.keys(), ...b.keys()])];
  if (keys.length === 0) throw new Error("обе выборки пусты — сравнивать нечего");
  const differing = keys.filter((k) => {
    const x = a.get(k), y = b.get(k);
    return !x || !y || x.status !== y.status || x.html !== y.html;
  });
  return { checked: keys.length, differing };
}

const roles = ensureRoles();
const targets = urls();
console.log(`страниц ${targets.pages.length + 1} × ролей ${roles.length} = ${(targets.pages.length + 1) * roles.length} съёмов на сборку`);

const beforeA = await snapshot(BEFORE, 3151, roles, targets);
const beforeB = await snapshot(BEFORE, 3152, roles, targets);
const floor = diffOf(beforeA, beforeB);
console.log(`ПОЛ ШУМА (одна и та же сборка «до», два съёма): расходятся ${floor.differing.length} из ${floor.checked}`);
for (const k of floor.differing) console.log(`   шум: ${k}`);

const after = await snapshot(AFTER, 3153, roles, targets);
const real = diffOf(beforeA, after);
console.log(`ДО против ПОСЛЕ: расходятся ${real.differing.length} из ${real.checked}`);
for (const k of real.differing) {
  const x = beforeA.get(k), y = after.get(k);
  console.log(`   ${k}: статус ${x?.status}→${y?.status}, длина ${x?.html.length}→${y?.html.length}`);
}

// Сравнение на двух пустых выборках обязано падать — правило проекта.
writeFileSync(
  arg("out", "/dev/null"),
  JSON.stringify({ floor: floor.differing, differing: real.differing, checked: real.checked }, null, 2),
);
process.exit(real.differing.length > floor.differing.length ? 1 : 0);
