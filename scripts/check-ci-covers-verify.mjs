// Каждая проверка из `npm run verify` обязана стоять на пути мержа.
//
// ЦЕНА, ЗАПЛАЧЕННАЯ 08.09.2026. `npm run verify` был КРАСНЫМ на `main` и
// прожил так незамеченным: `check:brand` входит в verify и не входил в
// `ci.yml`, поэтому PR #220 прошёл CI зелёным с красной проверкой внутри.
// Свести это к одному правилу можно двумя способами — либо CI гоняет
// целиком `npm run verify`, либо расхождение названо ПОИМЁННО и у каждой
// строки написана причина. Выбран второй: verify поднимает сервер и
// открывает браузер, в CI это отдельное задание со своим кэшем, и гнать
// его на каждый коммит промежуточной ветки никто не хочет.
//
// ОТСЮДА ПРАВИЛО, которое сторожит этот файл:
//
//   команда, которую запускает `npm run verify`, обязана либо
//   запускаться в `.github/workflows/ci.yml`, либо стоять в списке
//   исключений в PROGRESS.md — с причиной.
//
// И обратная половина, без которой список гниёт: исключение, которое
// БОЛЬШЕ не нужно (команда уже в CI) или которое не относится ни к чему
// (команды нет в verify), — тоже падение. Список исключений, в котором
// лежит неправда, хуже отсутствующего.
//
// ВТОРОЕ НАПРАВЛЕНИЕ, ЗАВЕДЁННОЕ 09.09.2026 (долг 106). Правило выше
// проверяло ОДНО направление — что CI покрывает `verify`. Обратное
// (шаги CI, которых в `verify` нет) не печаталось нигде, и цена этому
// названа числом: PR #238 прошёл `npm run verify` зелёным локально и
// покраснел в CI на юнит-тесте, потому что `verify` юнит-тестов не
// запускал вовсе. Замер до правки: в CI гонялось 8 команд, которых нет
// в `verify` (`test`, `test:e2e`, `check:tokens`, `check:rendered:ci`,
// `check:e2e-coverage:run` и три `:plant`), и ни одна из них не была
// названа нигде. Отсюда симметричное правило:
//
//   команда, которую запускает `.github/workflows/ci.yml`, обязана либо
//   запускаться в `npm run verify`, либо стоять во ВТОРОМ списке
//   исключений в PROGRESS.md — с причиной.
//
// Обе половины обратного списка тоже стерегутся: исключение на команду,
// которая уже гоняется в `verify`, и исключение на команду, которой нет
// в CI, — падение.
//
//   node scripts/check-ci-covers-verify.mjs            # гейт
//   node scripts/check-ci-covers-verify.mjs --map      # вся карта проверок
//   node scripts/check-ci-covers-verify.mjs --plant    # позитивный контроль
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PROGRESS_MARKER_START = "<!-- ci-verify-exceptions:start -->";
const PROGRESS_MARKER_END = "<!-- ci-verify-exceptions:end -->";
// Второй список — обратного направления: шаги CI, которых намеренно нет
// в `npm run verify`.
const VERIFY_MARKER_START = "<!-- verify-ci-exceptions:start -->";
const VERIFY_MARKER_END = "<!-- verify-ci-exceptions:end -->";

function main() {
  const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
  const scripts = pkg.scripts;

  /** Файл, который запускает команда npm, и её флаги. Сравнение по ФАЙЛУ, а
   * не по имени npm-скрипта, нужно там, где команду запускают в обход имени:
   * `npm run build` зовёт `tsx scripts/check-stripe-env-shape.ts` напрямую, а
   * `verify-rendered.mjs` — три проверки подряд своим spawn'ом. */
  function invocationOf(command) {
    const file = command.match(/(?:scripts|prisma)\/[\w.-]+\.(?:mjs|ts)/);
    const flags = (command.match(/--[\w-]+(?:=[^\s]+)?/g) ?? []).sort();
    return file ? { file: file[0], flags } : null;
  }

  const byName = new Map(Object.entries(scripts).map(([name, command]) => [name, invocationOf(command)]));

  /** Проверки, которые запускает обёртка, — прочитаны из её текста, а не
   * записаны сюда руками: список в комментарии протух бы первым. */
  function wrapperTargets(file) {
    const text = readFileSync(file, "utf-8");
    return [...text.matchAll(/["'`](scripts\/[\w.-]+\.(?:mjs|ts))["'`]/g)].map((m) => m[1]);
  }

  const WRAPPERS = new Map([["scripts/verify-rendered.mjs", wrapperTargets("scripts/verify-rendered.mjs")]]);

  /** Флаги, которые меняют ЦЕЛЬ проверки, а не её строгость: с ними это
   * прогон против живого прода или боевой базы, и никакая обёртка его за
   * собой не тянет. Такие имена засчитываются только по точному совпадению
   * имени команды, никогда по файлу. */
  const EXTERNAL_TARGET_FLAGS = ["--base", "--against-prod", "--from-sitemap"];

  /** Флаги позитивного контроля: прогон с ними доказывает, что проверка
   * умеет краснеть, но САМОЙ проверкой не является. */
  const CONTROL_FLAGS = ["--plant", "--self-test"];

  /** Все имена npm-скриптов, которые исполнятся, если запустить `command`.
   *
   * Три способа попасть в множество, и они не равны по строгости:
   *
   *   1. `npm run имя` — имя названо прямо;
   *   2. прямой запуск файла (`npm run build` зовёт
   *      `tsx scripts/check-stripe-env-shape.ts`) — засчитываются имена с
   *      ТЕМ ЖЕ файлом, чьи флаги являются подмножеством запуска, иначе
   *      прогон `--plant`-варианта засчитывался бы за основную проверку;
   *   3. цель обёртки (`verify-rendered.mjs` спавнит три проверки) — здесь
   *      флаги НЕ сравниваются, потому что обёртка собирает свой набор
   *      (`--base` она вычисляет, `--require-content` не передаёт вовсе), и
   *      требовать совпадения значило бы объявить непокрытым то, что
   *      заведомо гоняется. Поблажка названа, а не спрятана.
   */
  function expand(command, seen = new Set()) {
    for (const m of command.matchAll(/npm run ([\w:-]+)/g)) {
      const name = m[1];
      if (seen.has(name)) continue;
      seen.add(name);
      if (scripts[name]) expand(scripts[name], seen);
    }

    const invokedFlags = new Set((command.match(/--[\w-]+/g) ?? []));
    const direct = [...command.matchAll(/(?:scripts|prisma)\/[\w.-]+\.(?:mjs|ts)/g)].map((m) => m[0]);
    const wrapped = new Set();
    for (const f of direct) if (WRAPPERS.has(f)) for (const t of WRAPPERS.get(f)) wrapped.add(t);

    for (const [name, inv] of byName) {
      if (!inv || seen.has(name)) continue;
      const nameFlags = inv.flags.map((f) => f.split("=")[0]);
      if (nameFlags.some((f) => EXTERNAL_TARGET_FLAGS.includes(f))) continue;
      if (wrapped.has(inv.file)) { seen.add(name); continue; }
      // Подмножества флагов мало: запуск с флагом КОНТРОЛЯ — это не
      // прогон проверки. Стоит поставить в CI один `npm run x:plant` — и
      // `x` с пустым набором флагов оказывался подмножеством `{--plant}`,
      // то есть засчитывался за прогнанный, ни разу не прогнавшись.
      // Найдено 08.09.2026 при попытке поставить в CI только контроль.
      // Флаги, меняющие лишь форму отчёта (`--report=`, `--ci`), такой
      // силы не имеют и покрытие по-прежнему дают: `check:e2e-coverage:run`
      // и `check:rendered:ci` — те же проверки, а не их контроли.
      const controlOnly = [...invokedFlags].some((f) => CONTROL_FLAGS.includes(f) && !nameFlags.includes(f));
      if (direct.includes(inv.file) && !controlOnly && nameFlags.every((f) => invokedFlags.has(f))) seen.add(name);
    }
    return seen;
  }

  const verifyRuns = expand(scripts.verify);

  const ciText = readFileSync(".github/workflows/ci.yml", "utf-8");
  const ciCommands = [...ciText.matchAll(/run:\s*(.+)/g)].map((m) => m[1].trim());
  const ciRuns = new Set();
  for (const command of ciCommands) for (const name of expand(command)) ciRuns.add(name);

  const progress = readFileSync("PROGRESS.md", "utf-8");
  function exceptionsBetween(start, end) {
    const block = progress.split(start)[1]?.split(end)[0] ?? "";
    const map = new Map();
    for (const line of block.split("\n")) {
      const m = line.match(/^\s*[-*]\s*`([\w:-]+)`\s*[—-]\s*(.+?)\s*$/);
      if (m) map.set(m[1], m[2]);
    }
    return map;
  }
  const exceptions = exceptionsBetween(PROGRESS_MARKER_START, PROGRESS_MARKER_END);
  const verifyExceptions = exceptionsBetween(VERIFY_MARKER_START, VERIFY_MARKER_END);

  const checkNames = Object.keys(scripts).filter((n) => n.startsWith("check:"));
  const VARIANT_SUFFIXES = [":plant", ":self-test", ":map"];
  const named = checkNames.filter((n) => !VARIANT_SUFFIXES.some((suffix) => n.endsWith(suffix)));

  if (process.argv.includes("--map")) {
    console.log(`| команда | verify | CI | исключение |`);
    console.log(`|---|---|---|---|`);
    for (const name of named.sort()) {
      console.log(
        `| \`${name}\` | ${verifyRuns.has(name) ? "да" : "—"} | ${ciRuns.has(name) ? "да" : "—"} | ${exceptions.has(name) ? exceptions.get(name) : "—"} |`,
      );
    }
    console.log(
      `\nвсего check:* (без :plant/:self-test): ${named.length}; в verify: ${named.filter((n) => verifyRuns.has(n)).length}; в CI: ${named.filter((n) => ciRuns.has(n)).length}; нигде: ${named.filter((n) => !verifyRuns.has(n) && !ciRuns.has(n)).length}`,
    );
    // Второе направление печатается ЦЕЛИКОМ, а не по префиксу check:, —
    // ровно потому, что долг 106 был про `npm run test`, у которого
    // такого префикса нет.
    const ciOnly = [...ciRuns].filter((n) => !verifyRuns.has(n)).sort();
    console.log(`\n| в CI, нет в verify | исключение |`);
    console.log(`|---|---|`);
    for (const name of ciOnly) console.log(`| \`${name}\` | ${verifyExceptions.get(name) ?? "—"} |`);
    console.log(`\nвсего команд: verify ${verifyRuns.size}, CI ${ciRuns.size}; в CI и не в verify: ${ciOnly.length}, из них названо исключениями: ${ciOnly.filter((n) => verifyExceptions.has(n)).length}`);
  }

  function audit(verifySet, ciSet, exceptionMap, ciOnlyExceptionMap = verifyExceptions) {
    const uncovered = [...verifySet].filter((n) => !ciSet.has(n) && !exceptionMap.has(n)).sort();
    const stale = [...exceptionMap.keys()].filter((n) => ciSet.has(n) || !verifySet.has(n)).sort();
    // Второе направление, симметрично первому.
    const unverified = [...ciSet].filter((n) => !verifySet.has(n) && !ciOnlyExceptionMap.has(n)).sort();
    const staleCiOnly = [...ciOnlyExceptionMap.keys()]
      .filter((n) => verifySet.has(n) || !ciSet.has(n))
      .sort();
    return { uncovered, stale, unverified, staleCiOnly };
  }

  if (process.argv.includes("--plant")) {
    console.log("check:ci-covers-verify --plant");
    let caught = 0;
    const plants = [
      {
        name: "команда verify вынута из ci.yml и не внесена в исключения",
        run: () => {
          const victim = [...verifyRuns].find((n) => ciRuns.has(n) && !exceptions.has(n));
          const ci = new Set(ciRuns);
          ci.delete(victim);
          return { hit: audit(verifyRuns, ci, exceptions).uncovered.includes(victim), what: victim };
        },
      },
      {
        name: "исключение осталось на команду, которая уже в CI",
        run: () => {
          const victim = [...verifyRuns].find((n) => ciRuns.has(n));
          const ex = new Map(exceptions);
          ex.set(victim, "выдуманная причина");
          return { hit: audit(verifyRuns, ciRuns, ex).stale.includes(victim), what: victim };
        },
      },
      {
        name: "исключение на команду, которой в verify нет вовсе",
        run: () => {
          const ex = new Map(exceptions);
          ex.set("check:media-embeds", "выдуманная причина");
          return { hit: audit(verifyRuns, ciRuns, ex).stale.includes("check:media-embeds"), what: "check:media-embeds" };
        },
      },
      // Три подсадки ниже — второе направление (долг 106). Первая из них
      // изображает ровно то, что 09.09.2026 стоило красного CI на PR #238:
      // шаг CI, которого в `verify` нет и который нигде не назван.
      {
        name: "шаг CI вынут из verify и не внесён во второй список исключений",
        run: () => {
          const victim = [...ciRuns].find((n) => verifyRuns.has(n) && !verifyExceptions.has(n));
          const v = new Set(verifyRuns);
          v.delete(victim);
          return { hit: audit(v, ciRuns, exceptions).unverified.includes(victim), what: victim };
        },
      },
      {
        name: "исключение второго списка на команду, которая уже в verify",
        run: () => {
          const victim = [...ciRuns].find((n) => verifyRuns.has(n));
          const ex = new Map(verifyExceptions);
          ex.set(victim, "выдуманная причина");
          return { hit: audit(verifyRuns, ciRuns, exceptions, ex).staleCiOnly.includes(victim), what: victim };
        },
      },
      {
        name: "исключение второго списка на команду, которой в CI нет вовсе",
        run: () => {
          const ex = new Map(verifyExceptions);
          ex.set("check:media-embeds", "выдуманная причина");
          return {
            hit: audit(verifyRuns, ciRuns, exceptions, ex).staleCiOnly.includes("check:media-embeds"),
            what: "check:media-embeds",
          };
        },
      },
    ];
    for (const p of plants) {
      const { hit, what } = p.run();
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"}: ${p.name} (${what})`);
      if (hit) caught += 1;
    }
    // Отрицательная половина: без подсадки прогон обязан быть чистым, иначе
    // «поймано» выше означало бы просто вечно красную проверку.
    const clean = audit(verifyRuns, ciRuns, exceptions);
    const quiet =
      clean.uncovered.length === 0 &&
      clean.stale.length === 0 &&
      clean.unverified.length === 0 &&
      clean.staleCiOnly.length === 0;
    console.log(`  ${quiet ? "отрицательный контроль: без подсадки чисто" : "ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН — сначала почини настоящее расхождение"}`);
    console.log(`  поймано ${caught} из ${plants.length}`);
    process.exit(caught === plants.length && quiet ? 0 : 1);
  }

  const { uncovered, stale, unverified, staleCiOnly } = audit(verifyRuns, ciRuns, exceptions);
  if (uncovered.length === 0 && stale.length === 0 && unverified.length === 0 && staleCiOnly.length === 0) {
    console.log(
      `check:ci-covers-verify — verify запускает ${verifyRuns.size} команд, CI ${ciRuns.size}; ` +
        `в CI и не в verify ${[...ciRuns].filter((n) => !verifyRuns.has(n)).length} (все названы), ` +
        `в verify и не в CI ${[...verifyRuns].filter((n) => !ciRuns.has(n)).length} (все названы); ` +
        `исключений ${exceptions.size} + ${verifyExceptions.size}, непокрытых 0 в обе стороны.`,
    );
    process.exit(0);
  }
  for (const name of uncovered) {
    console.error(`НЕПОКРЫТО: \`${name}\` есть в verify, нет в ci.yml и нет в списке исключений PROGRESS.md`);
  }
  for (const name of stale) {
    console.error(
      `ИСКЛЮЧЕНИЕ ПРОТУХЛО: \`${name}\` — ${ciRuns.has(name) ? "команда уже гоняется в CI" : "команды нет в verify"}`,
    );
  }
  for (const name of unverified) {
    console.error(
      `НЕ В VERIFY: \`${name}\` гоняется в ci.yml, не гоняется в npm run verify и не назван во втором списке исключений PROGRESS.md`,
    );
  }
  for (const name of staleCiOnly) {
    console.error(
      `ИСКЛЮЧЕНИЕ ВТОРОГО СПИСКА ПРОТУХЛО: \`${name}\` — ${verifyRuns.has(name) ? "команда уже гоняется в verify" : "команды нет в CI"}`,
    );
  }
  console.error(
    `\nСписок исключений живёт в PROGRESS.md между ${PROGRESS_MARKER_START} и ${PROGRESS_MARKER_END}, ` +
      `обратный — между ${VERIFY_MARKER_START} и ${VERIFY_MARKER_END}; строка вида "- \`имя\` — причина".`,
  );
  process.exit(1);

}

// Ничего при импорте: этот файл читает `src/lib/entry-point.test.ts`, и
// сторож там существует именно затем, чтобы скрипт с `process.exit` внутри
// нельзя было случайно запустить чужим импортом.
const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) main();
