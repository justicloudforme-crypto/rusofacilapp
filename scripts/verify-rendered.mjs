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
/** Путь к `tsx` — тем же способом, каким его зовёт проверка ссылок ниже. */
const TSX = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
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
    /**
     * ТЯЖЁЛАЯ ПЕРЕПИСЬ ПЛАТНЫХ ПОВЕРХНОСТЕЙ УЕЗЖАЕТ В СВОЁ ЗАДАНИЕ — 7.196, ч. 5.
     *
     * Она одна занимает ~38 минут из 44 у этого шага (132 адреса × 3 роли,
     * ~2200 нажатий), и из-за неё шаг ходил впритык к предохранителю: PR
     * #316 был срезан на 390 экранах из 396. В CI её теперь гоняет
     * отдельное задание из трёх долей, идущих параллельно
     * (`scripts/verify-purchase-surfaces.mjs`), и этот флаг говорит, что
     * повторять её здесь незачем.
     *
     * ЛОКАЛЬНЫЙ `npm run verify` флага не передаёт и гоняет всё целиком:
     * там параллелить не по чему, а полнота важнее минут.
     */
    const skipPurchases = process.argv.includes("--no-purchase-census");
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
    let renderedPurchases = { status: 1 };
    let renderedPurchasesPlant = { status: 1 };
    let stallPlant = { status: 1 };
    let stallHealthy = { status: 1 };
    let accessSigns = { status: 1 };
    let accessSignsPlant = { status: 1 };
    let signedOut = { status: 1 };
    let signedOutPlant = { status: 1 };
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
        // ДОЛГ 191. Третья и четвёртая на ЭТОМ ЖЕ сервере ролей —
        // отрисованный экран. Половина по http судит ОТВЕТ СЕРВЕРА, и
        // кнопки, которую владелец нашёл в словаре, в этом ответе нет
        // вовсе: её рисует клиент после `/api/flashcards` и после одного
        // нажатия на плитку темы. Замер: 0 платных органов на открытии, 1
        // после нажатия.
        renderedPurchases = skipPurchases
          ? { status: 0 }
          : spawnSync(
              process.execPath,
              ["scripts/check-rendered-purchase-surfaces.mjs", `--base=${ROLES_BASE}`],
              { stdio: "inherit" }
            );
        // Обязательная вторая половина: кнопка покупки БЕЗ АДРЕСА,
        // подсаженная в уже отрисованный документ, обязана уронить прибор
        // в каждой из трёх ролей. Гоняется по короткому срезу адресов —
        // подсадка живёт на КАЖДОМ экране, и платить за неё 132 адресами
        // значит платить за одно и то же.
        // ПОДСАДКА ГОНЯЕТСЯ ВСЕГДА, включая `--no-purchase-census`.
        //
        // Живая половина в CI уехала в задание долей, а подсадка осталась
        // здесь, и это не недосмотр: она не делится на доли по смыслу
        // (живёт на КАЖДОМ экране, ей хватает среза из четырёх адресов),
        // стоит здесь секунды и в задании долей дважды повисла до
        // предохранителя. Без неё «0 платных органов» значило бы
        // «измеритель ничего не ищет» — правило 4.1.
        renderedPurchasesPlant = spawnSync(
          process.execPath,
          ["scripts/check-rendered-purchase-surfaces.mjs", `--base=${ROLES_BASE}`, "--plant", "--limit=4"],
          { stdio: "inherit" }
        );
        /**
         * СЕДЬМАЯ И ВОСЬМАЯ — ДВУСТОРОННИЙ СТОРОЖ МОЛЧАЩЕГО ЭКРАНА (7.201).
         *
         * ЗАЧЕМ. Заход 7.201 разбирал красную долю 3/3, где `/ru/account`
         * под гостем «не ответил за 240 с». Причина была в СТРАНИЦЕ
         * (`/[lang]/profile` отдавал гостю 200 с `<meta refresh>` вместо
         * 307), и она убрана. Но утверждение «здоровый экран молчит в
         * отчёте» без второй половины ничего не стоит: так же молчал бы
         * прибор, который зависаний не ловит вовсе.
         *
         * ПОЛОЖИТЕЛЬНАЯ ПОЛОВИНА: на `/ru/account` подсаживается настоящий
         * бесконечный цикл в главном потоке, и прибор обязан назвать этот
         * экран молчащим в КАЖДОЙ из трёх ролей. ОТРИЦАТЕЛЬНАЯ: тот же
         * адрес без подсадки обязан пройти без единого молчащего экрана —
         * то есть починка страницы проверяется тем же прибором, что её
         * нашёл. Цена: подсадка упирается в срок переписи (30 с), здоровый
         * срез — секунды. Оба гоняются ВСЕГДА, включая `--no-purchase-census`.
         */
        stallPlant = spawnSync(
          process.execPath,
          ["scripts/check-rendered-purchase-surfaces.mjs", `--base=${ROLES_BASE}`, "--paths=/ru/account", "--stall=/ru/account"],
          { stdio: "inherit" }
        );
        stallHealthy = spawnSync(
          process.execPath,
          ["scripts/check-rendered-purchase-surfaces.mjs", `--base=${ROLES_BASE}`, "--paths=/ru/account"],
          { stdio: "inherit" }
        );
        // ПЯТАЯ И ШЕСТАЯ на том же сервере ролей — 7.196, часть 1: знак
        // платного на отрисованном экране сверяется с ОБЩИМ правилом
        // (`accessSignFor`), а подсадка «замок вместо короны и наоборот»
        // обязана уронить КАЖДУЮ поверхность переписи. Роль `premium`
        // здесь обязательна: без неё утверждение «коронованное открыто»
        // доказывалось бы ролью, у которой открыто не всё.
        accessSigns = spawnSync(
          process.execPath,
          [TSX, "scripts/check-access-signs.ts", `--base=${ROLES_BASE}`, ...passthrough],
          { stdio: "inherit" }
        );
        accessSignsPlant = spawnSync(
          process.execPath,
          [TSX, "scripts/check-access-signs.ts", `--base=${ROLES_BASE}`, "--plant", ...passthrough],
          { stdio: "inherit" }
        );
        // СЕДЬМАЯ И ВОСЬМАЯ на том же сервере ролей — 7.198, часть 1:
        // после выхода не остаётся ни сессии, ни личной копии страницы.
        // Сервер ролей здесь обязателен по той же причине, что и у
        // соседей: без `E2E_TEST_SEED=1` завести настоящий аккаунт нечем,
        // а без аккаунта в кеше не появится ни одной личной копии — и
        // «личных копий 0» означало бы пустой прибор, а не чистый кеш.
        //
        // Подсадок две, и они РАЗНЫЕ намеренно: «кука уцелела» и
        // «страница пришла из кеша» — два разных дефекта, и одна проверка
        // на оба случая не годится.
        signedOut = spawnSync(
          process.execPath,
          ["scripts/check-signed-out.mjs", `--base=${ROLES_BASE}`],
          { stdio: "inherit" }
        );
        signedOutPlant = spawnSync(
          process.execPath,
          ["scripts/check-signed-out.mjs", `--base=${ROLES_BASE}`, "--plant"],
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
    // ДОЛГ 154, заход 7.212: ревизия шапки, подвала и нижней панели на
    // вопрос «имеет ли это смысл внутри оболочки». Оба места — веб и
    // оболочка — открываются в одном прогоне, потому что утверждение у
    // сторожа парное: ноль в оболочке значит что-то только тогда, когда
    // в вебе не ноль.
    const shellSurfaces = spawnSync(
      TSX,
      ["scripts/check-shell-surfaces.ts", `--base=${BASE}`, ...passthrough],
      { stdio: "inherit" }
    );
    const shellSurfacesPlant = spawnSync(
      TSX,
      ["scripts/check-shell-surfaces.ts", `--base=${BASE}`, "--plant", ...passthrough],
      { stdio: "inherit" }
    );
    // ДОЛГ 82, заход 7.212: плавающая кнопка не ложится на органы
    // управления. Здесь же, на том же сервере, по той же причине, что и
    // соседи. `--ci` пробрасывается: на пустой базе CI каталог рассказов
    // короче, и пол замеров опускается — но каждый найденный замер
    // судится полностью.
    const floatOverlap = spawnSync(
      process.execPath,
      ["scripts/check-float-overlap.mjs", `--base=${BASE}`, ...passthrough],
      { stdio: "inherit" }
    );
    // Позитивный контроль: кнопка возвращается на все ширины — ровно
    // поведение до 7.212, — и перекрытия обязаны найтись.
    const floatOverlapPlant = spawnSync(
      process.execPath,
      ["scripts/check-float-overlap.mjs", `--base=${BASE}`, "--plant", ...passthrough],
      { stdio: "inherit" }
    );
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
    // Девятым и десятым на том же сервере — 7.198, часть 2: безопасные
    // поля переживают ЛЮБОЙ переход, а не только загрузку документа.
    // Проверка браузерная и здесь, а не отдельным шагом, по той же
    // причине, что и соседи: сервер уже поднят, браузер уже установлен.
    //
    // Она НЕ ПИШЕТ свою копию подстановки: строка достаётся текстом из
    // `MainActivity.java` и исполняется как есть. Поэтому проверяется
    // ровно то, что поедет в пакет, а не пересказ.
    const safeInsets = spawnSync(
      process.execPath,
      ["scripts/check-safe-area-insets.mjs", `--base=${BASE}`, ...passthrough],
      { stdio: "inherit" }
    );
    const safeInsetsPlant = spawnSync(
      process.execPath,
      ["scripts/check-safe-area-insets.mjs", `--base=${BASE}`, "--plant", ...passthrough],
      { stdio: "inherit" }
    );
    // Одиннадцатым и двенадцатым — 7.198, часть 3 «а»: выбранный
    // язык переживает перезапуск. «Перезапуск» моделируется закрытием
    // контекста и подъёмом нового из его же `storageState` — это ровно
    // то, что webview поднимает с диска при следующем запуске.
    const rememberedLocale = spawnSync(
      process.execPath,
      ["scripts/check-remembered-locale.mjs", `--base=${BASE}`, ...passthrough],
      { stdio: "inherit" }
    );
    const rememberedLocalePlant = spawnSync(
      process.execPath,
      ["scripts/check-remembered-locale.mjs", `--base=${BASE}`, "--plant", ...passthrough],
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
    // Десятым и одиннадцатым — 7.196, часть 2: число на плитке темы равно
    // пересечению «уровень × тема» ПО БАЗЕ, и «0 слов» не мелькает, пока
    // едет ответ. Сверка идёт с базой, а не с тем же API, которое рисует
    // экран.
    const tiles = spawnSync(
      process.execPath,
      [TSX, "scripts/check-dictionary-tiles.ts", `--base=${BASE}`, ...passthrough],
      { stdio: "inherit" }
    );
    const tilesPlant = spawnSync(
      process.execPath,
      [TSX, "scripts/check-dictionary-tiles.ts", `--base=${BASE}`, "--plant", ...passthrough],
      { stdio: "inherit" }
    );
    // Двенадцатым — 7.196, часть 4: на `/ru` в каталоге рассказов и в
    // колоде «Перед первым уроком» нет ни одной испанской строки.
    // Позитивный контроль у этой проверки серверу не нужен и гоняется
    // отдельно в `verify` (`check:ru-spanish:plant`).
    const ruSpanish = spawnSync(
      process.execPath,
      [TSX, "scripts/check-ru-locale-spanish.ts", `--base=${BASE}`, ...passthrough],
      { stdio: "inherit" }
    );
    return (
      (accessSigns.status ?? 1) ||
      (accessSignsPlant.status ?? 1) ||
      (tiles.status ?? 1) ||
      (tilesPlant.status ?? 1) ||
      (ruSpanish.status ?? 1) ||
      (nativeShellRender.status ?? 1) ||
      (shellSurfaces.status ?? 1) ||
      (shellSurfacesPlant.status ?? 1) ||
      (floatOverlap.status ?? 1) ||
      (floatOverlapPlant.status ?? 1) ||
      (bottomInset.status ?? 1) ||
      (bottomInsetPlant.status ?? 1) ||
      (safeInsets.status ?? 1) ||
      (safeInsetsPlant.status ?? 1) ||
      (rememberedLocale.status ?? 1) ||
      (rememberedLocalePlant.status ?? 1) ||
      (signedOut.status ?? 1) ||
      (signedOutPlant.status ?? 1) ||
      (run.status ?? 1) ||
      (layout.status ?? 1) ||
      (links.status ?? 1) ||
      (linksPlant.status ?? 1) ||
      (notFound.status ?? 1) ||
      (nativePayments.status ?? 1) ||
      (nativePaymentsPlant.status ?? 1) ||
      (renderedPurchases.status ?? 1) ||
      (renderedPurchasesPlant.status ?? 1) ||
      (stallPlant.status ?? 1) ||
      (stallHealthy.status ?? 1)
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
