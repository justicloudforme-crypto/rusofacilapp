/**
 * ОДНА ДОЛЯ ПЕРЕПИСИ ПЛАТНЫХ ПОВЕРХНОСТЕЙ — 7.196, часть 5.
 *
 * ====================================================================
 * ЗАЧЕМ ЭТОТ ФАЙЛ ПОЯВИЛСЯ
 * ====================================================================
 *
 * PR #316 не смержился, и красным его сделал НЕ ДЕФЕКТ. Шаг «Rendered
 * surface + прижатые к низу слои» дошёл до 390 экранов из 396 и был срезан
 * предохранителем на 30-й минуте; полный прогон того же шага занимает
 * 44 минуты. После роста прибора в 7.194 (132 адреса × 3 роли = 396
 * экранов, около 2200 нажатий) шаг стал ходить впритык, и каждый
 * следующий PR имел шанс покраснеть по таймеру. Отличить таймер от
 * находки можно было только вручную — то есть цена красного выросла с
 * «прочитать вывод» до «переспросить прогон и подождать ещё 44 минуты».
 *
 * Решение владельца: время захода дороже минут CI. Поэтому перепись едет
 * не одним потоком, а долями, и доли идут ПАРАЛЛЕЛЬНО, каждая в своём
 * задании GitHub Actions. Полная работа та же; стенные часы делятся.
 *
 * ПОЧЕМУ ОТДЕЛЬНОЕ ЗАДАНИЕ, А НЕ БОЛЬШЕ ПОТОКОВ В ОДНОМ. Внутри одного
 * прогона у прибора уже восемь одновременных страниц (`CONCURRENCY`), и
 * упирается он в процессор одного бегунка: и браузер, и сервер Next живут
 * на нём же. Доли на РАЗНЫХ бегунках получают по своему процессору
 * каждая — это единственное место, где параллельность действительно
 * прибавляет, а не перекладывает.
 *
 * ЧТО ЗДЕСЬ, А ЧЕГО ЗДЕСЬ НЕТ. Здесь поднимается сервер ролей (тот же
 * `E2E_TEST_SEED=1`, что и в `verify-rendered.mjs`, и по той же причине:
 * без него ни одна из трёх ролей не войдёт) и гоняется своя доля живой
 * половины. ПОДСАДКИ ЗДЕСЬ НЕТ — разбор у самого места, где она стояла.
 *
 *   node scripts/verify-purchase-surfaces.mjs --shard=1/3
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Свой порт, не 3123/3124: этот прогон живёт в своём задании, но
// перепутать его с чужим сервером на знакомом порту всё равно нельзя.
const PORT = 3125;
const BASE = `http://localhost:${PORT}`;

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/es`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return true;
    } catch {
      // сервер ещё не поднялся
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    try {
      process.kill(-server.pid, signal);
    } catch {
      // уже мёртв
    }
  }
  for (const stream of [server.stdout, server.stderr]) stream?.destroy();
}

export async function main() {
  const shardArg = process.argv.find((a) => a.startsWith("--shard="));
  if (!shardArg) {
    console.error("нужен --shard=<k>/<n>: это запуск ОДНОЙ доли, и молча взять всю работу он не должен");
    return 1;
  }
  const nextBin = join(process.cwd(), "node_modules", ".bin", "next");
  if (!existsSync(nextBin)) {
    console.error(`cannot find ${nextBin} — run npm ci first`);
    return 1;
  }

  const server = spawn(nextBin, ["start", "-p", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, E2E_TEST_SEED: "1" },
    detached: true,
  });
  let log = "";
  server.stdout.on("data", (d) => { log += d.toString(); });
  server.stderr.on("data", (d) => { log += d.toString(); });
  const stop = () => stopServer(server);
  process.on("exit", stop);
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => { stop(); process.exit(130); });
  }

  try {
    if (!(await waitForServer())) {
      console.error(`сервер ролей на ${BASE} не поднялся. Вывод:\n${log.slice(-800)}`);
      return 1;
    }
    const started = Date.now();
    const run = spawnSync(
      process.execPath,
      ["scripts/check-rendered-purchase-surfaces.mjs", `--base=${BASE}`, shardArg],
      { stdio: "inherit" },
    );
    /**
     * ПОДСАДКИ ЗДЕСЬ НЕТ, И ЭТО ИЗМЕРЕНО, А НЕ ВЫБРАНО ПО ВКУСУ.
     *
     * Первая редакция этого файла гоняла подсадку на первой доле. В одном
     * прогоне она заняла 19 секунд и прошла; в двух следующих — ПОВИСЛА, и
     * шаг умер по предохранителю в 45 минут, дойдя ровно до строки «роли:
     * 3 из 3» и не напечатав ни одного результата. В уборке задания при
     * этом видно, кто остался жив: `next-server` и `chrome-headless-shell`.
     *
     * Подсадка от доли не зависит вовсе — она живёт на КАЖДОМ экране и
     * гоняется по срезу из четырёх адресов. Поэтому она возвращена туда,
     * где работает устойчиво и стоит секунды, — в `verify-rendered.mjs`,
     * на сервер ролей, который там и так поднимается. Утверждение
     * «подсаженная кнопка покупки роняет прибор во всех трёх ролях» из CI
     * не пропадает: оно просто гоняется в соседнем задании.
     *
     * Здесь остаётся ЖИВАЯ половина — та, ради которой доли и заводились.
     */
    console.log(`  доля заняла ${Math.round((Date.now() - started) / 1000)} с`);
    return run.status ?? 1;
  } finally {
    stop();
  }
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main()
    .then((code) => {
      for (const stream of [process.stdout, process.stderr]) stream.write("");
      process.exit(code);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
