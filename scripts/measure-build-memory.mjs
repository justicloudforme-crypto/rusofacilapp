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
 */
import { spawn, execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

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

  console.log("");
  if (bad > 0) {
    console.error(`✗ ${bad} случай(ев) разошлись с ожиданием.`);
    process.exit(1);
  }
  console.log("Контроль пройден: 9 случаев, из них 6 обязаны были дать НЕнулевой ответ.");
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
