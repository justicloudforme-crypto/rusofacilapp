/**
 * 7.175, часть 5 — оговорка эксперимента числом.
 *
 * Вариант В (#273) добавил строку в полезную нагрузку КЛИЕНТСКОГО
 * компонента рассказов: видимая разметка замороженных страниц не
 * изменилась, а сырой HTML вырос. 7.174 измерил это на ПЯТИ рассказах
 * (+248…302 байта). Съём эксперимента 25.09 сравнивает динамики четырёх
 * ГРУПП, поэтому вопрос стоит иначе: задеты ли группы ОДИНАКОВО.
 *
 * Здесь обе локальные боевые сборки — коммит ДО #273 и текущий `main` —
 * поднимаются по ОДНОМУ И ТОМУ ЖЕ снимку прода, и с каждой снимаются все
 * 330 замороженных URL. Меряется РАЗМЕР СЫРОГО HTML в байтах. Вывод
 * «группы задеты одинаково или нет» делается только арифметикой.
 *
 *   node prisma/run-7175/html-size.mjs --before=<кат> --after=<кат> --out=…
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BEFORE = arg("before"), AFTER = arg("after"), OUT = arg("out");
const SNAP = arg("snapshot");
const base = JSON.parse(readFileSync("docs/frozen-baseline-2026-08-30.json", "utf-8"));
const groups = JSON.parse(readFileSync("docs/experiment-groups-2026-08-28.json", "utf-8"));

const GROUP_OF = new Map();
for (const [g, ids] of Object.entries(groups)) for (const id of ids) GROUP_OF.set(id, g);
const RU = { storyPilot: "пилот рассказов", storyControl: "контроль рассказов", mediaPilot: "пилот песен", mediaControl: "контроль песен" };

function groupOf(url) {
  const m = /\/stories\/([^/?#]+)/.exec(url);
  if (m) return GROUP_OF.get(m[1]) ?? "рассказ вне групп";
  const s = /\/media\/([^/?#]+)/.exec(url);
  if (s) return GROUP_OF.get(s[1]) ?? "песня вне групп";
  return "прочее";
}

function start(dir, port) {
  const child = spawn(`${process.cwd()}/node_modules/.bin/next`, ["start", "-p", String(port)], {
    cwd: dir, detached: true,
    env: (() => {
      // Пустая строка здесь НЕ годится: `TURSO_DATABASE_URL ?? DATABASE_URL`
      // вернёт её саму, и Prisma отвечает URL_INVALID на всех 330
      // страницах. Переменные снимаются, а не обнуляются.
      const e = { ...process.env, DATABASE_URL: `file:${SNAP}`, NODE_ENV: "production" };
      delete e.TURSO_DATABASE_URL; delete e.TURSO_AUTH_TOKEN;
      return e;
    })(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => process.stderr.write(`[${port}] ${d}`));
  return child;
}

async function waitUp(port) {
  for (let i = 0; i < 120; i += 1) {
    try { const r = await fetch(`http://127.0.0.1:${port}/es`); if (r.status < 500) return true; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function measure(dir, port, label) {
  const child = start(dir, port);
  try {
    if (!await waitUp(port)) throw new Error(`${label}: сервер не поднялся`);
    const out = new Map();
    for (const row of base) {
      const p = new URL(row.url).pathname;
      let got = null, tries = 0;
      while (!got && tries < 3) {
        tries += 1;
        try {
          const r = await fetch(`http://127.0.0.1:${port}${p}`, { redirect: "manual", signal: AbortSignal.timeout(180000) });
          const html = await r.text();
          got = { status: r.status, bytes: Buffer.byteLength(html, "utf-8"), tries };
        } catch (e) {
          if (tries === 3) throw new Error(`${label} ${p}: ${e}`);
          await new Promise((r2) => setTimeout(r2, 2000));
        }
      }
      out.set(row.url, got);
      if (out.size % 50 === 0) console.log(`  ${label}: ${out.size}/${base.length}`);
    }
    return out;
  } finally {
    try { process.kill(-child.pid, "SIGKILL"); } catch {}
    child.stdout?.destroy(); child.stderr?.destroy();
  }
}

const before = await measure(BEFORE, 3151, "до #273");
// КОНТРОЛЬ ШУМА. В `<head>` каждой страницы стоят два тега Sentry
// (`sentry-trace` и `baggage`), содержимое которых новое у каждого
// запроса и РАЗНОЙ ДЛИНЫ. Поэтому размер сырого HTML колеблется и без
// всякой правки кода. Та же сборка снимается ВТОРОЙ раз, и разброс
// внутри одной сборки и есть пол, ниже которого межсборочная разница
// ничего не значит.
const before2 = await measure(BEFORE, 3153, "до #273 (второй съём)");
const after = await measure(AFTER, 3152, "после #273");

const noise = base.map((r) => before2.get(r.url).bytes - before.get(r.url).bytes);
const absNoise = noise.map(Math.abs);
console.log(`\nПОЛ ШУМА (одна и та же сборка, два съёма): |Δ| от ${Math.min(...absNoise)} до ${Math.max(...absNoise)} байт, ` +
  `страниц с |Δ| = 0: ${absNoise.filter((d) => d === 0).length} из ${absNoise.length}, ` +
  `сумма Δ ${noise.reduce((a, b) => a + b, 0)} байт`);

const rows = base.map((r) => ({
  url: r.url, group: groupOf(r.url),
  before: before.get(r.url), after: after.get(r.url),
  delta: after.get(r.url).bytes - before.get(r.url).bytes,
  noise: before2.get(r.url).bytes - before.get(r.url).bytes,
}));

const bad = rows.filter((r) => r.before.status !== 200 || r.after.status !== 200);
console.log(`страниц ${rows.length}; не-200 до ${rows.filter((r) => r.before.status !== 200).length}, после ${rows.filter((r) => r.after.status !== 200).length}`);
for (const b of bad.slice(0, 5)) console.log(`  не-200: ${b.url} ${b.before.status}→${b.after.status}`);

const by = new Map();
for (const r of rows) {
  const g = by.get(r.group) ?? { n: 0, sumBefore: 0, sumAfter: 0, deltas: [], noises: [] };
  g.n += 1; g.sumBefore += r.before.bytes; g.sumAfter += r.after.bytes; g.deltas.push(r.delta); g.noises.push(r.noise);
  by.set(r.group, g);
}
const fmt = (n) => n.toLocaleString("ru-RU");
console.log(`\n${"группа".padEnd(22)} ${"страниц".padStart(8)} ${"сырой HTML до".padStart(15)} ${"после".padStart(15)} ${"Δ всего".padStart(10)} ${"Δ мин".padStart(7)} ${"Δ макс".padStart(7)} ${"Δ сред".padStart(8)} ${"Δ, %".padStart(7)}`);
const table = [];
for (const [g, v] of [...by].sort()) {
  const min = Math.min(...v.deltas), max = Math.max(...v.deltas);
  const sum = v.sumAfter - v.sumBefore;
  const avg = sum / v.n, pct = (sum / v.sumBefore) * 100;
  console.log(`${(RU[g] ?? g).padEnd(22)} ${String(v.n).padStart(8)} ${fmt(v.sumBefore).padStart(15)} ${fmt(v.sumAfter).padStart(15)} ${fmt(sum).padStart(10)} ${String(min).padStart(7)} ${String(max).padStart(7)} ${avg.toFixed(1).padStart(8)} ${pct.toFixed(4).padStart(7)}`);
  const nsum = v.noises.reduce((a, b) => a + b, 0);
  console.log(`${"".padEnd(22)} ${"".padStart(8)} ${"шум той же сборки:".padStart(15)} ${"".padStart(15)} ${fmt(nsum).padStart(10)} ${String(Math.min(...v.noises)).padStart(7)} ${String(Math.max(...v.noises)).padStart(7)} ${(nsum / v.n).toFixed(1).padStart(8)}`);
  table.push({ шумВсего: nsum, шумСредний: Number((nsum / v.n).toFixed(1)), группа: RU[g] ?? g, страниц: v.n, доБайт: v.sumBefore, послеБайт: v.sumAfter, дельтаВсего: sum, дельтаМин: min, дельтаМакс: max, дельтаСредняя: Number(avg.toFixed(1)), процент: Number(pct.toFixed(4)) });
}
if (OUT) writeFileSync(OUT, JSON.stringify({ страницы: rows, группы: table }, null, 1), "utf-8");
console.log(`\nстраниц, у которых сырой HTML не изменился ни на байт: ${rows.filter((r) => r.delta === 0).length} из ${rows.length}`);
process.exit(0);
