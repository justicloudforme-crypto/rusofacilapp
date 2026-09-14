// Run the rendered-surface check against a freshly built production server,
// as part of `npm run verify` — the gate that runs before a merge.
//
// Why it belongs there. lint, typecheck and 465 unit tests were all green
// for the ten days every lesson page on production rendered nothing but
// "Something went wrong" (incident №1). None of them opens a browser, and
// none of them could have: the failure was a regex that only throws under
// the `u` flag, built at runtime from database content, inside a client
// component. The only check that can see that class is one that renders the
// page. So it has to run automatically, not when someone remembers to.
//
// Starts `next start` on its own port, waits for it to answer, runs the
// check with its positive control, and stops the server whatever happens.
//
// "Stops the server" is harder than it looks, and getting it wrong cost a
// CI run 56 minutes on 29.08.2026. The check itself finished in a second —
// 17 families ok, control 2/2, 0 problems — and then the step simply never
// returned, so "Upload Playwright report" and "Post Run" never started.
//
// Reproduced and measured rather than guessed. The old code did
// `spawn("npx", ["next", "start", …])` and `child.kill("SIGKILL")`. That
// kills npx, not the server npx started: after the kill the grandchild was
// still alive with PPID 1, still answering 200 on the port, and this
// process still held two open Socket handles — the stdout/stderr pipes the
// grandchild had inherited. Node cannot exit while those are open, so the
// step hung forever.
//
// Three changes, each pulling in the same direction:
//   1. spawn the local `next` binary directly, one process layer fewer
//   2. `detached: true` makes the child a process-group leader, so
//      `process.kill(-pid)` reaches every process it started
//   3. exit explicitly with the check's status instead of waiting for the
//      event loop to drain, and destroy the pipes first
// The third alone would have fixed the hang; the first two are what
// actually stop the server, which is the part that matters on a machine
// that keeps running afterwards.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Deliberately not 3000/3100/3111: those are dev, the e2e webServer, and the
// port used for manual probing. A verify run must not adopt whatever server
// happens to be listening there and report on the wrong build.
const PORT = 3123;
const BASE = `http://localhost:${PORT}`;

/**
 * ВТОРОЙ сервер, и он нужен ровно одной проверке — живой половине
 * `check:native-payments` (долг 184).
 *
 * Зачем отдельный. Сторож судит теперь ТРИ РОЛИ: гостя, аккаунт без
 * подписки и подписчика, — и роли у него настоящие: он заводит их через
 * `/api/auth/register` и выдаёт подписку через
 * `/api/test/grant-subscription`. Второй маршрут живёт только при
 * `E2E_TEST_SEED=1`, а первый без этого флага отдаёт сессионную куку с
 * `Secure` (см. `src/lib/session-token.ts`), и по http она не вернётся
 * вовсе — то есть «войти» не вышло бы ни у одной роли.
 *
 * Почему флаг не добавлен общему серверу на 3123: на нём меряют отдачу
 * восемь других проверок, и менять условия их замера ради одной — цена,
 * которую платить незачем. Этот поднимается непосредственно перед
 * проверкой и гасится сразу после неё.
 */
const ROLES_PORT = 3124;
const ROLES_BASE = `http://localhost:${ROLES_PORT}`;

async function waitForServer(timeoutMs = 90_000, base = BASE) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/es`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

/** Kill the child AND everything it started, then let go of its pipes. */
function stopServer(server) {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  // Negative pid = the whole process group, which is why the child is
  // spawned detached. SIGTERM first so Next can close its listener; SIGKILL
  // straight after, because a graceful shutdown is not worth waiting on
  // here and a lingering listener is exactly what we are preventing.
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    try {
      process.kill(-server.pid, signal);
    } catch {
      // Already gone, or no such group — either way there is nothing to kill.
    }
  }
  // The pipes are what kept the event loop alive after the old kill.
  for (const stream of [server.stdout, server.stderr]) {
    try {
      stream?.destroy();
    } catch {
      // nothing to do
    }
  }
}

/**
 * Порт обязан быть СВОБОДЕН до того, как мы поднимем свой сервер.
 *
 * Заплачено 11.09.2026. На машине остался чужой `next start -p 3123`,
 * поднятый по базе в форме CI; `next start` этого прогона не смог занять
 * порт и умер, а `waitForServer` увидел ответ 200 от ЧУЖОГО сервера и
 * пошёл мерить его. Итог: `verify` покраснел на девяти семействах и на
 * одиннадцати сочетаниях вкладки — на сборке, которой этот прогон не
 * собирал, и на базе, которой у него не было. Комментарий к выбору порта
 * выше говорит «прогон не должен принять чужой сервер за свой», но
 * ПРОВЕРКИ на это не было.
 *
 * Отказ, а не предупреждение: «зелёный на чужой сборке» ничем не лучше
 * красного, а «красный на чужой сборке» — ровно то, что здесь и вышло.
 */
async function portIsFree(base = BASE) {
  try {
    await fetch(`${base}/`, { signal: AbortSignal.timeout(3000) });
    return false;
  } catch {
    return true;
  }
}

async function main() {
  // ОБА порта, а не один: с 13.09.2026 прогон поднимает второй сервер под
  // роли (см. ROLES_PORT), и чужой `next start` на 3124 он принял бы за
  // свой ровно так же, как когда-то принял чужой на 3123.
  for (const base of [BASE, ROLES_BASE]) {
    if (await portIsFree(base)) continue;
    console.error(
      `ОТКАЗ: на ${base} уже кто-то отвечает.` +
        ` Этот прогон поднимает СВОИ серверы и меряет СВОЮ сборку; чужой сервер на том же порту он` +
        ` принял бы за свой и намерил бы чужое. Остановите его и повторите.`,
    );
    return 1;
  }
  // The local binary, not npx: one fewer process between us and the server.
  const nextBin = join(process.cwd(), "node_modules", ".bin", "next");
  if (!existsSync(nextBin)) {
    console.error(`cannot find ${nextBin} — run npm ci first`);
    return 1;
  }
  const spawnServer = (port, extraEnv = {}) => {
    const child = spawn(nextBin, ["start", "-p", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...extraEnv },
      // Its own process group, so one kill reaches every process it forks.
      detached: true,
    });
    child.log = "";
    child.stdout.on("data", (d) => { child.log += d.toString(); });
    child.stderr.on("data", (d) => { child.log += d.toString(); });
    return child;
  };

  const server = spawnServer(PORT);
  let serverLog = "";
  server.stdout.on("data", (d) => { serverLog += d.toString(); });
  server.stderr.on("data", (d) => { serverLog += d.toString(); });

  const stop = () => stopServer(server);
  // Covers a cancelled run too: a killed step must not leave a server behind.
  process.on("exit", stop);
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => { stop(); process.exit(130); });
  }

  try {
    if (!(await waitForServer())) {
      console.error(`could not start next start on ${PORT}. Server output:\n${serverLog.slice(-800)}`);
      return 1;
    }
    // Вторая половина того же: сервер мог ответить, а НАШ ребёнок —
    // умереть (порт занят, сборки нет). Тогда отвечает не он.
    if (server.exitCode !== null) {
      console.error(
        `ОТКАЗ: наш next start завершился с кодом ${server.exitCode}, а на ${BASE} кто-то отвечает — значит отвечает не он. ` +
          `Вывод сервера:\n${serverLog.slice(-800)}`,
      );
      return 1;
    }
    // --control is not optional here. A gate that cannot demonstrate it
    // finds a broken render is a gate that passes everything.
    // --ci is passed straight through: it drops the content-count
    // assertions, which CI's empty database cannot satisfy, and keeps
    // everything that identifies a broken render.
    const passthrough = process.argv.slice(2).filter((a) => a === "--ci");
    const run = spawnSync(
      process.execPath,
      ["scripts/check-rendered-surface.mjs", `--base=${BASE}`, "--control", ...passthrough],
      { stdio: "inherit" }
    );
    // Layout runs on the SAME server, in the same step, and both statuses
    // are reported. Rendered-surface answers "is the page there"; this one
    // answers "is it the right shape" — two defects found on production
    // 29.08.2026 (a see-through sticky header, a footer row 428px wide in a
    // 320px viewport) were invisible to the first check and are exactly
    // what the second measures. Running it second and not short-circuiting
    // means one verify run names every problem it can see, rather than
    // hiding the layout ones behind a content failure.
    const layout = spawnSync(
      process.execPath,
      ["scripts/check-layout-geometry.mjs", `--base=${BASE}`, "--control", ...passthrough],
      { stdio: "inherit" }
    );
    // Третьей на том же сервере — «ни одна внутренняя ссылка не ведёт в
    // не-200». Здесь, а не отдельным шагом, по той же причине, по какой
    // здесь стоит layout: сервер уже поднят, браузер уже установлен, а
    // отдельная задача заплатила бы за npm ci, prisma generate, сборку и
    // установку движка ещё раз.
    //
    // Проверка обязана видеть КЛИЕНТСКИЕ ссылки: дефект, ради которого
    // она написана (`/ru/alfabeto-cirilico`, 404), в серверном HTML
    // отсутствует вовсе — вводная дека печатает его только после
    // гидрации, и только на четвёртом слайде.
    const links = spawnSync(
      process.execPath,
      [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "scripts/check-internal-links.ts", `--base=${BASE}`],
      { stdio: "inherit" }
    );
    // Обязательная вторая половина: сторож, который не краснеет от
    // подсадки, зелёный ни о чём не говорит (PROGRESS.md 4.1). Две
    // страницы вместо тридцати трёх — подсадка живёт на КАЖДОЙ, и
    // проверять её тридцать три раза значит платить за одно и то же.
    const linksPlant = spawnSync(
      process.execPath,
      [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "scripts/check-internal-links.ts", `--base=${BASE}`, "--plant", "--paths=/es,/ru"],
      { stdio: "inherit" }
    );
    // Пятой на том же сервере — «несуществующий адрес отдаёт 404 и НАШУ
    // страницу» (долг 129). Здесь, а не отдельным шагом, по той же
    // причине, по какой здесь стоят layout и ссылки: сервер уже поднят.
    // Статическую половину того же сторожа гоняет `npm run check:404` в
    // `verify` и в `ci.yml`; она дешёвая и сервера не требует.
    const notFound = spawnSync(
      process.execPath,
      ["scripts/check-404-page.mjs", `--base=${BASE}`],
      { stdio: "inherit" }
    );
    // Шестой на том же сервере — ЖИВАЯ половина долга 79: страница цен,
    // запрошенная под User-Agent нативной оболочки, не имеет права
    // отдавать ни одной формы `action="/api/checkout"` и ни одного
    // упоминания домена stripe.com. Здесь, а не отдельным шагом, по той
    // же причине, что и соседи: сервер уже поднят, сборка уже своя.
    //
    // Статическую половину того же сторожа гоняет
    // `npm run check:native-payments` в `verify` и в `ci.yml` — она
    // дешёвая и сервера не требует. Разделение то же, что у `check:404`.
    //
    // ТРИ РОЛИ, И ПОЭТОМУ СВОЙ СЕРВЕР. Разбор — у объявления ROLES_PORT
    // выше и в шапке самого сторожа. Поднимается здесь, гасится сразу
    // после двух прогонов: держать два `next start` рядом с Chromium всю
    // дорогу незачем.
    const rolesServer = spawnServer(ROLES_PORT, { E2E_TEST_SEED: "1" });
    let nativePayments = { status: 1 };
    let nativePaymentsPlant = { status: 1 };
    try {
      if (!(await waitForServer(90_000, ROLES_BASE))) {
        console.error(
          `ОТКАЗ: сервер ролей на ${ROLES_BASE} не поднялся. Живая половина check:native-payments ` +
            `без него судила бы одну роль из трёх — ровно то, чем и был долг 184. Вывод сервера:\n` +
            rolesServer.log.slice(-800),
        );
      } else {
        nativePayments = spawnSync(
          process.execPath,
          ["scripts/check-native-payments.mjs", `--base=${ROLES_BASE}`],
          { stdio: "inherit" }
        );
        // Обязательная вторая половина: в нативную отдачу КАЖДОЙ роли
        // подсаживается кнопка покупки, и сторож обязан упасть. Без неё
        // «0 форм» значило бы «измеритель ничего не ищет».
        nativePaymentsPlant = spawnSync(
          process.execPath,
          ["scripts/check-native-payments.mjs", `--base=${ROLES_BASE}`, "--plant"],
          { stdio: "inherit" }
        );
      }
    } finally {
      stopServer(rolesServer);
    }
    // Седьмым и восьмым на том же сервере — долг 161: ни один прижатый к
    // низу окна слой не накрывает орган, до которого человек обязан
    // добраться. Здесь, а не отдельным шагом, по той же причине, что и
    // соседи: сервер уже поднят, браузер уже установлен, сборка своя.
    //
    // `--ci` пробрасывается: на пустой базе CI страницы с содержимым
    // (кроссворд, рассказ) отдают 404, и меряется только то, что живёт
    // без строк. Правила от этого не слабеют — нижняя панель есть на
    // КАЖДОЙ странице сайта.
    const bottomInset = spawnSync(
      process.execPath,
      ["scripts/check-bottom-inset.mjs", `--base=${BASE}`, ...passthrough],
      { stdio: "inherit" }
    );
    // Обязательная вторая половина (PROGRESS.md 4.1): полоса, прижатая к
    // низу МИМО общего учёта, обязана уронить сторож — и по правилу
    // учёта, и по правилу перекрытия.
    const bottomInsetPlant = spawnSync(
      process.execPath,
      ["scripts/check-bottom-inset.mjs", `--base=${BASE}`, "--plant", ...passthrough],
      { stdio: "inherit" }
    );
    // Девятым на том же сервере — долг 173, часть 2, пункт 2: оболочка
    // обязана показать страницу, а не пустоту, и её экран ошибки обязан
    // быть на языке устройства без единой английской строки. Здесь, а не
    // отдельным шагом, по той же причине, что и соседи: сервер уже поднят,
    // браузер уже установлен, сборка своя.
    //
    // Подсадки у этой проверки ВСТРОЕННЫЕ (четыре), отдельного
    // `--plant`-прогона нет: три из них живут внутри одного открытия
    // страницы, и выносить их в отдельный процесс значило бы поднимать
    // браузер второй раз за тем же самым.
    const nativeShellRender = spawnSync(
      process.execPath,
      ["scripts/check-native-shell-render.mjs", `--base=${BASE}`, ...passthrough],
      { stdio: "inherit" }
    );
    return (
      (nativeShellRender.status ?? 1) ||
      (bottomInset.status ?? 1) ||
      (bottomInsetPlant.status ?? 1) ||
      (run.status ?? 1) ||
      (layout.status ?? 1) ||
      (links.status ?? 1) ||
      (linksPlant.status ?? 1) ||
      (notFound.status ?? 1) ||
      (nativePayments.status ?? 1) ||
      (nativePaymentsPlant.status ?? 1)
    );
  } finally {
    stop();
  }
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main()
    .then((code) => {
      // Explicit exit, not a drained event loop. This is the belt to the
      // process-group kill's braces: even if some handle outlives the
      // server, the step still ends and CI moves on.
      process.exit(code);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
