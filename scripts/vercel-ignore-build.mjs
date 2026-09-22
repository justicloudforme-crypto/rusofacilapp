#!/usr/bin/env node
/**
 * Vercel "Ignored Build Step": decides whether a commit is worth building.
 *
 * Wire it up in Vercel → Project → Settings → Git → Ignored Build Step:
 *
 *     node scripts/vercel-ignore-build.mjs
 *
 * Exit codes are Vercel's, and they are backwards from the usual convention:
 *   exit 0 → SKIP the build   (Vercel: "the build can be ignored")
 *   exit 1 → BUILD            (Vercel: "proceed")
 *
 * WHY THIS EXISTS. Measured over 2026-08-23 → 2026-08-31: 311 deployments,
 * 597 build-minutes, $13.59 of the $20 included Pro credit — 82% of everything
 * spent. Of those 311, **52 built nothing but Markdown** (100.8 minutes,
 * ≈$2.29): PROGRESS.md is edited at the end of nearly every round, and every
 * such edit currently recompiles 413 pages to ship a file the site does not
 * serve. This script is the cheapest of the levers because it costs no change
 * in how anybody works.
 *
 * THE RULE, and it is deliberately timid. A build is skipped only when EVERY
 * changed path in the range is on the allowlist below. Anything unrecognised,
 * any error, any inability to work out the range — build. A wrongly skipped
 * build leaves production one commit stale with a green checkmark on it,
 * which is a far worse failure than a wasted two minutes, so every uncertain
 * case resolves towards spending the money.
 *
 * CONSEQUENCE WORTH KNOWING BEFORE TURNING THIS ON. A skipped deployment shows
 * as "Canceled" in Vercel and the previous deployment stays live. That means
 * `sentry-release` on the live site will legitimately lag `git rev-parse HEAD`
 * by however many docs-only commits came last — and PROGRESS.md's standing
 * instruction ("if they diverge, you are measuring someone else's deploy") is
 * written on the assumption that they never legitimately diverge. After this
 * is enabled, the check becomes: the live release must match the most recent
 * commit that touched something OUTSIDE the allowlist.
 *
 *   node scripts/vercel-ignore-build.mjs --self-test   # positive control
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

/**
 * Paths whose contents cannot change a single byte the site serves.
 *
 * Everything here is prose about the project. Notably NOT here, and not
 * eligible to be: `public/**` (served verbatim), `prisma/**` (the seed and
 * generation scripts, plus schema.prisma, which ensure-schema-sync reads at
 * build time), `e2e/**` and `**\/*.test.ts` (they do not change the site, but
 * they do change what CI checks, and a deployment that skipped its own test
 * evidence is not a saving), and `.github/**` (CI config).
 */
const DOC_PATTERNS = [
  /^PROGRESS\.md$/,
  /^AUDIT\.md$/,
  /^MOBILE\.md$/,
  /^FREEMIUM\.md$/,
  /^CLAUDE\.md$/,
  /^AGENTS\.md$/,
  /^README\.md$/,
  /^LICENSE$/,
  /^docs\/.*$/,
];

export function isDocOnlyPath(path) {
  return DOC_PATTERNS.some((pattern) => pattern.test(path));
}

/** true → nothing in this list can affect the built site. */
export function isSkippable(paths) {
  // An empty list means "we could not tell what changed", never "nothing
  // changed". Refusing to skip is the only safe reading.
  if (!Array.isArray(paths) || paths.length === 0) return false;
  return paths.every(isDocOnlyPath);
}

/**
 * Полное решение: строить или пропустить, с учётом ОКРУЖЕНИЯ выката.
 *
 * Заход 7.221, задача 1.4. До него в поле «Ignored Build Step» стояло
 *
 *     if [ "$VERCEL_ENV" == "production" ]; then exit 1; else exit 0; fi
 *
 * то есть превью не собирались никогда, а в ПРОДАКШН собирался ЛЮБОЙ мерж —
 * включая PR #382, где не менялось ничего, кроме PROGRESS.md, и который сжёг
 * 46 минут сборочного времени и всё равно упал.
 *
 * Здесь оба правила соединены, и порядок важен:
 *   1) не продакшн → пропустить (ровно прежнее поведение, ничего не
 *      сломается: превью как не собирались, так и не собираются);
 *   2) продакшн и ВСЕ изменённые пути — проза → пропустить;
 *   3) во всех остальных случаях, включая «не смогли понять, что менялось» —
 *      СТРОИТЬ. Пропущенная по ошибке сборка оставляет продакшн на коммит
 *      позади с зелёной галочкой, и это хуже потраченных двух минут.
 *
 * Возвращает "skip" | "build" — слова, а не коды Vercel, чтобы в позитивном
 * контроле нельзя было перепутать их задом наперёд.
 */
export function decide({ env, paths }) {
  if (env !== "production") return "skip";
  return isSkippable(paths) ? "skip" : "build";
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function changedPaths() {
  // VERCEL_GIT_PREVIOUS_SHA is set on every Git-triggered deployment and is
  // the commit the last deployment of this branch was built from — the right
  // base, because it makes the decision about everything that has happened
  // since something was actually built, not just since the previous commit.
  const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
  const current = process.env.VERCEL_GIT_COMMIT_SHA ?? "HEAD";
  const range = previous ? `${previous}..${current}` : `${current}^..${current}`;

  // Vercel clones shallow; the base may simply not be in the local history.
  // Try to deepen, and treat failure as "cannot tell" rather than as "empty".
  try {
    git(["diff", "--name-only", range]);
  } catch {
    try {
      git(["fetch", "--unshallow", "--quiet"]);
    } catch {
      /* already complete, or no network — the diff below decides */
    }
  }

  return git(["diff", "--name-only", range])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * ТРЕТИЙ ЯРУС САМОПРОВЕРКИ: НАСТОЯЩИЙ ПРОЦЕСС, А НЕ ЧИСТАЯ ФУНКЦИЯ.
 *
 * Два яруса выше проверяют `isSkippable` и `decide` — то есть ПРАВИЛО.
 * Они были зелёными 18 из 18 и при этом не видели дефекта, найденного
 * заходом 7.222: правило было верным, а порядок действий в `main()` — нет,
 * и процесс выходил кодом «строить» раньше, чем правило успевало сказать
 * своё слово. Поэтому здесь запускается САМ ФАЙЛ, отдельным процессом, и
 * читается его код выхода — единственное, что Vercel на самом деле видит.
 *
 * Репозиторий для прогона собирается свой, одноразовый: два коммита
 * (документный и кодовый), чтобы случаи не зависели ни от истории этого
 * репозитория, ни от глубины клона в CI.
 */
const SCRIPT_PATH = fileURLToPath(import.meta.url);

function makeScratchRepo() {
  // realpathSync НЕ украшение. На macOS `tmpdir()` отдаёт `/var/folders/…`,
  // а это симлинк на `/private/var/folders/…`. Скрипт запускается только
  // если `import.meta.url` (всегда настоящий путь) совпал с `argv[1]`, и на
  // пути через симлинк они не совпадают: подсаженная копия молча выходила
  // кодом 0, ничего не выполнив, и подсадка «проходила» пустой. Поймано
  // позитивным контролем 7.222 — вторым по счёту пустым проходом подряд.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "ignore-build-selftest-")));
  const g = (...args) =>
    execFileSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false", ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  g("init", "--quiet", "--initial-branch=main");
  writeFileSync(join(dir, "PROGRESS.md"), "проза\n");
  g("add", "-A");
  g("commit", "--quiet", "-m", "docs");
  const docsSha = g("rev-parse", "HEAD").trim();
  mkdirSync(join(dir, "src", "lib"), { recursive: true });
  writeFileSync(join(dir, "src", "lib", "plans.ts"), "export const x = 1;\n");
  writeFileSync(join(dir, "PROGRESS.md"), "проза, второй раз\n");
  g("add", "-A");
  g("commit", "--quiet", "-m", "code");
  const codeSha = g("rev-parse", "HEAD").trim();
  // Третий коммит — только проза, чтобы был диапазон «одна проза и ничего больше».
  writeFileSync(join(dir, "PROGRESS.md"), "проза, третий раз\n");
  g("add", "-A");
  g("commit", "--quiet", "-m", "docs again");
  const docsOnlySha = g("rev-parse", "HEAD").trim();
  const BOGUS = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
  return { dir, docsSha, codeSha, docsOnlySha, BOGUS };
}

/** Прогоняет указанный файл скрипта отдельным процессом и отдаёт код выхода. */
function runScript(scriptPath, cwd, env) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, VERCEL_ENV: undefined, VERCEL_GIT_PREVIOUS_SHA: undefined, VERCEL_GIT_COMMIT_SHA: undefined, ...env },
  });
  return { code: result.status, out: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() };
}

/**
 * Случаи третьего яруса. `code` — код выхода Vercel: 0 пропустить, 1 строить.
 *
 * Случай «превью, диапазон не читается» — тот самый, что до 7.222 отдавал 1.
 */
function processCases(repo) {
  const { docsSha, codeSha, docsOnlySha, BOGUS } = repo;
  return [
    {
      label: "ПРЕВЬЮ, диапазон НЕ читается (новая ветка + мелкий клон) — дефект 7.222",
      env: { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_SHA: codeSha, VERCEL_GIT_PREVIOUS_SHA: BOGUS },
      code: 0,
      guards: true,
    },
    {
      label: "ПРЕВЬЮ, VERCEL_GIT_COMMIT_SHA не задан вовсе",
      env: { VERCEL_ENV: "preview" },
      code: 0,
      guards: true,
    },
    {
      label: "ПРЕВЬЮ, коммит с кодом, диапазон читается",
      env: { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_SHA: codeSha, VERCEL_GIT_PREVIOUS_SHA: docsSha },
      code: 0,
      guards: true,
    },
    {
      label: "ПРЕВЬЮ, документный коммит",
      env: { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_SHA: docsOnlySha, VERCEL_GIT_PREVIOUS_SHA: codeSha },
      code: 0,
      guards: true,
    },
    {
      label: "ПРЕВЬЮ без имени окружения (запуск не на Vercel)",
      env: { VERCEL_GIT_COMMIT_SHA: codeSha, VERCEL_GIT_PREVIOUS_SHA: BOGUS },
      code: 0,
      guards: true,
    },
    {
      label: "ПРОДАКШН, коммит с кодом — строить (поведение 7.221)",
      env: { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: codeSha, VERCEL_GIT_PREVIOUS_SHA: docsSha },
      code: 1,
    },
    {
      label: "ПРОДАКШН, документный коммит — пропустить (поведение 7.221)",
      env: { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: docsOnlySha, VERCEL_GIT_PREVIOUS_SHA: codeSha },
      code: 0,
    },
    {
      label: "ПРОДАКШН, диапазон НЕ читается — строить",
      env: { VERCEL_ENV: "production", VERCEL_GIT_COMMIT_SHA: codeSha, VERCEL_GIT_PREVIOUS_SHA: BOGUS },
      code: 1,
    },
  ];
}

/**
 * ПОДСАДКА. Кладёт рядом копию этого же файла, из которой вырезан блок
 * между маркерами `<<<ignore-build:env-first>>>` — то есть ровно состояние
 * ДО починки 7.222 — и требует, чтобы случаи с пометкой `guards` на ней
 * ПОКРАСНЕЛИ. Сравнение «до/после» на двух пустых выборках обязано падать,
 * поэтому подсадка проверяет и то, что случаев вообще есть что ловить.
 */
function plant(repo) {
  const text = readFileSync(SCRIPT_PATH, "utf8");
  // Маркеры собираются из кусков НАМЕРЕННО. Написанные литералом, они
  // совпали бы сами с собой — `indexOf` нашёл бы их здесь, в теле подсадки,
  // раньше, чем в `main()`, и вырезал бы кусок этой самой функции вместо
  // проверяемого блока. Подсадка тогда «проходит», ничего не ломая. Так и
  // вышло при первом прогоне 7.222: восемь случаев третьего яруса зелёные,
  // подсадка не поймана — и это поймал не разбор кода, а позитивный контроль.
  const MARK_OPEN = "// <<<ignore-build:" + "env-first>>>";
  const MARK_CLOSE = "// <<<ignore-build:" + "env-first:end>>>";
  const start = text.indexOf(MARK_OPEN);
  const end = text.indexOf(MARK_CLOSE);
  if (start < 0 || end < 0 || end <= start) {
    console.error("✗ ПОДСАДКА НЕВОЗМОЖНА: маркеров `ignore-build:env-first` в файле нет.");
    console.error("  Либо блок убран, либо маркеры переименованы. Пустая подсадка ничего не доказывает.");
    return { ok: false, planted: 0, caught: 0 };
  }
  const broken = text.slice(0, start) + text.slice(end + MARK_CLOSE.length);
  const brokenPath = join(repo.dir, "vercel-ignore-build.broken.mjs");
  writeFileSync(brokenPath, broken);

  const guarded = processCases(repo).filter((c) => c.guards);
  if (guarded.length === 0) {
    console.error("✗ ПОДСАДКА ПУСТА: случаев с пометкой `guards` нет, ловить нечего.");
    return { ok: false, planted: 0, caught: 0 };
  }
  let caught = 0;
  for (const c of guarded) {
    const { code } = runScript(brokenPath, repo.dir, c.env);
    if (code !== c.code) caught++;
  }
  return { ok: caught > 0, planted: guarded.length, caught };
}

function selfTest() {
  const cases = [
    { label: "PROGRESS.md alone", paths: ["PROGRESS.md"], skip: true },
    { label: "two docs files", paths: ["PROGRESS.md", "docs/experiment-readout-2026-09-25.md"], skip: true },
    { label: "a source file alone", paths: ["src/lib/plans.ts"], skip: false },
    { label: "docs plus one source file", paths: ["PROGRESS.md", "src/lib/plans.ts"], skip: false },
    { label: "a public/ asset (served verbatim)", paths: ["public/offline.html"], skip: false },
    { label: "a seed script", paths: ["prisma/seed-glossary.ts"], skip: false },
    { label: "a CI workflow", paths: [".github/workflows/ci.yml"], skip: false },
    { label: "an e2e spec", paths: ["e2e/checkout.spec.ts"], skip: false },
    { label: "package.json", paths: ["package.json"], skip: false },
    { label: "a .md file inside src/", paths: ["src/content/note.md"], skip: false },
    { label: "an empty diff (cannot tell what changed)", paths: [], skip: false },
  ];

  let bad = 0;
  console.log("vercel-ignore-build --self-test");
  console.log("");
  for (const { label, paths, skip } of cases) {
    const got = isSkippable(paths);
    const ok = got === skip;
    if (!ok) bad++;
    console.log(`  ${ok ? "✓" : "✗"} ${skip ? "SKIP" : "BUILD"}: ${label}${ok ? "" : `  ← got ${got ? "SKIP" : "BUILD"}`}`);
  }
  console.log("");
  if (bad > 0) {
    console.error(`✗ ${bad} case(s) decided the wrong way. Do not enable this until they pass.`);
    process.exit(1);
  }
  // ВТОРОЙ ЯРУС: те же пути, но через decide(), где добавлено окружение.
  // Именно он доказывает два случая, названные заданием 7.221 поимённо.
  const envCases = [
    { label: "ПРОДАКШН, документный коммит (как PR #382)", env: "production", paths: ["PROGRESS.md"], want: "skip" },
    { label: "ПРОДАКШН, коммит с кодом", env: "production", paths: ["src/lib/plans.ts"], want: "build" },
    { label: "ПРОДАКШН, документы плюс код в одном коммите", env: "production", paths: ["PROGRESS.md", "src/app/sw.ts"], want: "build" },
    { label: "ПРОДАКШН, не смогли понять, что менялось", env: "production", paths: [], want: "build" },
    { label: "превью, коммит с кодом — как и прежде не собираем", env: "preview", paths: ["src/lib/plans.ts"], want: "skip" },
    { label: "превью, документный коммит", env: "preview", paths: ["PROGRESS.md"], want: "skip" },
    { label: "окружения нет вовсе (запуск не на Vercel)", env: undefined, paths: ["src/lib/plans.ts"], want: "skip" },
  ];
  console.log("");
  for (const { label, env, paths, want } of envCases) {
    const got = decide({ env, paths });
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? "✓" : "✗"} ${want.toUpperCase()}: ${label}${ok ? "" : `  ← получено ${got.toUpperCase()}`}`);
  }
  console.log("");
  if (bad > 0) {
    console.error(`✗ ${bad} случай(ев) решены не в ту сторону. Не включать, пока не зелено.`);
    process.exit(1);
  }
  // ТРЕТИЙ ЯРУС — настоящий процесс, настоящие коды выхода Vercel.
  const repo = makeScratchRepo();
  let processCaseCount = 0;
  let plantResult = { ok: false, planted: 0, caught: 0 };
  try {
    const pcases = processCases(repo);
    processCaseCount = pcases.length;
    console.log("");
    for (const c of pcases) {
      const { code, out } = runScript(SCRIPT_PATH, repo.dir, c.env);
      const ok = code === c.code;
      if (!ok) bad++;
      const word = c.code === 0 ? "SKIP" : "BUILD";
      console.log(`  ${ok ? "✓" : "✗"} ${word} (exit ${c.code}): ${c.label}${ok ? "" : `  ← получен exit ${code}: ${out.split("\n")[0]}`}`);
    }
    plantResult = plant(repo);
  } finally {
    rmSync(repo.dir, { recursive: true, force: true });
  }

  console.log("");
  if (!plantResult.ok) {
    console.error("✗ ПОЗИТИВНЫЙ КОНТРОЛЬ НЕ ПРОЙДЕН: подсадка «порядок как до 7.222» не поймана.");
    console.error("  Сторож, который не краснеет на заведомо сломанном файле, ничего не доказывает.");
    bad++;
  } else {
    console.log(
      `  ✓ подсадка «git раньше окружения» (состояние до 7.222): подсажено ${plantResult.planted}, ` +
        `поймано ${plantResult.caught}`,
    );
  }

  console.log("");
  if (bad > 0) {
    console.error(`✗ ${bad} случай(ев) решены не в ту сторону. Не включать, пока не зелено.`);
    process.exit(1);
  }
  // The control that matters is the negative direction: a rule that never
  // says BUILD would silently freeze production at whatever is deployed now.
  console.log(
    `Control passed: ${cases.length} + ${envCases.length} + ${processCaseCount} cases, ` +
      `${cases.filter((c) => !c.skip).length + envCases.filter((c) => c.want === "build").length + processCases(repo).filter((c) => c.code === 1).length} of them required to BUILD; ` +
      `подсадка поймана ${plantResult.caught} из ${plantResult.planted}.`,
  );
  process.exit(0);
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();

  // ОКРУЖЕНИЕ РЕШАЕТСЯ ДО ТОГО, КАК МЫ ВООБЩЕ ТРОГАЕМ GIT, И ЭТО НЕ СТИЛЬ.
  //
  // Заход 7.222, задача 0. До правки порядок был обратный: сначала
  // changedPaths(), и его `catch` выходил кодом 1 («строить») ещё до того,
  // как кто-либо спрашивал про окружение. Правило «строить, когда не
  // понимаем, что менялось» верно для ПРОДАКШНА и только для него: там
  // пропущенная сборка оставляет живой сайт на коммит позади. В превью
  // цена ошибки обратная — превью выключены с 31.08.2026 ради денег (82 %
  // счёта Vercel уходило на сборки), и «не поняли диапазон» означало бы
  // ПЛАТИТЬ за сборку, которую никто не смотрит.
  //
  // Случай не выдуманный, он прогнан: превью новой ветки не имеет
  // VERCEL_GIT_PREVIOUS_SHA, диапазон становится `SHA^..SHA`, клон на
  // Vercel мелкий, `SHA^` в нём не существует, `--unshallow` при
  // недоступном remote не спасает — и до правки процесс отдавал ровно
  // `exit 1`, то есть СТРОИЛ превью.
  //
  // Маркеры ниже читает подсадка позитивного контроля: она вырезает этот
  // блок целиком и требует, чтобы самопроверка покраснела. Не убирать.
  // <<<ignore-build:env-first>>>
  const envFirst = process.env.VERCEL_ENV;
  if (envFirst !== "production") {
    console.log(`[ignore-build] Skipping: окружение ${envFirst ?? "(нет)"}, а не production`);
    process.exit(0); // skip
  }
  // <<<ignore-build:env-first:end>>>

  let paths;
  try {
    paths = changedPaths();
  } catch (error) {
    console.log(`[ignore-build] Could not determine what changed (${error.message.split("\n")[0]}) — building.`);
    process.exit(1); // build
  }

  const env = process.env.VERCEL_ENV;
  if (decide({ env, paths }) === "skip") {
    const why =
      env !== "production"
        ? `окружение ${env ?? "(нет)"}, а не production`
        : `${paths.length} изменённых пут(и/ей), все — проза: ${paths.join(", ")}`;
    console.log(`[ignore-build] Skipping: ${why}`);
    process.exit(0); // skip
  }

  console.log(`[ignore-build] Building: ${paths.length} changed path(s), including ${paths.filter((p) => !isDocOnlyPath(p))[0] ?? "(unknown)"}`);
  process.exit(1); // build
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main();
}
