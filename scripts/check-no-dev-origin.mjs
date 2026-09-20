// АДРЕС РАЗРАБОТКИ НЕ ИМЕЕТ ПРАВА ДОЖИТЬ ДО БРАУЗЕРА — И НЕ ИМЕЕТ ПРАВА
// ОТЧИТАТЬСЯ В БОЕВОЙ SENTRY.
//
// Повод, числами. Sentry JAVASCRIPT-NEXTJS-8: TypeError «Script
// http://localhost:3100/sw.js load failed», маршрут /:lang, 2 события,
// окружение vercel-production. Порт 3100 — стенд e2e (playwright.config.ts).
//
// Сторож проверяет ТРИ утверждения, и только первое про сборку:
//
//  1. В том, что уходит в браузер (`.next/static` и `public`), нет ни
//     одного адреса вида localhost:ПОРТ / 127.0.0.1:ПОРТ / 0.0.0.0:ПОРТ
//     и ни одного http://localhost. Замер до правки: 0 совпадений —
//     значит первая версия причины («адрес утёк в сборку») неверна, и
//     утверждение заводится как ЗАМОК, чтобы оно таким и осталось.
//  2. `sentry.client.config.ts` судит хост страницы, а не только
//     переменную окружения: в нём обязан стоять `mayReportToProductionSentry`
//     из `src/lib/dev-origin.ts`. Без этого боевая сборка, запущенная с
//     localhost, снова отчитается в боевой проект.
//  3. Локальные `.env*` не содержат `VERCEL_ENV` и `NEXT_PUBLIC_VERCEL_ENV`.
//     Это дыра, названная прямым текстом в `src/lib/deploy-environment.ts`
//     («Do NOT add VERCEL_ENV to a local .env»), до сих пор державшаяся на
//     просьбе. `vercel env pull` умеет записать обе.
//
// Проверка пункта 1 требует собранного проекта, поэтому в `npm run verify`
// и в `ci.yml` она стоит ПОСЛЕ `npm run build`. Если сборки нет, сторож
// падает, а не проходит молча: «нечего проверять» и «всё чисто» — разные
// ответы (PROGRESS.md 4.1).
//
//   node scripts/check-no-dev-origin.mjs
//   node scripts/check-no-dev-origin.mjs --plant   # позитивный контроль
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");

/** Адрес разработки С ПОРТОМ — то, чем не может оказаться боевой домен. */
const DEV_ORIGIN = /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):\d{2,5}\b/g;
/** Схема плюс localhost без порта — тоже адрес разработки. */
const DEV_SCHEME = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)\b/g;

/** Расширения, которые браузер действительно исполняет или читает. */
const BROWSER_EXT = /\.(js|mjs|cjs|css|html|json|webmanifest|txt|map)$/i;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (BROWSER_EXT.test(name)) out.push(full);
  }
  return out;
}

function findIn(text) {
  return [...(text.match(DEV_ORIGIN) ?? []), ...(text.match(DEV_SCHEME) ?? [])];
}

function fail(lines) {
  console.error("");
  for (const line of lines) console.error("✗ " + line);
  console.error("");
  process.exit(1);
}

// ── 1. Собранные артефакты, уходящие в браузер ───────────────────────────
function checkBuild() {
  const roots = ["./.next/static", "./public"];
  const missing = roots.filter((r) => !existsSync(r));
  if (missing.includes("./.next/static")) {
    fail([
      "сборки нет: каталог .next/static отсутствует.",
      "Этот сторож обязан идти ПОСЛЕ `npm run build` — иначе он зелен от того, что ему нечего читать.",
    ]);
  }
  const files = roots.flatMap((r) => walk(r));
  const hits = [];
  for (const file of files) {
    const found = findIn(readFileSync(file, "utf8"));
    if (found.length) hits.push({ file, found: [...new Set(found)] });
  }
  return { files: files.length, hits };
}

// ── 2. Клиентский конфиг Sentry судит хост ───────────────────────────────
function checkSentryGate(source = readFileSync("./sentry.client.config.ts", "utf8")) {
  const problems = [];
  if (!/from\s+"\.\/src\/lib\/dev-origin"/.test(source)) {
    problems.push("sentry.client.config.ts не импортирует src/lib/dev-origin");
  }
  if (!/mayReportToProductionSentry\s*\(/.test(source)) {
    problems.push("sentry.client.config.ts не зовёт mayReportToProductionSentry(...)");
  }
  if (!/location\.hostname/.test(source)) {
    problems.push("sentry.client.config.ts не передаёт хост страницы в ворота");
  }
  return problems;
}

// ── 3. Локальные .env не открывают дыру обратно ──────────────────────────
const ENV_FILES = [".env", ".env.local", ".env.production", ".env.development", ".env.test"];
const FORBIDDEN_ENV = /^\s*(?:export\s+)?(VERCEL_ENV|NEXT_PUBLIC_VERCEL_ENV)\s*=/m;

function checkEnvFiles(read = (f) => readFileSync(f, "utf8")) {
  const problems = [];
  for (const file of ENV_FILES) {
    if (!existsSync(file)) continue;
    // Читается ТОЛЬКО имя переменной; ни одно значение отсюда не печатается.
    if (FORBIDDEN_ENV.test(read(file))) {
      problems.push(
        `${file} задаёт VERCEL_ENV или NEXT_PUBLIC_VERCEL_ENV — локальный прогон снова выглядит боевым`,
      );
    }
  }
  return problems;
}

// ── Позитивный контроль ──────────────────────────────────────────────────
function selfTest() {
  console.log("check:no-dev-origin --plant — сторож обязан покраснеть на каждой подсадке.");
  console.log("");
  let caught = 0;
  const planted = [
    {
      label: "чанк браузера с адресом стенда e2e",
      run: () => findIn('fetch("http://localhost:3100/sw.js")').length > 0,
    },
    {
      label: "чанк браузера с адресом dev-сервера",
      run: () => findIn('const base="http://127.0.0.1:3000/api"').length > 0,
    },
    {
      label: "чанк браузера с localhost без порта",
      run: () => findIn('new URL("http://localhost/sw.js")').length > 0,
    },
    {
      label: "конфиг Sentry без второй стены (только переменная окружения)",
      run: () =>
        checkSentryGate(
          'const isDeployed = Boolean(process.env.NEXT_PUBLIC_DEPLOY_ENV);\nSentry.init({ enabled: isDeployed });',
        ).length > 0,
    },
    {
      label: "конфиг Sentry зовёт правило, но хост не передаёт",
      run: () =>
        checkSentryGate(
          'import { mayReportToProductionSentry } from "./src/lib/dev-origin";\n' +
            "const isDeployed = mayReportToProductionSentry(process.env.NEXT_PUBLIC_DEPLOY_ENV, null);",
        ).length > 0,
    },
    {
      label: "локальный .env с VERCEL_ENV",
      run: () =>
        checkEnvFiles((f) => (f === ".env" ? "DATABASE_URL=x\nVERCEL_ENV=production\n" : "")).length > 0,
    },
    {
      label: "локальный .env с NEXT_PUBLIC_VERCEL_ENV",
      run: () =>
        checkEnvFiles((f) => (f === ".env" ? "NEXT_PUBLIC_VERCEL_ENV=production\n" : "")).length > 0,
    },
  ];

  // Контроль «в обратную сторону»: чистые данные обязаны проходить, иначе
  // сторож, ругающийся на всё, будет выключен на следующий день.
  const cleanHits = findIn('const base="https://rusofacilapp.com/api"; const s="localhost";');
  if (cleanHits.length > 0) {
    fail([`КОНТРОЛЬ СЛОМАН: чистый текст назван грязным (${cleanHits.join(", ")}).`]);
  }
  console.log("  ✓ чистый текст проходит (0 находок)");
  if (checkEnvFiles(() => "DATABASE_URL=x\nVERCEL_OIDC_TOKEN=y\n").length > 0) {
    fail(["КОНТРОЛЬ СЛОМАН: чистый .env назван грязным."]);
  }
  console.log("  ✓ чистый .env проходит");

  for (const { label, run } of planted) {
    if (run()) {
      caught++;
      console.log(`  ✓ поймано: ${label}`);
    } else {
      console.error(`  ✗ ПРОПУЩЕНО: ${label}`);
    }
  }
  console.log("");
  if (caught !== planted.length) {
    fail([`поймано ${caught} из ${planted.length} подсадок — сторож дырявый.`]);
  }
  console.log(`check:no-dev-origin --plant: поймано ${caught} из ${planted.length}.`);
}

function gate() {
  const build = checkBuild();
  const problems = [
    ...build.hits.map((h) => `${h.file}: ${h.found.join(", ")}`),
    ...checkSentryGate(),
    ...checkEnvFiles(),
  ];
  if (problems.length) {
    fail([
      `адрес разработки дожил до боевой сборки или до боевого наблюдения (${problems.length}):`,
      ...problems,
    ]);
  }
  console.log(
    `check:no-dev-origin: прочитано ${build.files} файлов браузерных артефактов, адресов разработки 0; ` +
      "клиентский Sentry судит хост страницы; локальные .env не задают VERCEL_ENV.",
  );
}

// Скрипт ничего не делает на импорте — правило src/lib/entry-point.test.ts.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) selfTest();
  else gate();
}
