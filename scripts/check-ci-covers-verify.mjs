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
//   node scripts/check-ci-covers-verify.mjs            # гейт
//   node scripts/check-ci-covers-verify.mjs --map      # вся карта проверок
//   node scripts/check-ci-covers-verify.mjs --plant    # позитивный контроль
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PROGRESS_MARKER_START = "<!-- ci-verify-exceptions:start -->";
const PROGRESS_MARKER_END = "<!-- ci-verify-exceptions:end -->";

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
      if (direct.includes(inv.file) && nameFlags.every((f) => invokedFlags.has(f))) seen.add(name);
    }
    return seen;
  }

  const verifyRuns = expand(scripts.verify);

  const ciText = readFileSync(".github/workflows/ci.yml", "utf-8");
  const ciCommands = [...ciText.matchAll(/run:\s*(.+)/g)].map((m) => m[1].trim());
  const ciRuns = new Set();
  for (const command of ciCommands) for (const name of expand(command)) ciRuns.add(name);

  const progress = readFileSync("PROGRESS.md", "utf-8");
  const block = progress.split(PROGRESS_MARKER_START)[1]?.split(PROGRESS_MARKER_END)[0] ?? "";
  const exceptions = new Map();
  for (const line of block.split("\n")) {
    const m = line.match(/^\s*[-*]\s*`([\w:-]+)`\s*[—-]\s*(.+?)\s*$/);
    if (m) exceptions.set(m[1], m[2]);
  }

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
  }

  function audit(verifySet, ciSet, exceptionMap) {
    const uncovered = [...verifySet].filter((n) => !ciSet.has(n) && !exceptionMap.has(n)).sort();
    const stale = [...exceptionMap.keys()].filter((n) => ciSet.has(n) || !verifySet.has(n)).sort();
    return { uncovered, stale };
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
    ];
    for (const p of plants) {
      const { hit, what } = p.run();
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"}: ${p.name} (${what})`);
      if (hit) caught += 1;
    }
    // Отрицательная половина: без подсадки прогон обязан быть чистым, иначе
    // «поймано» выше означало бы просто вечно красную проверку.
    const clean = audit(verifyRuns, ciRuns, exceptions);
    const quiet = clean.uncovered.length === 0 && clean.stale.length === 0;
    console.log(`  ${quiet ? "отрицательный контроль: без подсадки чисто" : "ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН — сначала почини настоящее расхождение"}`);
    console.log(`  поймано ${caught} из ${plants.length}`);
    process.exit(caught === plants.length && quiet ? 0 : 1);
  }

  const { uncovered, stale } = audit(verifyRuns, ciRuns, exceptions);
  if (uncovered.length === 0 && stale.length === 0) {
    console.log(
      `check:ci-covers-verify — verify запускает ${verifyRuns.size} команд, CI ${ciRuns.size}, исключений ${exceptions.size}, непокрытых 0.`,
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
  console.error(
    `\nСписок исключений живёт в PROGRESS.md между ${PROGRESS_MARKER_START} и ${PROGRESS_MARKER_END}, строкой вида "- \`check:имя\` — причина".`,
  );
  process.exit(1);

}

// Ничего при импорте: этот файл читает `src/lib/entry-point.test.ts`, и
// сторож там существует именно затем, чтобы скрипт с `process.exit` внутри
// нельзя было случайно запустить чужим импортом.
const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) main();
