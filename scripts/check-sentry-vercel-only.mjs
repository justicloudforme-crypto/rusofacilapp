// SENTRY СЕРВЕРА ШЛЁТ СОБЫТИЯ ТОЛЬКО С НАСТОЯЩЕГО VERCEL (ДОЛГ 416, ЗАХОД 7.301).
//
// Повод. 17.11.2026 замер кеша захода 7.286 запустил сайт на Маке с
// `VERCEL_ENV=preview`, поставленной руками в командной строке. Ворота
// сервера держались на этой одной переменной: процесс назвал себя
// развёртыванием, взял боевой адрес Sentry из `.env` и прислал
// `StripeEnvWrongShape` (JAVASCRIPT-NEXTJS-1F) под `vercel-preview`.
// Теперь ворота — `mayReportServerSentry` (`src/lib/deploy-environment.ts`):
// `VERCEL_ENV` + `VERCEL=1` + ОС процесса Linux (ОС — не переменная).
//
// 7.302: ТЕМ ЖЕ ПРАВИЛОМ ОТКРЫВАЕТСЯ КЕШ UPSTASH. Правило вынесено в общую
// `isRealVercelServer` (там же); `mayReportServerSentry` и `src/lib/redis.ts`
// зовут её, а не держат свою копию. До 7.302 кеш судил по одной
// `VERCEL_ENV`, и ручная переменная на Маке открывала боевой кеш из `.env`.
// Сторож теперь краснеет и на кеше: исходник `redis.ts`, подсадки, и в живом
// запуске адрес Upstash смотрит на тот же приёмник — Мак: 0 запросов к
// кешу; Linux с признаками Vercel: запросы есть (кеш на Vercel работает);
// Linux с одной `VERCEL_ENV`: 0.
//
// Сторож проверяет ТРИ слоя.
//
//  1. Исходник (всегда): оба серверных конфига Sentry и отчёт о ключах Stripe
//     при старте открываются ТОЛЬКО через `mayReportServerSentry`; само правило
//     требует и `VERCEL === "1"`, и `=== "linux"`; в `src/` нет краевой среды
//     (там `process.platform` нет, и Sentry молчал бы на проде незаметно).
//
//  2. Живой запуск (`--live`, нужен `npm run build`): настоящий `next start`
//     с `VERCEL=1 VERCEL_ENV=preview` и адресом Sentry, который смотрит на
//     ПРИЁМНИК В ЭТОМ ЖЕ СКРИПТЕ (127.0.0.1) — ни одно событие не уходит в
//     боевой проект. Ключи Stripe в запуске пустые, поэтому сервер на старте
//     обязан попытаться отправить `StripeEnvWrongShape` — ровно то событие,
//     что пришло 17.11. Ожидание зависит от ОС машины:
//       * Linux (раннер CI — та же ОС, что у Vercel): событие ДОЛЖНО прийти —
//         доказательство, что на настоящем Vercel (production и preview)
//         отправка работает как раньше; и контроль — тот же запуск без
//         `VERCEL=1` обязан молчать (одной переменной мало);
//       * macOS: событий 0 — доказательство, что Мак не шлёт ни при каких
//         переменных.
//     Позитивный контроль приёмника: сам SDK Sentry с тем же адресом шлёт
//     одно сообщение, и приёмник обязан его увидеть — иначе «0 событий»
//     ничего не доказывает (PROGRESS.md 4.1).
//
//  3. Живой прод (`--prod`, после каждого выката и раз в сутки, задание
//     «Sentry на проде» в `prod-smoke.yml`): `/es` боевого сайта несёт в
//     `baggage` окружение `vercel-production` и `sentry-public_key` — ключ
//     появляется, только когда серверный SDK включён и получил адрес. Только
//     чтение, в Sentry не уходит ничего.
//
// Все переменные из локальных `.env*` (кроме базы) в запуске обнуляются
// пустой строкой: пустая переменная окружения перекрывает `.env` (замер
// 7.301, `@next/env`), поэтому ни боевой Sentry, ни Upstash, ни Stripe
// запуску недоступны.
//
//   node scripts/check-sentry-vercel-only.mjs           # исходник
//   node scripts/check-sentry-vercel-only.mjs --live    # исходник + живой запуск
//   node scripts/check-sentry-vercel-only.mjs --prod    # живой прод: Sentry включён (только чтение)
//   node scripts/check-sentry-vercel-only.mjs --plant   # позитивный контроль (исходник и разбор прода)
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");
const LIVE = process.argv.includes("--live");
// Только для позитивного контроля на СТАРОМ коде (временный worktree из
// `main`): исходник там заведомо красный, а живой запуск обязан показать
// событие, дошедшее до приёмника, — это и есть воспроизведение 17.11.
const SKIP_SOURCE = process.argv.includes("--skip-source");
const PROD = process.argv.includes("--prod");

function fail(lines) {
  console.error("");
  for (const line of lines) console.error("✗ " + line);
  console.error("");
  process.exit(1);
}

// ── 1. Исходник ──────────────────────────────────────────────────────────

/** Серверный/краевой конфиг: ворота — только новое правило. */
export function checkSentryConfig(name, source) {
  const problems = [];
  if (!/import\s*\{\s*mayReportServerSentry\s*\}\s*from\s*"\.\/src\/lib\/deploy-environment"/.test(source)) {
    problems.push(`${name}: не импортирует mayReportServerSentry из src/lib/deploy-environment`);
  }
  if (!/const\s+isDeployed\s*=\s*mayReportServerSentry\(\s*\)\s*;/.test(source)) {
    problems.push(`${name}: isDeployed не равно mayReportServerSentry()`);
  }
  if (!/dsn:\s*isDeployed\s*\?\s*process\.env\.SENTRY_DSN\s*:\s*""/.test(source) || !/enabled:\s*isDeployed\b/.test(source)) {
    problems.push(`${name}: dsn и enabled не закрыты воротами isDeployed (вне Vercel dsn обязан быть "", не undefined — SDK сам берёт SENTRY_DSN из окружения)`);
  }
  if (/isDeployedEnvironment\s*\(/.test(source)) {
    problems.push(`${name}: ворота снова держатся на одной VERCEL_ENV (isDeployedEnvironment)`);
  }
  return problems;
}

/** Отчёт о ключах Stripe при старте — то самое событие 17.11. */
export function checkInstrumentation(source) {
  const problems = [];
  const report = source.slice(source.indexOf("async function reportMisshapenStripeEnv"));
  if (!report.startsWith("async function reportMisshapenStripeEnv")) {
    return ["src/instrumentation.ts: нет reportMisshapenStripeEnv — сторож не нашёл, что судить"];
  }
  const gate = report.search(/if\s*\(\s*!mayReportServerSentry\(\s*\)\s*\)\s*return\s*;/);
  const capture = report.indexOf("captureException");
  if (gate < 0) problems.push("src/instrumentation.ts: отчёт Stripe не закрыт mayReportServerSentry()");
  else if (capture >= 0 && gate > capture) problems.push("src/instrumentation.ts: ворота стоят ПОСЛЕ captureException");
  if (/isDeployedEnvironment/.test(report)) {
    problems.push("src/instrumentation.ts: отчёт Stripe снова судит по одной VERCEL_ENV");
  }
  return problems;
}

/** Тело экспортируемой функции (до первой `}` в нулевой колонке). */
function fnBody(source, name) {
  const start = source.indexOf(`export function ${name}`);
  if (start < 0) return null;
  return source.slice(start, source.indexOf("\n}\n", start) + 2);
}

/** Само правило: все три признака на месте, и Sentry зовёт общее правило. */
export function checkRule(source) {
  const body = fnBody(source, "isRealVercelServer");
  if (body === null) return ["src/lib/deploy-environment.ts: нет общего правила isRealVercelServer"];
  const problems = [];
  if (!/env\.VERCEL\s*===\s*"1"/.test(body)) problems.push("isRealVercelServer не требует VERCEL === \"1\"");
  if (!/platform\s*===\s*"linux"/.test(body)) problems.push("isRealVercelServer не требует ОС linux");
  if (!/isDeployedEnvironment\(env\)/.test(body)) problems.push("isRealVercelServer не требует VERCEL_ENV");
  if (/\|\|/.test(body)) problems.push("isRealVercelServer содержит «или» — признаки должны требоваться ВСЕ");
  const sentry = fnBody(source, "mayReportServerSentry");
  if (sentry === null) problems.push("src/lib/deploy-environment.ts: нет mayReportServerSentry");
  else if (!/return\s+isRealVercelServer\(\s*env\s*,\s*platform\s*\)\s*;/.test(sentry) || /VERCEL|linux/.test(sentry.replace(/^[^{]*\{/, ""))) {
    problems.push("mayReportServerSentry не сводится к isRealVercelServer(env, platform) — копия правила");
  }
  return problems;
}

/** Кеш Upstash (7.302): клиент создаётся только под общим правилом. */
export function checkRedis(source) {
  const problems = [];
  if (!/import\s*\{\s*isRealVercelServer\s*\}\s*from\s*"\.\/deploy-environment"/.test(source)) {
    problems.push("src/lib/redis.ts: не импортирует isRealVercelServer из ./deploy-environment");
  }
  const gate = source.search(/if\s*\(\s*!isRealVercelServer\(\s*\)\s*\)\s*return\s+null\s*;/);
  const client = source.indexOf("new Redis(");
  if (gate < 0) problems.push("src/lib/redis.ts: клиент Upstash не закрыт `if (!isRealVercelServer()) return null;`");
  else if (client >= 0 && gate > client) problems.push("src/lib/redis.ts: ворота стоят ПОСЛЕ new Redis(");
  if (/isDeployedEnvironment|VERCEL_ENV|getDeployEnvironment/.test(source.replace(/\/\/[^\n]*/g, ""))) {
    problems.push("src/lib/redis.ts: кеш снова судит по одной VERCEL_ENV");
  }
  return problems;
}

/** Краевая среда — там нет process.platform, и Sentry молчал бы на проде. */
const EDGE_RUNTIME = /\bruntime\s*(?:=|:)\s*["']edge["']/;
export function findEdgeRuntime(files) {
  return files.filter(({ text }) => EDGE_RUNTIME.test(text)).map(({ file }) => file);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

function checkSource() {
  const srcFiles = walk("./src").map((file) => ({ file, text: readFileSync(file, "utf8") }));
  if (srcFiles.length < 50) return [`прочитано ${srcFiles.length} файлов src/ — выборка подозрительно мала`];
  return [
    ...checkSentryConfig("sentry.server.config.ts", readFileSync("./sentry.server.config.ts", "utf8")),
    ...checkSentryConfig("sentry.edge.config.ts", readFileSync("./sentry.edge.config.ts", "utf8")),
    ...checkInstrumentation(readFileSync("./src/instrumentation.ts", "utf8")),
    ...checkRule(readFileSync("./src/lib/deploy-environment.ts", "utf8")),
    ...checkRedis(readFileSync("./src/lib/redis.ts", "utf8")),
    ...findEdgeRuntime(srcFiles).map(
      (f) =>
        `${f}: краевая среда (runtime "edge") — там у Vercel нет process.platform, и Sentry этого кода молчал бы. ` +
        "Решить явно: признак Vercel для краевой среды — и только потом снять эту строку сторожа.",
    ),
  ];
}

// ── 2. Живой запуск ──────────────────────────────────────────────────────

const SECRET_ENV_FILES = [".env", ".env.local", ".env.production", ".env.production.local"];
const KEEP = new Set(["DATABASE_URL", "SESSION_SECRET"]);
// Обнуляются, даже если их нет ни в одном .env (раннер CI): пустые ключи
// Stripe и есть то, что заставляет сервер на старте слать событие.
const ALWAYS_BLANK = [
  "STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_MONTHLY", "STRIPE_PRICE_ANNUAL", "STRIPE_PRICE_LIFETIME",
  "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "NEXT_PUBLIC_SENTRY_DSN",
  "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN",
];

/** Имена (только имена) переменных из локальных .env — каждую обнулить. */
function envNamesToBlank() {
  const names = new Set(ALWAYS_BLANK);
  for (const file of SECRET_ENV_FILES) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (m && !KEEP.has(m[1])) names.add(m[1]);
    }
  }
  return [...names];
}

function startReceiver() {
  const envelopes = [];
  const upstash = [];
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (req.method === "POST" && /\/api\/\d+\/envelope\//.test(req.url ?? "")) {
        envelopes.push(Buffer.concat(chunks).toString("utf8"));
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
        return;
      }
      if ((req.url ?? "").startsWith("/upstash")) {
        // Кеш Upstash (7.302): любой запрос сюда — сервер открыл кеш.
        // Ответ — «пусто», как у настоящего REST Upstash на промах.
        upstash.push(`${req.method} ${req.url}`);
        const body = Buffer.concat(chunks).toString("utf8");
        const many = body.trim().startsWith("[[");
        res.writeHead(200, { "content-type": "application/json" });
        res.end(many ? JSON.stringify(JSON.parse(body).map(() => ({ result: null }))) : '{"result":null}');
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, envelopes, upstash, port: server.address().port }));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function freePort() {
  const s = createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const port = s.address().port;
  await new Promise((r) => s.close(r));
  return port;
}

/** Один `next start` в заданном окружении; вернуть, что дошло до приёмника. */
async function bootOnce(label, receiver, extraEnv) {
  const before = receiver.envelopes.length;
  const upstashBefore = receiver.upstash.length;
  const port = await freePort();
  const env = { ...process.env };
  for (const name of envNamesToBlank()) env[name] = "";
  delete env.VERCEL;
  delete env.VERCEL_ENV;
  Object.assign(env, {
    SENTRY_DSN: `http://publickey@127.0.0.1:${receiver.port}/1`,
    // Кеш смотрит на тот же приёмник: ни боевой Upstash, ни сеть.
    UPSTASH_REDIS_REST_URL: `http://127.0.0.1:${receiver.port}/upstash`,
    UPSTASH_REDIS_REST_TOKEN: "check-sentry-vercel-only",
    DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db",
    SESSION_SECRET: process.env.SESSION_SECRET || "check-sentry-vercel-only",
    ...extraEnv,
  });
  const nextBin = join("node_modules", ".bin", "next");
  const child = spawn(nextBin, ["start", "-p", String(port), "-H", "127.0.0.1"], {
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  let html = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const kill = () => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      /* уже нет */
    }
  };
  process.on("exit", kill);
  try {
    let up = false;
    for (let i = 0; i < 120 && !up; i++) {
      if (child.exitCode !== null) break;
      try {
        const r = await fetch(`http://127.0.0.1:${port}/api/health`);
        up = r.status > 0;
      } catch {
        await sleep(500);
      }
    }
    if (!up) fail([`${label}: next start не поднялся. Журнал:`, log.slice(-1500)]);
    html = await fetch(`http://127.0.0.1:${port}/es`).then((r) => r.text()).catch(() => "");
    // Вторая страница с кешем (каталог рассказов) — чтобы «0 запросов к
    // кешу» не зависел от одной главной.
    await fetch(`http://127.0.0.1:${port}/es/stories`).then((r) => r.text()).catch(() => "");
    // Отправка события идёт фоном после старта — дать ей время.
    for (let i = 0; i < 20; i++) {
      if (receiver.envelopes.slice(before).some((e) => e.includes("StripeEnvWrongShape"))) break;
      await sleep(500);
    }
    await sleep(1000);
  } finally {
    kill();
    process.off("exit", kill);
  }
  const got = receiver.envelopes.slice(before);
  // Метка трассы в разметке ставится только включённым серверным SDK — по
  // ней же «Прод после выката» судит, что Sentry на проде жив.
  const baggage = (html.match(/<meta name="baggage" content="([^"]*)"/) ?? [])[1] ?? "";
  const traceMeta = /sentry-public_key=/.test(baggage);
  const cache = receiver.upstash.slice(upstashBefore);
  return { got, cache, stripe: got.filter((e) => e.includes("StripeEnvWrongShape")).length, log, traceMeta, baggage, htmlLen: html.length };
}

/** Позитивный контроль приёмника: SDK с тем же адресом обязан дойти.
 *  Асинхронно: приёмник живёт в этом же процессе, и синхронный запуск
 *  заморозил бы его — контроль в первой версии так и «ослеп». */
async function receiverControl(receiver) {
  const before = receiver.envelopes.length;
  const script =
    'const S=require("@sentry/node");S.init({dsn:process.argv[1],defaultIntegrations:false});' +
    'S.captureMessage("check-sentry-vercel-only receiver control");S.flush(5000).then(()=>process.exit(0));';
  const child = spawn(process.execPath, ["-e", script, `http://publickey@127.0.0.1:${receiver.port}/1`], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  let err = "";
  child.stderr.on("data", (d) => (err += d));
  const code = await new Promise((resolve) => {
    const t = setTimeout(() => {
      child.kill("SIGKILL");
      resolve(-1);
    }, 20000);
    child.on("exit", (c) => {
      clearTimeout(t);
      resolve(c);
    });
  });
  return { ok: code === 0, got: receiver.envelopes.length - before, err };
}

async function live() {
  if (!existsSync(".next/BUILD_ID")) {
    fail(["сборки нет (.next/BUILD_ID): живой запуск идёт ПОСЛЕ `npm run build`, а не зеленеет от пустоты."]);
  }
  const receiver = await startReceiver();
  const lines = [];
  try {
    const control = await receiverControl(receiver);
    if (!control.ok || control.got < 1) {
      fail([`приёмник слеп: SDK с тем же адресом прислал ${control.got} конвертов.`, control.err.slice(-800)]);
    }
    lines.push(`приёмник видит SDK (контроль): ${control.got} конверт`);

    const forged = await bootOnce("VERCEL=1 VERCEL_ENV=preview", receiver, { VERCEL: "1", VERCEL_ENV: "preview" });
    const platform = process.platform;
    if (platform === "linux") {
      if (forged.stripe < 1) {
        fail([
          "Linux + VERCEL=1 + VERCEL_ENV=preview: событие StripeEnvWrongShape НЕ пришло — на настоящем Vercel Sentry замолчал бы.",
          `конвертов всего: ${forged.got.length}. Журнал сервера:`,
          forged.log.slice(-1500),
        ]);
      }
      if (forged.htmlLen < 1000 || !forged.traceMeta) {
        fail([`Linux + VERCEL=1 + VERCEL_ENV=preview: в baggage /es нет sentry-public_key (длина ${forged.htmlLen}) — признак, по которому прод проверяется после выката, не работает.`]);
      }
      lines.push(`Linux, VERCEL=1, VERCEL_ENV=preview: событие пришло (${forged.stripe} StripeEnvWrongShape, конвертов ${forged.got.length}) — как на Vercel`);
      if (forged.cache.length < 1) {
        fail(["Linux + VERCEL=1 + VERCEL_ENV=preview: ни одного запроса к кешу Upstash — на настоящем Vercel кеш бы выключился."]);
      }
      lines.push(`Linux, VERCEL=1, VERCEL_ENV=preview: кеш Upstash открыт (${forged.cache.length} запросов, первый — ${forged.cache[0]}) — как на Vercel`);
      const one = await bootOnce("только VERCEL_ENV=preview", receiver, { VERCEL_ENV: "preview" });
      if (one.got.length > 0) {
        fail([`Linux, только VERCEL_ENV=preview (без VERCEL=1): пришло ${one.got.length} конвертов — одной ручной переменной снова достаточно.`]);
      }
      if (one.traceMeta) fail(["Linux, только VERCEL_ENV=preview: в baggage есть sentry-public_key — серверный SDK получил адрес по одной переменной."]);
      if (one.cache.length > 0) fail([`Linux, только VERCEL_ENV=preview: ${one.cache.length} запросов к кешу Upstash — одной переменной снова достаточно.`]);
      lines.push("Linux, только VERCEL_ENV=preview (контроль): конвертов 0, sentry-public_key в baggage нет, запросов к кешу 0 — одной переменной мало");
    } else {
      if (forged.got.length > 0) {
        fail([`${platform} + VERCEL=1 + VERCEL_ENV=preview: пришло ${forged.got.length} конвертов — Мак снова шлёт в Sentry.`]);
      }
      if (!/Stripe environment variables are the wrong shape/.test(forged.log)) {
        fail([
          `${platform}: сервер не напечатал отчёт о ключах Stripe — запуск не дошёл до места, где 17.11 родилось событие; «0» ничего не доказывает.`,
          forged.log.slice(-1500),
        ]);
      }
      if (forged.htmlLen < 1000) fail([`${platform}: страница /es не отрисовалась (длина ${forged.htmlLen}) — запуск не настоящий.`]);
      if (forged.traceMeta) fail([`${platform}: в baggage /es есть sentry-public_key — серверный SDK на Маке включён: ${forged.baggage}`]);
      if (forged.cache.length > 0) {
        fail([`${platform} + VERCEL=1 + VERCEL_ENV=preview: ${forged.cache.length} запросов к кешу Upstash (${forged.cache[0]}) — Мак снова открывает боевой кеш.`]);
      }
      lines.push(`${platform}, VERCEL=1, VERCEL_ENV=preview: отчёт Stripe напечатан, конвертов в Sentry 0, sentry-public_key в baggage /es нет, запросов к кешу Upstash 0 — Мак не шлёт и кеш не открывает`);
    }
  } finally {
    receiver.server.close();
  }
  return lines;
}

// ── 3. Живой прод (`--prod`, задание в «Прод после выката») ───────────────
// Только чтение страницы: включённый серверный SDK кладёт в `baggage`
// разметки `sentry-public_key` (ключ из адреса Sentry) и окружение
// `vercel-production`. Вне Vercel адрес до SDK не доходит (dsn ""), ключа
// нет — так что ключ на проде и есть «ворота открыты на настоящем Vercel».
// В Sentry при этом не уходит ничего.
export function judgeProdBaggage(html) {
  const baggage = (html.match(/<meta name="baggage" content="([^"]*)"/) ?? [])[1];
  if (baggage === undefined) return ["в разметке нет <meta name=\"baggage\"> — серверный Sentry на проде не работает"];
  const problems = [];
  if (!/(?:^|,)sentry-environment=vercel-production(?:,|$)/.test(baggage)) {
    problems.push(`окружение не vercel-production: ${baggage.split(",").filter((p) => p.startsWith("sentry-environment=")).join("") || "нет"}`);
  }
  if (!/(?:^|,)sentry-public_key=[0-9a-f]{16,}(?:,|$)/.test(baggage)) {
    problems.push("нет sentry-public_key — серверный SDK на проде не получил адрес Sentry (ворота закрыты)");
  }
  return problems;
}

async function prod() {
  const base = (process.env.SMOKE_BASE || "https://rusofacilapp.com").replace(/\/$/, "");
  let html = "";
  let status = 0;
  for (let attempt = 1; attempt <= 3 && status !== 200; attempt++) {
    try {
      const r = await fetch(`${base}/es`, { headers: { "user-agent": "rf-check-sentry-vercel-only" } });
      status = r.status;
      html = await r.text();
    } catch (e) {
      if (attempt === 3) fail([`${base}/es не ответил: ${e?.message ?? e} — проверка не состоялась`]);
      await sleep(5000);
    }
  }
  if (status !== 200) fail([`${base}/es ответил ${status} — проверка не состоялась (падение прода ловит задание Chromium)`]);
  const problems = judgeProdBaggage(html);
  if (problems.length) fail([`Sentry на проде (${base}) молчит:`, ...problems]);
  console.log(`check:sentry-vercel-only --prod: ${base}/es — серверный Sentry включён (vercel-production, ключ на месте); в Sentry ничего не отправлено.`);
}

// ── Позитивный контроль исходника ────────────────────────────────────────
// Форма — с живого прода 22.11.2026 (7.301); ключ и trace_id заменены.
const PROD_OK =
  '<meta name="baggage" content="sentry-environment=vercel-production,sentry-release=65a620bf93a8e9bf6dc7f99bdaeda51d35abc321,' +
  'sentry-public_key=0123456789abcdef0123456789abcdef,sentry-trace_id=00000000000000000000000000000000,sentry-sampled=false"/>';

function selfTest() {
  console.log("check:sentry-vercel-only --plant — сторож обязан покраснеть на каждой подсадке.");
  const goodConfig =
    'import { mayReportServerSentry } from "./src/lib/deploy-environment";\n' +
    "const isDeployed = mayReportServerSentry();\nSentry.init({ dsn: isDeployed ? process.env.SENTRY_DSN : \"\", enabled: isDeployed });";
  const goodRule =
    "export function isRealVercelServer(env, platform) {\n" +
    '  return isDeployedEnvironment(env) && env.VERCEL === "1" && platform === "linux";\n}\n' +
    "export function mayReportServerSentry(env, platform) {\n  return isRealVercelServer(env, platform);\n}\n";
  const goodRedis =
    'import { isRealVercelServer } from "./deploy-environment";\n' +
    "function createClient() {\n  if (!isRealVercelServer()) return null;\n  return new Redis({ url, token });\n}";
  const goodInstr =
    "async function reportMisshapenStripeEnv() {\n if (!mayReportServerSentry()) return;\n Sentry.captureException(e);\n}";
  const controls = [
    ["настоящий конфиг", checkSentryConfig("x", readFileSync("./sentry.server.config.ts", "utf8"))],
    ["чистый конфиг", checkSentryConfig("x", goodConfig)],
    ["чистое правило", checkRule(goodRule)],
    ["настоящее правило", checkRule(readFileSync("./src/lib/deploy-environment.ts", "utf8"))],
    ["чистый кеш", checkRedis(goodRedis)],
    ["настоящий кеш", checkRedis(readFileSync("./src/lib/redis.ts", "utf8"))],
    ["чистый отчёт Stripe", checkInstrumentation(goodInstr)],
    ["узловой файл без краевой среды", findEdgeRuntime([{ file: "a.ts", text: 'export const runtime = "nodejs";' }])],
    ["разметка прода с ключом", judgeProdBaggage(PROD_OK)],
  ];
  for (const [label, problems] of controls) {
    if (problems.length) fail([`КОНТРОЛЬ СЛОМАН: ${label} назван грязным: ${problems.join("; ")}`]);
    console.log(`  ✓ ${label} проходит`);
  }
  const planted = [
    ["конфиг на старых воротах (одна VERCEL_ENV)", () =>
      checkSentryConfig("x", goodConfig.replaceAll("mayReportServerSentry", "isDeployedEnvironment"))],
    ["конфиг, где dsn не закрыт воротами", () =>
      checkSentryConfig("x", goodConfig.replace('dsn: isDeployed ? process.env.SENTRY_DSN : ""', "dsn: process.env.SENTRY_DSN"))],
    ["конфиг с dsn: undefined вне Vercel (SDK возьмёт SENTRY_DSN сам)", () =>
      checkSentryConfig("x", goodConfig.replace('process.env.SENTRY_DSN : ""', "process.env.SENTRY_DSN : undefined"))],
    ["правило без проверки ОС", () => checkRule(goodRule.replace(' && platform === "linux"', ""))],
    ["правило без VERCEL=1", () => checkRule(goodRule.replace(' && env.VERCEL === "1"', ""))],
    ["правило с «или»", () => checkRule(goodRule.replace('&& platform === "linux"', '|| platform === "linux"'))],
    ["Sentry со своей копией правила, а не общей", () =>
      checkRule(goodRule.replace("return isRealVercelServer(env, platform);", 'return isDeployedEnvironment(env) && env.VERCEL === "1" && platform === "linux";'))],
    ["кеш на старых воротах (одна VERCEL_ENV, как до 7.302)", () =>
      checkRedis(goodRedis.replaceAll("isRealVercelServer", "isDeployedEnvironment"))],
    ["кеш без ворот", () => checkRedis(goodRedis.replace("  if (!isRealVercelServer()) return null;\n", ""))],
    ["кеш с воротами после new Redis(", () =>
      checkRedis('import { isRealVercelServer } from "./deploy-environment";\nconst c = new Redis({ url, token });\nif (!isRealVercelServer()) return null;')],
    ["отчёт Stripe на старых воротах", () =>
      checkInstrumentation(goodInstr.replace("mayReportServerSentry()", "isDeployedEnvironment()"))],
    ["отчёт Stripe с воротами после отправки", () =>
      checkInstrumentation("async function reportMisshapenStripeEnv() {\n Sentry.captureException(e);\n if (!mayReportServerSentry()) return;\n}")],
    ["маршрут на краевой среде", () => findEdgeRuntime([{ file: "r.ts", text: "export const runtime = 'edge';" }])],
    ["прод без baggage", () => judgeProdBaggage("<html><head></head></html>")],
    ["прод без ключа (ворота закрыты)", () => judgeProdBaggage(PROD_OK.replace(/sentry-public_key=[0-9a-f]+,/, ""))],
    ["прод в окружении превью", () => judgeProdBaggage(PROD_OK.replace("vercel-production", "vercel-preview"))],
  ];
  let caught = 0;
  for (const [label, run] of planted) {
    if (run().length > 0) {
      caught++;
      console.log(`  ✓ поймано: ${label}`);
    } else console.error(`  ✗ ПРОПУЩЕНО: ${label}`);
  }
  if (caught !== planted.length) fail([`поймано ${caught} из ${planted.length} подсадок — сторож дырявый.`]);
  console.log(`check:sentry-vercel-only --plant: поймано ${caught} из ${planted.length}.`);
}

async function main() {
  if (PLANT) return selfTest();
  if (PROD) return prod();
  const problems = SKIP_SOURCE ? [] : checkSource();
  if (problems.length) fail([`Sentry сервера может слать не только с Vercel (${problems.length}):`, ...problems]);
  if (!SKIP_SOURCE) console.log("check:sentry-vercel-only: исходник — оба серверных конфига, отчёт Stripe и кеш Upstash открываются только на настоящем Vercel (VERCEL_ENV + VERCEL=1 + Linux), краевой среды нет.");
  if (LIVE) {
    for (const line of await live()) console.log("  ✓ " + line);
    console.log("check:sentry-vercel-only --live: зелёный.");
  }
}

// Скрипт ничего не делает на импорте — правило src/lib/entry-point.test.ts.
const IS_ENTRY_POINT = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (IS_ENTRY_POINT) {
  main().then(
    () => process.exit(0),
    (e) => fail([String(e?.stack ?? e)]),
  );
}
