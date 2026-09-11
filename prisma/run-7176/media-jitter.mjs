/**
 * Заход 7.176: та ли это неустойчивость.
 *
 * Сверка 330 замороженных URL дала 0 расхождений у 130 рассказов и 29 у
 * 200 песен — но 25 из тех же песен расходятся и между ДВУМЯ съёмами
 * ОДНОГО И ТОГО ЖЕ снимка, то есть нестабильны сами по себе. Здесь
 * названные страницы снимаются N раз подряд с ОДНОГО сервера на ОДНОМ
 * снимке: если различных нормализованных HTML больше одного, страница
 * нестабильна независимо от наших строк, и её «сдвиг» в сверке — шум.
 *
 *   node prisma/run-7176/media-jitter.mjs --db=<снимок.db> --urls=a,b,c --takes=5
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const DB = arg("db"), TAKES = Number(arg("takes", "5"));
const URLS = arg("urls").split(",");
const SENTRY = [/<meta name="sentry-trace" content="[^"]*"\/?>/g, /<meta name="baggage" content="[^"]*"\/?>/g];
const SPLIT = /\\n"\]\)<\/script><script>self\.__next_f\.push\(\[1,"/g;
const norm = (h) => SENTRY.reduce((x, re) => x.replace(re, ""), h).replace(SPLIT, "\\n");

const port = 3181;
const child = spawn(`${process.cwd()}/node_modules/.bin/next`, ["start", "-p", String(port)], {
  cwd: process.cwd(), detached: true,
  env: (() => { const e = { ...process.env, DATABASE_URL: `file:${DB}`, NODE_ENV: "production" };
    delete e.TURSO_DATABASE_URL; delete e.TURSO_AUTH_TOKEN; return e; })(),
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", () => {}); child.stderr.on("data", () => {});
for (let i = 0; i < 180; i += 1) { try { const r = await fetch(`http://127.0.0.1:${port}/es`); if (r.status < 500) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }

let unstable = 0;
for (const u of URLS) {
  const hs = [];
  for (let t = 0; t < TAKES; t += 1) {
    const r = await fetch(`http://127.0.0.1:${port}${u}`, { signal: AbortSignal.timeout(180000) });
    hs.push(createHash("sha256").update(norm(await r.text())).digest("hex").slice(0, 12));
  }
  const uniq = new Set(hs);
  if (uniq.size > 1) unstable += 1;
  console.log(`${u}: различных HTML за ${TAKES} съёмов — ${uniq.size} ${uniq.size > 1 ? "(НЕСТАБИЛЬНА САМА ПО СЕБЕ)" : "(устойчива)"}`);
}
console.log(`нестабильных: ${unstable} из ${URLS.length}`);
try { process.kill(-child.pid, "SIGKILL"); } catch {}
process.exit(0);
