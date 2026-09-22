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
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { storedDateTime } from "../../scripts/stored-datetime.mjs";

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BEFORE = arg("before"), AFTER = arg("after"), DB = path.resolve(arg("db"));
const SECRET = process.env.SESSION_SECRET;
if (!BEFORE || !AFTER || !DB || !SECRET) {
  console.error("нужны --before, --after, --db и SESSION_SECRET в окружении");
  process.exit(1);
}

const SENTRY = [/<meta name="sentry-trace" content="[^"]*"\/?>/g, /<meta name="baggage" content="[^"]*"\/?>/g];
const SPLIT = /\\n"\]\)<\/script><script>self\.__next_f\.push\(\[1,"/g;

/**
 * ТРЕТИЙ И ЧЕТВЁРТЫЙ ИСТОЧНИКИ ШУМА — ОНИ ЖЕ ЕДИНСТВЕННЫЕ, ЧЕМ ДВЕ СБОРКИ
 * ОТЛИЧАЮТСЯ НЕИЗБЕЖНО.
 *
 * Первый съём 7.222 дал ПОЛ ШУМА 0 из 24 (одна сборка, два съёма —
 * совпали знак в знак) и при этом 21 расхождение из 24 между сборками —
 * ПРИ РАВНОЙ ДО БАЙТА ДЛИНЕ у каждой страницы. Посимвольный разбор назвал
 * оба места:
 *
 *   1. `buildId` — случайная строка, своя у каждой сборки. В HTML он
 *      стоит и в путях, и в полезной нагрузке потока (`\"b\":\"…\"`).
 *   2. хеш содержимого в именах чанков
 *      (`/_next/static/chunks/7101-178334f6b00947c0.js`): код изменился,
 *      значит хеш обязан измениться — иначе сборка была бы неверной.
 *
 * Оба снимаются. Это НЕ ослабляет сравнение: длина у обеих страниц
 * совпадала и до снятия, а любое настоящее изменение разметки или текста
 * меняет длину или сами знаки, а не только шестнадцатеричный хвост имени
 * файла. Имя чанка при этом сохраняется — подменится только хеш, — так
 * что исчезнувший или добавленный чанк расхождением останется.
 */
const CHUNK_HASH = /(\/_next\/static\/chunks\/[A-Za-z0-9_.\-[\]()@]+?)-[0-9a-f]{16,}\.js/g;
const CHUNK_HASH_IN_PAYLOAD = /(static\/chunks\/[A-Za-z0-9_.\-[\]()@]+?)-[0-9a-f]{16,}\.js/g;
const norm = (html, buildId) => {
  let out = SENTRY.reduce((h, re) => h.replace(re, ""), html).replace(SPLIT, "\\n");
  out = out.replace(CHUNK_HASH, "$1-ХЕШ.js").replace(CHUNK_HASH_IN_PAYLOAD, "$1-ХЕШ.js");
  if (buildId) out = out.split(buildId).join("BUILD_ID");
  return out;
};

/**
 * ПЯТЫЙ ИСТОЧНИК РАЗЛИЧИЙ — НОМЕРА МОДУЛЕЙ, И ЕГО НЕЛЬЗЯ ПРОСТО СТЕРЕТЬ.
 *
 * После снятия `buildId` и хешей чанков остались ДВЕ страницы из 24, и они
 * повторились в двух независимых прогонах знак в знак — то есть это не шум.
 * Посимвольный разбор назвал место: в потоковой нагрузке React стоит
 * ссылочный список клиентских модулей (`26:I[4901,["8500","static/chunks/…
 * ",…],"default"]`), и правка кода перенумеровывает модули webpack и
 * переставляет их чанки. В «до» под номером 26 оказался модуль страницы, в
 * «после» — модуль раскладки: тот же набор, другая нумерация.
 *
 * Стереть номера и объявить совпадение было бы подгонкой. Поэтому
 * сравниваются ДВА разных предмета, и оба печатаются:
 *
 *   1. ВИДИМАЯ РАЗМЕТКА — HTML без блоков `self.__next_f.push`. Это то,
 *      что видит читатель и что читает поисковик. Здесь обязан быть ноль.
 *   2. ПОЛНАЯ нагрузка — со ссылочным списком модулей. Здесь расхождение
 *      ожидаемо ровно там, где менялся код, и оно называется поимённо.
 */
const FLIGHT = /<script>self\.__next_f\.push\([\s\S]*?\)<\/script>/g;
const visibleOnly = (html) => html.replace(FLIGHT, "");

const sqlite = (sql) => execFileSync("sqlite3", [DB, sql], { encoding: "utf8" }).trim();

/**
 * Три роли — настоящими строками в базе, а не подменой функции.
 *
 * Колонки и формат дат взяты из САМОЙ базы, а не из памяти: у `User` нет
 * `updatedAt` вовсе, а `DATETIME` здесь лежит ТЕКСТОМ вида
 * `2026-09-22T00:36:53.957+00:00` — Prisma поверх libSQL пишет так, и
 * строка другого вида сравнилась бы не с тем (правило `check:raw-datetime`).
 */
function ensureRoles() {
  // Формат даты — через общий помощник, а не своей строкой: `toISOString()`
  // даёт `…000Z`, а Prisma пишет `…000+00:00`, и два формата в одной
  // колонке ломают СРАВНЕНИЕ в SQL (долг 91). Держит `check:raw-datetime`,
  // и он же поймал здесь ровно эту самодельную запись.
  const now = storedDateTime(new Date());
  const far = storedDateTime(new Date(Date.now() + 365 * 24 * 3600 * 1000));
  const rows = [
    { id: "parity-free", email: "parity-free@example.com" },
    { id: "parity-standard", email: "parity-standard@example.com" },
    { id: "parity-premium", email: "parity-premium@example.com" },
  ];
  sqlite(`DELETE FROM Subscription WHERE userId LIKE 'parity-%';`);
  sqlite(`DELETE FROM User WHERE id LIKE 'parity-%';`);
  for (const row of rows) {
    sqlite(
      `INSERT INTO User (id,email,name,avatarId,role,sessionVersion,createdAt,timezone,publicProfileEnabled)
       VALUES ('${row.id}','${row.email}','Parity','matryoshka_calm','student',0,'${now}','America/Tijuana',0);`,
    );
  }
  sqlite(
    `INSERT INTO Subscription (id,userId,plan,status,currentPeriodEnd,provider,createdAt,updatedAt)
     VALUES ('parity-sub-standard','parity-standard','monthly','active','${far}','stripe','${now}','${now}');`,
  );
  sqlite(
    `INSERT INTO Subscription (id,userId,plan,status,currentPeriodEnd,provider,createdAt,updatedAt)
     VALUES ('parity-sub-premium','parity-premium','lifetime','active','${far}','stripe','${now}','${now}');`,
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
  const buildId = readFileSync(path.join(nextDir, "BUILD_ID"), "utf8").trim();
  const child = start(nextDir, port);
  try {
    if (!(await waitUp(port))) throw new Error("сервер не поднялся");
    const out = new Map();
    for (const { role, cookie } of roles) {
      for (const p of [...targets.pages, targets.sitemap]) {
        const headers = cookie ? { cookie } : {};
        const r = await fetch(`http://127.0.0.1:${port}${p}`, { headers, redirect: "manual" });
        out.set(`${role} ${p}`, { status: r.status, html: norm(await r.text(), buildId) });
      }
    }
    return out;
  } finally {
    child.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 1200));
  }
}

function diffOf(a, b, pick = (entry) => entry.html) {
  const keys = [...new Set([...a.keys(), ...b.keys()])];
  if (keys.length === 0) throw new Error("обе выборки пусты — сравнивать нечего");
  const differing = keys.filter((k) => {
    const x = a.get(k), y = b.get(k);
    return !x || !y || x.status !== y.status || pick(x) !== pick(y);
  });
  return { checked: keys.length, differing };
}

const visible = (entry) => visibleOnly(entry.html);

const roles = ensureRoles();
const targets = urls();
console.log(`страниц ${targets.pages.length + 1} × ролей ${roles.length} = ${(targets.pages.length + 1) * roles.length} съёмов на сборку`);

const beforeA = await snapshot(BEFORE, 3151, roles, targets);
const beforeB = await snapshot(BEFORE, 3152, roles, targets);
const floor = diffOf(beforeA, beforeB);
console.log(`ПОЛ ШУМА (одна и та же сборка «до», два съёма): расходятся ${floor.differing.length} из ${floor.checked}`);
for (const k of floor.differing) console.log(`   шум: ${k}`);

const floorVisible = diffOf(beforeA, beforeB, visible);
console.log(`ПОЛ ШУМА по ВИДИМОЙ РАЗМЕТКЕ: расходятся ${floorVisible.differing.length} из ${floorVisible.checked}`);

const after = await snapshot(AFTER, 3153, roles, targets);

const realVisible = diffOf(beforeA, after, visible);
console.log(`ДО против ПОСЛЕ — ВИДИМАЯ РАЗМЕТКА: расходятся ${realVisible.differing.length} из ${realVisible.checked}`);
for (const k of realVisible.differing) {
  const x = beforeA.get(k), y = after.get(k);
  console.log(`   ${k}: статус ${x?.status}→${y?.status}, длина ${visibleOnly(x?.html ?? "").length}→${visibleOnly(y?.html ?? "").length}`);
}

const real = diffOf(beforeA, after);
console.log(`ДО против ПОСЛЕ — ПОЛНАЯ нагрузка (со ссылочным списком модулей): расходятся ${real.differing.length} из ${real.checked}`);
for (const k of real.differing) {
  const x = beforeA.get(k), y = after.get(k);
  console.log(`   ${k}: статус ${x?.status}→${y?.status}, длина ${x?.html.length}→${y?.html.length}`);
}

// Сравнение на двух пустых выборках обязано падать — правило проекта.
writeFileSync(
  arg("out", "/dev/null"),
  JSON.stringify(
    {
      floor: floor.differing,
      floorVisible: floorVisible.differing,
      visible: realVisible.differing,
      payload: real.differing,
      checked: real.checked,
    },
    null,
    2,
  ),
);
// Вердикт даёт ВИДИМАЯ разметка: её расхождение сверх пола шума — регрессия.
process.exit(realVisible.differing.length > floorVisible.differing.length ? 1 : 0);
