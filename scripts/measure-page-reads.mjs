#!/usr/bin/env node
/**
 * СКОЛЬКО ПОХОДОВ В БАЗУ И СКОЛЬКО СТРОК СТОИТ ОДНО ОТКРЫТИЕ СТРАНИЦЫ.
 *
 * Заход 7.222, задачи 1–3. Мерка та же, что в 7.220: локальный сервер
 * против локальной базы, страницы открываются curl-ом (здесь — fetch),
 * кеши прогреты. Разница одна и она важна: 7.220 считал ВЫЗОВЫ Prisma,
 * здесь считаются ПОХОДЫ В ПРОВОД и ПРОЧИТАННЫЕ СТРОКИ — `src/lib/
 * db-read-meter.ts`. Число вызовов и число походов расходятся там, где
 * Prisma режет длинный `IN` на части, и ровно это расхождение заход и
 * чинит.
 *
 * ПОЧЕМУ ЗАМЕР ИДЁТ ПО ОДНОМУ ЗАПРОСУ ЗА РАЗ. Журнал прибора общий на
 * процесс: разделить в нём два одновременных запроса нечем. Поэтому
 * страницы открываются строго последовательно, а журнал обнуляется прямо
 * перед замеряемым открытием.
 *
 * ПРОГРЕВ — ЧАСТЬ МЕРКИ, А НЕ ПОДГОТОВКА. У банка карточек, каталога
 * рассказов и статистики главной есть кеши с TTL; холодный первый запрос
 * меряет их наполнение, а не цену страницы. Прогрев делается указанное
 * число раз (по умолчанию 3), и это число печатается вместе с числами,
 * потому что без него они не значат ничего.
 *
 *   node scripts/measure-page-reads.mjs --out=docs/read-budget-before.json
 *   node scripts/measure-page-reads.mjs --self-test    # позитивный контроль
 *
 * Сличение двух замеров:
 *   node scripts/measure-page-reads.mjs --compare=A.json --against=B.json
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PORT = Number(process.env.MEASURE_PORT ?? 3141);
const BASE = `http://127.0.0.1:${PORT}`;
const LOG = path.resolve("/tmp/rf-read-meter.jsonl");

/**
 * Страницы замера. Ровно те, что названы в задании 7.222 и в строке долга
 * 292, плюс маршрут сводки карточек из строки 285.
 */
export const SURFACES = [
  { key: "/es (главная)", url: "/es", auth: "both" },
  { key: "/es/stories/<id> (рассказ)", url: null, auth: "both", pick: "story" },
  { key: "/es/glossary/<slug> (термин)", url: null, auth: "both", pick: "term" },
  { key: "/sitemap.xml", url: "/sitemap.xml", auth: "guest" },
  { key: "/es/word-games", url: "/es/word-games", auth: "both" },
  { key: "POST /api/flashcards/summary", url: "/api/flashcards/summary", auth: "both", method: "POST" },
];

/** Сводит строки журнала в два числа и разбивку по таблицам. */
export function summarise(lines) {
  const calls = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      calls.push(JSON.parse(trimmed));
    } catch {
      /* обрезанная последняя строка — журнал дописывается во время чтения */
    }
  }
  const byShape = new Map();
  let rows = 0;
  for (const call of calls) {
    rows += Number(call.rows) || 0;
    byShape.set(call.shape, (byShape.get(call.shape) ?? 0) + 1);
  }
  return {
    trips: calls.length,
    rows,
    byShape: Object.fromEntries([...byShape.entries()].sort((a, b) => b[1] - a[1])),
  };
}

/**
 * Сравнение двух замеров. ПАДАЕТ на двух пустых выборках — правило
 * проекта: «сравнение до/после на двух пустых выборках обязано падать».
 */
export function compare(before, after) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  if (keys.length === 0) {
    return { ok: false, why: "обе выборки пусты — сравнивать нечего", rows: [] };
  }
  const rows = keys.map((key) => ({
    key,
    beforeTrips: before[key]?.trips ?? null,
    afterTrips: after[key]?.trips ?? null,
    beforeRows: before[key]?.rows ?? null,
    afterRows: after[key]?.rows ?? null,
  }));
  const measured = rows.filter((r) => r.beforeTrips !== null && r.afterTrips !== null);
  if (measured.length === 0) {
    return { ok: false, why: "ни одной страницы, измеренной в ОБА раза", rows };
  }
  return { ok: true, why: null, rows };
}

function selfTest() {
  let bad = 0;
  const ok = (cond, label) => {
    if (!cond) bad++;
    console.log(`  ${cond ? "✓" : "✗"} ${label}`);
  };
  console.log("measure-page-reads --self-test\n");

  const sample = [
    JSON.stringify({ kind: "queryRaw", shape: "SELECT User", rows: 1 }),
    JSON.stringify({ kind: "queryRaw", shape: "SELECT User", rows: 1 }),
    JSON.stringify({ kind: "queryRaw", shape: "SELECT Story", rows: 1 }),
    "",
    "{обрезанная стро",
  ];
  const s = summarise(sample);
  ok(s.trips === 3, `три похода из пяти строк журнала (получено ${s.trips})`);
  ok(s.rows === 3, `три прочитанные строки (получено ${s.rows})`);
  ok(s.byShape["SELECT User"] === 2, "разбивка по таблицам: User дважды");

  ok(summarise([]).trips === 0, "пустой журнал — ноль походов");

  // Главное правило сравнения: две пустые выборки обязаны ПАДАТЬ.
  ok(compare({}, {}).ok === false, "сравнение двух пустых выборок ПАДАЕТ");
  ok(
    compare({ "/es": { trips: 6, rows: 10 } }, {}).ok === false,
    "сравнение, где вторая выборка пуста, ПАДАЕТ"
  );
  ok(
    compare({ "/es": { trips: 6, rows: 10 } }, { "/es": { trips: 3, rows: 10 } }).ok === true,
    "сравнение двух непустых выборок проходит"
  );
  const c = compare({ "/es": { trips: 6, rows: 10 } }, { "/es": { trips: 3, rows: 9 } });
  ok(c.rows[0].beforeTrips === 6 && c.rows[0].afterTrips === 3, "числа до/после не перепутаны местами");

  console.log("");
  if (bad > 0) {
    console.error(`✗ ${bad} случай(ев) не прошли.`);
    process.exit(1);
  }
  console.log("Control passed: 8 случаев, из них 2 требуют ПАДЕНИЯ на пустых выборках.");
  process.exit(0);
}

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function waitForServer(timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`, { cache: "no-store" });
      if (res.ok || res.status === 503) return true;
    } catch {
      /* ещё не поднялся */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

function signSession(userId, sessionVersion, secret) {
  const payload = `${userId}.${sessionVersion}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

async function main() {
  if (process.argv.includes("--self-test")) return selfTest();

  const comparePath = arg("compare");
  if (comparePath) {
    const a = JSON.parse(readFileSync(comparePath, "utf8"));
    const b = JSON.parse(readFileSync(arg("against"), "utf8"));
    const result = compare(a.surfaces ?? a, b.surfaces ?? b);
    if (!result.ok) {
      console.error(`✗ ${result.why}`);
      process.exit(1);
    }
    console.log("| страница | походов до | после | строк до | после |");
    console.log("|---|---|---|---|---|");
    for (const r of result.rows) {
      console.log(
        `| ${r.key} | ${r.beforeTrips ?? "—"} | ${r.afterTrips ?? "—"} | ${r.beforeRows ?? "—"} | ${r.afterRows ?? "—"} |`
      );
    }
    process.exit(0);
  }

  const warmups = Number(arg("warmups", "3"));
  const out = arg("out");
  if (existsSync(LOG)) rmSync(LOG);
  writeFileSync(LOG, "");

  const env = { ...process.env, MEASURE_DB_READS: LOG, PORT: String(PORT) };
  const server = spawn("npx", ["next", "dev", "--port", String(PORT)], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => process.env.MEASURE_VERBOSE && process.stdout.write(`[dev] ${d}`));
  server.stderr.on("data", (d) => process.env.MEASURE_VERBOSE && process.stderr.write(`[dev!] ${d}`));

  const stop = () => {
    try {
      server.kill("SIGTERM");
    } catch {
      /* уже мёртв */
    }
  };
  process.on("exit", stop);

  try {
    if (!(await waitForServer())) throw new Error("сервер не поднялся");

    // Кого меряем вошедшим. Берётся первая живая строка User из той же
    // базы, куда смотрит сервер: подписывать cookie можно только тому,
    // кто в базе есть, иначе замер «вошедшего» молча померил бы гостя.
    const secret = process.env.SESSION_SECRET;
    const user = JSON.parse(readFileSync(arg("user-file", "/tmp/rf-measure-user.json"), "utf8"));
    const cookie = `session=${signSession(user.id, user.sessionVersion, secret)}`;

    const storyId = arg("story");
    const termSlug = arg("term");

    const surfaces = [];
    for (const surface of SURFACES) {
      const url =
        surface.pick === "story"
          ? `/es/stories/${encodeURIComponent(storyId)}`
          : surface.pick === "term"
            ? `/es/glossary/${encodeURIComponent(termSlug)}`
            : surface.url;
      const roles = surface.auth === "guest" ? ["гость"] : ["гость", "вошедший"];
      for (const role of roles) {
        const headers = role === "вошедший" ? { cookie } : {};
        const init =
          surface.method === "POST"
            ? { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: "{}" }
            : { headers };
        // Прогрев — часть мерки.
        for (let i = 0; i < warmups; i++) await fetch(`${BASE}${url}`, { ...init, cache: "no-store" });
        writeFileSync(LOG, "");
        const res = await fetch(`${BASE}${url}`, { ...init, cache: "no-store" });
        await res.text();
        const log = readFileSync(LOG, "utf8").split("\n");
        const summary = summarise(log);
        surfaces.push({ key: `${surface.key} — ${role}`, status: res.status, ...summary });
        console.log(
          `  ${surface.key} — ${role}: ${res.status}, походов ${summary.trips}, строк ${summary.rows}`
        );
      }
    }

    const report = {
      measuredAt: new Date().toISOString(),
      warmups,
      surfaces: Object.fromEntries(surfaces.map((s) => [s.key, s])),
    };
    if (out) {
      mkdirSync(path.dirname(out), { recursive: true });
      writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
      console.log(`\nзаписано: ${out}`);
    }
  } finally {
    stop();
  }
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  await main();
}
