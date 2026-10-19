#!/usr/bin/env node
/**
 * Меряет ПИКОВУЮ память сборки и, по желанию, падает при превышении порога.
 *
 *   node scripts/measure-build-memory.mjs -- npm run build
 *   node scripts/measure-build-memory.mjs --limit-mb=5600 -- npm run build
 *   node scripts/measure-build-memory.mjs --self-test
 *
 * ЗАЧЕМ. Строка долга 293: на Vercel сборка убивается по SIGKILL с пометкой
 * «At least one "Out of Memory" ("OOM") event was detected during the build»
 * (журнал PR #380, 20.09.2026), а иногда вместо падения висит 45 минут и её
 * убивает лимит времени. Машина сборки Vercel: 4 ядра, 8 ГБ. Значит нужен
 * прибор, который называет пик ЧИСЛОМ, а не «вроде влезло».
 *
 * ЧТО ИМЕННО МЕРЯЕТСЯ, и почему не `/usr/bin/time`. `next build` — это не один
 * процесс: он поднимает пул воркеров (сборка страниц, генерация статики,
 * typegen). `time -l` и getrusage(RUSAGE_CHILDREN) отдают МАКСИМУМ по одному
 * потомку, а не СУММУ по дереву — то есть заведомо меньше того, что видит
 * контейнер, у которого лимит один на всех. Поэтому здесь: раз в интервал
 * снимается `ps` по всему дереву процессов и складывается RSS. Именно сумма по
 * дереву — то число, по которому cgroup-убийца принимает решение.
 *
 * Пик печатается в МБ и в ГБ; с `--limit-mb` превышение — ненулевой код возврата.
 *
 * `--clean-cache=.next/cache` (7.278, долг 399): перед стартом стереть кеш
 * сборки. Без этого замер на ноутбуке мерил не код, а историю папки: кеш
 * webpack разных веток копился (729 МБ 19.10.2026), сборка поднимала его на
 * старте и падала по памяти на 5-й секунде, хотя тот же код с пустым кешем
 * укладывался 8 из 8. В CI кеша нет вовсе, так что флаг уравнивает ноутбук с
 * CI. Стирается ровно `<папка запуска>/.next/cache` и ничего больше: любой
 * другой путь, путь через `..`, абсолютный путь и ссылка (symlink) вместо
 * папки — отказ с кодом 2 ДО запуска сборки (`cacheDirVerdict`).
 */
import { spawn, execFileSync } from "node:child_process";
import { lstatSync, rmSync, mkdirSync, writeFileSync, existsSync, symlinkSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Единственный путь, который `--clean-cache` вправе стереть, — относительно папки запуска. */
export const CLEANABLE_CACHE = path.join(".next", "cache");

/**
 * Можно ли стереть `arg` как кеш сборки, запущенной в `cwd`.
 * Возвращает `{ ok: true, dir }` или `{ ok: false, reason }`. Файловую
 * систему трогает только `lstat` — чтобы не пойти по ссылке наружу.
 */
export function cacheDirVerdict(cwd, arg) {
  if (typeof arg !== "string" || arg.trim() === "") return { ok: false, reason: "путь не задан" };
  if (path.isAbsolute(arg)) return { ok: false, reason: `абсолютный путь «${arg}» — разрешён только ${CLEANABLE_CACHE}` };
  if (arg.split(/[\\/]+/).includes("..")) return { ok: false, reason: `путь «${arg}» с «..» — разрешён только ${CLEANABLE_CACHE}` };
  const dir = path.resolve(cwd, arg);
  if (dir !== path.resolve(cwd, CLEANABLE_CACHE)) return { ok: false, reason: `«${arg}» — не ${CLEANABLE_CACHE}` };
  for (const p of [path.dirname(dir), dir]) {
    let st;
    try {
      st = lstatSync(p);
    } catch {
      continue; // нет — значит, и стирать нечего
    }
    if (st.isSymbolicLink()) return { ok: false, reason: `«${path.relative(cwd, p)}» — ссылка, а не папка: стирать по ней нельзя` };
    if (!st.isDirectory()) return { ok: false, reason: `«${path.relative(cwd, p)}» — не папка` };
  }
  return { ok: true, dir };
}

/** Размер дерева в байтах (`du -sk`), 0 — если папки нет или `du` недоступен. */
function treeBytes(dir) {
  if (!existsSync(dir)) return 0;
  try {
    return Number(execFileSync("du", ["-sk", dir], { encoding: "utf8" }).split(/\s+/)[0]) * 1024;
  } catch {
    return 0;
  }
}

/** Стирает кеш после `cacheDirVerdict`; возвращает стёртые байты. */
export function cleanCache(cwd, arg) {
  const verdict = cacheDirVerdict(cwd, arg);
  if (!verdict.ok) throw new Error(verdict.reason);
  const bytes = treeBytes(verdict.dir);
  rmSync(verdict.dir, { recursive: true, force: true });
  return bytes;
}

const SAMPLE_MS = 250;

/** Разбор вывода `ps -Ao pid=,ppid=,rss=` в массив {pid, ppid, rssKb}. */
export function parsePsTable(text) {
  const rows = [];
  for (const line of String(text).split("\n")) {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)$/);
    if (!m) continue;
    rows.push({ pid: Number(m[1]), ppid: Number(m[2]), rssKb: Number(m[3]) });
  }
  return rows;
}

/**
 * Сумма RSS (КБ) по корню и всем его потомкам любой глубины — и заодно самый
 * толстый ОДИН процесс дерева.
 *
 * Оба числа нужны, и это не педантизм: контейнер Vercel убивает по СУММЕ (у
 * cgroup лимит один на всех), а V8 убивает себя по ОДНОМУ процессу, когда тот
 * упёрся в `--max-old-space-size`. Заход 7.221 видел оба исхода на одной и той
 * же сборке.
 */
export function treeRssDetail(rows, rootPid) {
  const byParent = new Map();
  for (const row of rows) {
    if (!byParent.has(row.ppid)) byParent.set(row.ppid, []);
    byParent.get(row.ppid).push(row);
  }
  const self = rows.find((r) => r.pid === rootPid);
  let total = self ? self.rssKb : 0;
  let biggest = self ? self.rssKb : 0;
  const queue = [rootPid];
  const seen = new Set([rootPid]);
  while (queue.length > 0) {
    const pid = queue.shift();
    for (const child of byParent.get(pid) ?? []) {
      if (seen.has(child.pid)) continue;
      seen.add(child.pid);
      total += child.rssKb;
      if (child.rssKb > biggest) biggest = child.rssKb;
      queue.push(child.pid);
    }
  }
  return { totalKb: total, biggestKb: biggest, processes: seen.size };
}

/** Сумма RSS (КБ) по корню и всем его потомкам любой глубины. */
export function treeRssKb(rows, rootPid) {
  const byParent = new Map();
  for (const row of rows) {
    if (!byParent.has(row.ppid)) byParent.set(row.ppid, []);
    byParent.get(row.ppid).push(row);
  }
  const self = rows.find((r) => r.pid === rootPid);
  let total = self ? self.rssKb : 0;
  const queue = [rootPid];
  const seen = new Set([rootPid]);
  while (queue.length > 0) {
    const pid = queue.shift();
    for (const child of byParent.get(pid) ?? []) {
      if (seen.has(child.pid)) continue;
      seen.add(child.pid);
      total += child.rssKb;
      queue.push(child.pid);
    }
  }
  return total;
}

function snapshot() {
  try {
    return parsePsTable(execFileSync("ps", ["-Ao", "pid=,ppid=,rss="], { encoding: "utf8" }));
  } catch {
    return [];
  }
}

function selfTest() {
  console.log("measure-build-memory --self-test");
  console.log("");
  let bad = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) bad++;
    console.log(`  ${ok ? "✓" : "✗"} ${label}${ok ? "" : `  ← получено ${JSON.stringify(got)}, ждали ${JSON.stringify(want)}`}`);
  };

  const rows = parsePsTable("  100     1  1000\n  200   100  2000\n  300   200  3000\n  400     1  9999\nPID PPID RSS\n");
  check("ps разобран: 4 строки, заголовок отброшен", rows.length, 4);
  // 100 → 200 → 300 это дерево; 400 посторонний и в сумму попасть не должен.
  check("сумма по дереву = 1000+2000+3000", treeRssKb(rows, 100), 6000);
  check("лист дерева считает только себя", treeRssKb(rows, 300), 3000);
  check("посторонний процесс не приплюсован", treeRssKb(rows, 400), 9999);
  check("неизвестный pid → 0", treeRssKb(rows, 777), 0);
  check("самый толстый один процесс дерева", treeRssDetail(rows, 100).biggestKb, 3000);
  check("процессов в дереве", treeRssDetail(rows, 100).processes, 3);
  // ПОЗИТИВНЫЙ КОНТРОЛЬ САМОГО ПОРОГА: заниженный порог обязан покраснеть.
  const over = (peakMb, limitMb) => peakMb > limitMb;
  check("порог ловит превышение", over(6000, 5600), true);
  check("порог пропускает норму", over(5000, 5600), false);

  // `--clean-cache` (долг 399): разрешён ровно один путь, всё прочее — отказ.
  const cwd = mkdtempSync(path.join(tmpdir(), "rf-build-memory-"));
  try {
    const ok = (arg) => cacheDirVerdict(cwd, arg).ok;
    check("кеш .next/cache разрешён", ok(".next/cache"), true);
    check("то же с ./ и хвостовой чертой", ok("./.next/cache/"), true);
    check("отказ: вся .next", ok(".next"), false);
    check("отказ: папка запуска", ok("."), false);
    check("отказ: кеш webpack внутри (не та граница)", ok(".next/cache/webpack"), false);
    check("отказ: выход через ..", ok(".next/cache/../../src"), false);
    check("отказ: абсолютный путь", ok(path.join(cwd, ".next/cache")), false);
    check("отказ: чужой кеш", ok("node_modules/.cache"), false);
    check("отказ: пустой путь", ok(""), false);

    // Живой прогон на подсаженной папке: кеш стёрт, соседи целы.
    mkdirSync(path.join(cwd, ".next/cache/webpack"), { recursive: true });
    writeFileSync(path.join(cwd, ".next/cache/webpack/0.pack"), "x".repeat(4096));
    writeFileSync(path.join(cwd, ".next/BUILD_ID"), "keep");
    mkdirSync(path.join(cwd, "src"));
    writeFileSync(path.join(cwd, "src/keep.ts"), "keep");
    cleanCache(cwd, ".next/cache");
    check("кеш стёрт", existsSync(path.join(cwd, ".next/cache")), false);
    check("соседи кеша целы (.next/BUILD_ID, src/)", [".next/BUILD_ID", "src/keep.ts"].every((p) => existsSync(path.join(cwd, p))), true);
    check("кеша нет — не ошибка", cleanCache(cwd, ".next/cache"), 0);

    // Ссылка вместо папки кеша: по ней не идём, цель цела.
    mkdirSync(path.join(cwd, "outside"));
    writeFileSync(path.join(cwd, "outside/precious"), "keep");
    symlinkSync(path.join(cwd, "outside"), path.join(cwd, ".next/cache"));
    check("отказ: .next/cache — ссылка наружу", ok(".next/cache"), false);
    let threw = false;
    try {
      cleanCache(cwd, ".next/cache");
    } catch {
      threw = true;
    }
    check("стирание по ссылке отказано, цель цела", threw && existsSync(path.join(cwd, "outside/precious")), true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }

  console.log("");
  if (bad > 0) {
    console.error(`✗ ${bad} случай(ев) разошлись с ожиданием.`);
    process.exit(1);
  }
  console.log("Контроль пройден: 23 случая, из них 15 обязаны были дать НЕнулевой ответ или отказ.");
  process.exit(0);
}

async function main() {
  if (process.argv.includes("--self-test")) return selfTest();

  const argv = process.argv.slice(2);
  const limitArg = argv.find((a) => a.startsWith("--limit-mb="));
  const limitMb = limitArg ? Number(limitArg.split("=")[1]) : null;
  const sep = argv.indexOf("--");
  const command = sep >= 0 ? argv.slice(sep + 1) : [];
  if (command.length === 0) {
    console.error("Нечего запускать. Пример: node scripts/measure-build-memory.mjs --limit-mb=5600 -- npm run build");
    process.exit(2);
  }

  const cleanArg = argv.slice(0, sep >= 0 ? sep : argv.length).find((a) => a.startsWith("--clean-cache="));
  if (cleanArg) {
    const target = cleanArg.slice("--clean-cache=".length);
    let bytes;
    try {
      bytes = cleanCache(process.cwd(), target);
    } catch (error) {
      console.error(`✗ --clean-cache: ${error.message}. Сборку не запускаю.`);
      process.exit(2);
    }
    console.log(`кеш сборки ${CLEANABLE_CACHE} стёрт перед замером: ${Math.round(bytes / 1024 / 1024)} МБ (долг 399)`);
  }

  const started = Date.now();
  const child = spawn(command[0], command.slice(1), { stdio: "inherit" });

  let peakKb = 0;
  let peakAtMs = 0;
  let peakOneKb = 0;
  let peakProcesses = 0;
  const trace = [];
  const timer = setInterval(() => {
    const { totalKb, biggestKb, processes } = treeRssDetail(snapshot(), child.pid);
    if (totalKb === 0) return;
    const atMs = Date.now() - started;
    trace.push([atMs, totalKb, biggestKb, processes]);
    if (biggestKb > peakOneKb) peakOneKb = biggestKb;
    if (processes > peakProcesses) peakProcesses = processes;
    if (totalKb > peakKb) {
      peakKb = totalKb;
      peakAtMs = atMs;
    }
  }, SAMPLE_MS);

  const code = await new Promise((resolve) => {
    child.on("exit", (c, signal) => resolve(signal ? `signal:${signal}` : c));
  });
  clearInterval(timer);

  const peakMb = Math.round(peakKb / 1024);
  const elapsedS = Math.round((Date.now() - started) / 1000);
  console.log("");
  console.log("── пиковая память сборки ──────────────────────");
  console.log(`  команда:  ${command.join(" ")}`);
  console.log(`  пик суммы:${peakMb} МБ (${(peakMb / 1024).toFixed(2)} ГБ) на ${Math.round(peakAtMs / 1000)}-й секунде — по нему убивает контейнер Vercel`);
  console.log(`  пик один: ${Math.round(peakOneKb / 1024)} МБ — по нему убивает себя V8 (--max-old-space-size)`);
  console.log(`  процессов:${peakProcesses} в пике`);
  console.log(`  время:    ${elapsedS} с`);
  console.log(`  замеров:  ${trace.length} (раз в ${SAMPLE_MS} мс)`);
  console.log(`  выход:    ${code}`);
  if (process.env.BUILD_MEMORY_TRACE) {
    console.log("  след (с, МБ):");
    console.log("    сек\tсумма\tодин\tпроцессов");
    for (const [ms, kb, one, n] of trace)
      console.log(`    ${(ms / 1000).toFixed(1)}\t${Math.round(kb / 1024)}\t${Math.round(one / 1024)}\t${n}`);
  }
  console.log("───────────────────────────────────────────────");

  if (code !== 0) {
    console.error(`✗ сама команда завершилась с ${code} — порог не проверяем.`);
    process.exit(1);
  }
  if (limitMb !== null) {
    if (peakMb > limitMb) {
      console.error(`✗ пик ${peakMb} МБ больше порога ${limitMb} МБ. Машина сборки Vercel — 8192 МБ на всё.`);
      process.exit(1);
    }
    console.log(`✓ пик ${peakMb} МБ укладывается в порог ${limitMb} МБ (запас ${limitMb - peakMb} МБ).`);
  }
  process.exit(0);
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) main();
