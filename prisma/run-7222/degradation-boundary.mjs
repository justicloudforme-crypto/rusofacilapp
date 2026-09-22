/**
 * ГРАНИЦА ДЕГРАДАЦИИ 7.220 ПОСЛЕ ПАМЯТКИ `cache` — ОПЫТ, А НЕ РАССУЖДЕНИЕ.
 *
 * Заход 7.222 обернул `getCurrentUser` в `cache` из React. Памятка
 * запоминает ОБЕЩАНИЕ, включая неудавшееся, и это ровно то место, где
 * можно нечаянно сдвинуть границу, решённую заходом 7.220:
 *
 *   * шапка (`getCurrentUserForChrome`) отказ базы ПРОГЛАТЫВАЕТ и рисует
 *     вид для гостя — отказ в сторону меньшего, ни одна дверь не
 *     открывается;
 *   * всё, что решает ДОСТУП или ДЕНЬГИ (`getEntitlementTier` поверх
 *     `getCurrentUser`), падает ГРОМКО — проглоченный отказ показал бы
 *     уже оплатившему человеку пейвол, а следующим его действием была бы
 *     вторая оплата. Пустая страница дешевле второго списания.
 *
 * Опасность именно в порядке: шапка зовёт первой. Если бы её `catch`
 * «лечил» памятку, то идущий следом `getEntitlementTier` получил бы не
 * отказ, а `null`, то есть тихо превратил бы подписчика в `free`.
 *
 * Здесь это проверяется НАСТОЯЩИМ отказом чтения: в копии базы таблица
 * `User` переименована, сервер поднят по ней, и обе поверхности открыты
 * под cookie ПОДПИСЧИКА.
 *
 * Ожидание: главная — 200 (шапка деградировала), страница рассказа — 500
 * (уровень доступа прочитать не удалось, и молчать об этом нельзя).
 *
 *   node prisma/run-7222/degradation-boundary.mjs --next=<.next> --db=<файл.db>
 */
import { spawn, execFileSync } from "node:child_process";
import { cpSync, copyFileSync, existsSync, rmSync } from "node:fs";
import { createHmac } from "node:crypto";
import path from "node:path";

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const NEXT = arg("next"), SRC_DB = path.resolve(arg("db"));
const SECRET = process.env.SESSION_SECRET;
if (!NEXT || !SRC_DB || !SECRET) {
  console.error("нужны --next, --db и SESSION_SECRET");
  process.exit(1);
}
const BROKEN = `${SRC_DB}.broken-user.db`;
const PORT = 3191;

copyFileSync(SRC_DB, BROKEN);
const sql = (file, q) => execFileSync("sqlite3", [file, q], { encoding: "utf8" }).trim();
// Настоящий отказ чтения: таблицы User в этой копии нет.
sql(BROKEN, "ALTER TABLE User RENAME TO User_hidden_by_experiment;");
console.log("в копии базы таблица User переименована — чтение вошедшего теперь отказывает");

if (existsSync(".next")) rmSync(".next", { recursive: true, force: true });
cpSync(NEXT, ".next", { recursive: true });
const env = { ...process.env, DATABASE_URL: `file:${BROKEN}`, NODE_ENV: "production" };
delete env.TURSO_DATABASE_URL;
delete env.TURSO_AUTH_TOKEN;
delete env.MEASURE_DB_READS;
const server = spawn(`${process.cwd()}/node_modules/.bin/next`, ["start", "-p", String(PORT)], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", () => {});
server.stderr.on("data", () => {});

const up = async () => {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/es`);
      if (r.status < 600) return true;
    } catch { /* ещё не поднялся */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
};

try {
  if (!(await up())) throw new Error("сервер не поднялся");
  const id = "parity-premium";
  const payload = `${id}.0`;
  const cookie = `session=${payload}.${createHmac("sha256", SECRET).update(payload).digest("hex")}`;
  const story = sql(SRC_DB, "SELECT id FROM Story ORDER BY createdAt LIMIT 1;");

  const cases = [
    { what: "главная под подписчиком — шапка обязана ДЕГРАДИРОВАТЬ", url: "/es", want: 200 },
    { what: "рассказ под подписчиком — доступ обязан падать ГРОМКО", url: `/es/stories/${story}`, want: 500 },
  ];
  let bad = 0;
  for (const c of cases) {
    const r = await fetch(`http://127.0.0.1:${PORT}${c.url}`, { headers: { cookie }, redirect: "manual" });
    const ok = r.status === c.want;
    if (!ok) bad++;
    console.log(`  ${ok ? "✓" : "✗"} ${c.what}: ожидали ${c.want}, получили ${r.status}`);
  }
  if (bad > 0) {
    console.error(`✗ граница деградации сдвинулась: ${bad} из ${cases.length}`);
    process.exit(1);
  }
  console.log("Граница 7.220 на месте: отказ в сторону меньшего у шапки, громкий — у доступа.");
} finally {
  server.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 1000));
  rmSync(BROKEN, { force: true });
}
