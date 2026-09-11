/**
 * Заход 7.176, часть 1, пункт 2: меняет ли ЗАПИСЬ семи вырезок серверный
 * HTML 330 замороженных URL.
 *
 * Вопрос не про код — код тут один и тот же, — а про ДАННЫЕ: строка
 * `AudioAsset` с `contentType='story-word'` появляется в базе, и нужно
 * доказать, что серверная разметка от этого не двигается. Поэтому здесь
 * одна и та же локальная боевая сборка поднимается ДВАЖДЫ: сперва по
 * снимку прода КАК ЕСТЬ, потом по его копии, в которую те же семь строк
 * добавлены ровно так, как их запишет `write-cuts.ts`.
 *
 * ПОЛ ШУМА снимается обязательно и до всяких выводов: в `<head>` стоят
 * два тега Sentry (`sentry-trace`, `baggage`), новые у каждого запроса и
 * разной длины, поэтому размер сырого HTML колеблется сам по себе. Тот же
 * снимок «до» снимается ВТОРОЙ раз, и его разброс — пол, ниже которого
 * межснимочная разница ничего не значит. Сверх того HTML сравнивается
 * ЗНАК В ЗНАК после снятия этих двух тегов: равенство нормализованного
 * HTML — утверждение сильнее равенства размеров.
 *
 *   node prisma/run-7176/frozen-html.mjs --before=<снимок.db> --after=<снимок.db> --out=…
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BEFORE = arg("before"), AFTER = arg("after"), OUT = arg("out");
const base = JSON.parse(readFileSync("docs/frozen-baseline-2026-08-30.json", "utf-8"));

/**
 * Два источника шума, оба замерены, а не предположены, и оба снимаются
 * ДО сравнения:
 *   1. теги Sentry `sentry-trace` и `baggage` в `<head>` — новые у
 *      каждого запроса и разной длины (7.173, 7.175);
 *   2. ГРАНИЦЫ ПОТОКОВЫХ КУСКОВ React: одна и та же полезная нагрузка
 *      приходит то одним `self.__next_f.push`, то тремя. Содержимое при
 *      этом то же знак в знак — замерено шестью съёмами одной страницы с
 *      одного сервера: 5 из 6 совпали, шестой отличался ТОЛЬКО местом
 *      разреза. Куски склеиваются обратно.
 */
const SENTRY = [/<meta name="sentry-trace" content="[^"]*"\/?>/g, /<meta name="baggage" content="[^"]*"\/?>/g];
const SPLIT = /\\n"\]\)<\/script><script>self\.__next_f\.push\(\[1,"/g;
const norm = (html) => SENTRY.reduce((h, re) => h.replace(re, ""), html).replace(SPLIT, '\\n');

function start(dbPath, port) {
  const child = spawn(`${process.cwd()}/node_modules/.bin/next`, ["start", "-p", String(port)], {
    cwd: process.cwd(), detached: true,
    env: (() => {
      const e = { ...process.env, DATABASE_URL: `file:${dbPath}`, NODE_ENV: "production" };
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
  for (let i = 0; i < 180; i += 1) {
    try { const r = await fetch(`http://127.0.0.1:${port}/es`); if (r.status < 500) return true; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function measure(dbPath, port, label) {
  const child = start(dbPath, port);
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
          got = { status: r.status, bytes: Buffer.byteLength(html, "utf-8"),
            hash: createHash("sha256").update(norm(html)).digest("hex") };
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

const before = await measure(BEFORE, 3161, "до записи");
const before2 = await measure(BEFORE, 3163, "до записи (второй съём — пол шума)");
const after = await measure(AFTER, 3162, "после записи");

const rows = base.map((r) => ({
  url: r.url,
  before: before.get(r.url), after: after.get(r.url), before2: before2.get(r.url),
  delta: after.get(r.url).bytes - before.get(r.url).bytes,
  noise: before2.get(r.url).bytes - before.get(r.url).bytes,
  sameHash: after.get(r.url).hash === before.get(r.url).hash,
  sameHashNoise: before2.get(r.url).hash === before.get(r.url).hash,
}));

const abs = (a) => a.map(Math.abs);
const noise = abs(rows.map((r) => r.noise)), delta = abs(rows.map((r) => r.delta));
console.log(`\nстраниц ${rows.length}; не-200: до ${rows.filter((r) => r.before.status !== 200).length}, после ${rows.filter((r) => r.after.status !== 200).length}`);
console.log(`ПОЛ ШУМА (тот же снимок, два съёма): |Δ| от ${Math.min(...noise)} до ${Math.max(...noise)} байт; |Δ| = 0 у ${noise.filter((d) => d === 0).length} из ${noise.length}`);
console.log(`  нормализованный HTML совпал у ${rows.filter((r) => r.sameHashNoise).length} из ${rows.length}`);
console.log(`ЗАПИСЬ (снимок до → снимок после): |Δ| от ${Math.min(...delta)} до ${Math.max(...delta)} байт; |Δ| = 0 у ${delta.filter((d) => d === 0).length} из ${delta.length}`);
console.log(`  нормализованный HTML совпал ЗНАК В ЗНАК у ${rows.filter((r) => r.sameHash).length} из ${rows.length}`);
const moved = rows.filter((r) => !r.sameHash);
for (const m of moved.slice(0, 15)) console.log(`  СДВИНУЛСЯ: ${m.url} ${m.before.bytes} → ${m.after.bytes} байт`);
if (OUT) writeFileSync(OUT, JSON.stringify(rows, null, 1), "utf-8");
process.exit(moved.length === 0 ? 0 : 1);
