// АДРЕС ДОСТУПНОСТИ ОБЯЗАН ОСТАТЬСЯ ДЕШЁВЫМ, НЕМЫМ И НЕВИДИМЫМ (7.205).
//
// Юнит-тест рядом с маршрутом (`src/app/api/health/route.test.ts`)
// отвечает на вопрос «что он отдаёт». Этот сторож отвечает на четыре
// других, и ни на один из них тест ответить не может, потому что все они
// про СВОЙСТВА, а не про один вызов:
//
//   1. ЦЕНА. В квоте Turso считаются просмотренные строки, и именно они
//      кончились 11.09.2026. Запрос здесь обязан быть `SELECT 1`
//      (замерено на боевой базе: `rows_read = 0`), а не обращение к
//      модели Prisma — `db.user.findFirst()` стоил бы строк на каждом
//      пинге, и пинг раз в 5 минут это 8640 запросов в месяц.
//   2. МОЛЧАНИЕ. Ни авторизации, ни личных данных, ни текста исключения
//      драйвера: сообщение libsql умеет содержать и хост, и токен.
//   3. ВИДИМОСТЬ. Отказ обязан быть 503 С ТЕЛОМ, а не 500 без него; кеш
//      удачного ответа — 30…60 с, отказ не кешируется вовсе.
//   4. НЕВИДИМОСТЬ ДЛЯ ПОИСКА. `/api/` запрещён в `robots.ts`, в карте
//      сайта маршрутов `/api/` нет, и ответ повторяет это заголовком.
//
//   node scripts/check-health-route.mjs          # гейт
//   node scripts/check-health-route.mjs --plant  # позитивный контроль
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Ни одна строка этого файла не должна исполняться от того, что его
// кто-то импортировал — то же правило и та же вставленная форма, что в
// scripts/check-brand-name.mjs; разбор случая, ради которого правило
// заведено, — в src/lib/entry-point.ts.
const IS_ENTRY_POINT = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;


const ROUTE = "src/app/api/health/route.ts";
const ROBOTS = "src/app/robots.ts";
const SITEMAP = "src/app/sitemap.ts";
const TOKENS = "src/lib/health-tokens.ts";
const SMOKE = "scripts/prod-smoke.mjs";

/** Каждая проверка — функция от ТЕКСТОВ файлов, а не от диска: только так
 *  подсадка может подсунуть испорченный вариант, ничего не записывая. */
const RULES = [
  {
    id: "select-1",
    what: "запрос к базе — ровно `SELECT 1`, без обращения к моделям",
    check: ({ route }) =>
      /\$queryRaw`\s*SELECT 1\s*`/.test(route) && !/\bdb\.[a-z][A-Za-z]*\.(findFirst|findMany|count|findUnique|aggregate)/.test(route),
  },
  {
    id: "timeout",
    what: "у запроса к базе есть таймаут не длиннее 5 секунд",
    check: ({ route }) => {
      const m = route.match(/DB_TIMEOUT_MS\s*=\s*(\d+)/);
      return Boolean(m) && Number(m[1]) <= 5000 && /withTimeout\(/.test(route);
    },
  },
  {
    id: "no-auth",
    what: "ни авторизации, ни личных данных: нет ни `getCurrentUser`, ни `cookies`, ни `@/lib/auth`",
    check: ({ route }) => !/getCurrentUser|@\/lib\/auth|from "next\/headers"|cookies\(\)/.test(route),
  },
  {
    id: "no-leak",
    what: "текст исключения наружу не пересылается: `catch` без переменной",
    check: ({ route }) => /catch\s*\{/.test(route) && !/catch\s*\(\s*\w+\s*\)/.test(route),
  },
  {
    id: "503-with-body",
    what: "отказ — 503 с телом и со словом-причиной, а не 500 без тела",
    check: ({ route }) => /status:\s*503/.test(route) && /reason:\s*"db_unreachable"/.test(route) && !/status:\s*500/.test(route),
  },
  {
    id: "cache-30-60",
    what: "удачный ответ кешируется на 30…60 секунд",
    check: ({ route }) => {
      const m = route.match(/CACHE_SECONDS\s*=\s*(\d+)/);
      return Boolean(m) && Number(m[1]) >= 30 && Number(m[1]) <= 60 && /s-maxage=\$\{CACHE_SECONDS\}/.test(route);
    },
  },
  {
    id: "no-store-on-503",
    what: "отказ не кешируется вовсе",
    check: ({ route }) => {
      const failure = route.slice(route.indexOf("status: 503") - 700, route.indexOf("status: 503") + 200);
      return /no-store/.test(failure);
    },
  },
  {
    id: "noindex",
    what: "ответ несёт X-Robots-Tag: noindex",
    check: ({ route }) => (route.match(/X-Robots-Tag":\s*"noindex/g) ?? []).length >= 2,
  },
  {
    id: "robots-disallow",
    what: "`/api/` запрещён в robots.txt",
    check: ({ robots }) => /"\/api\/"/.test(robots),
  },
  {
    id: "not-in-sitemap",
    what: "в карте сайта нет ни одного маршрута `/api/`",
    check: ({ sitemap }) => !/["'`]\/api\//.test(sitemap),
  },
  {
    id: "token-matches-smoke",
    what: "слово живого ответа в маршруте и в прогоне против прода — одно и то же",
    check: ({ route, tokens, smoke }) => {
      const declared = tokens.match(/HEALTH_OK_TOKEN\s*=\s*"([^"]+)"/)?.[1];
      const inSmoke = smoke.match(/HEALTH_OK_TOKEN\s*=\s*"([^"]+)"/)?.[1];
      // И маршрут обязан брать слово ОТТУДА ЖЕ, а не объявлять своё:
      // два литерала расходятся молча.
      const routeImports = /import \{[^}]*HEALTH_OK_TOKEN[^}]*\} from "@\/lib\/health-tokens"/.test(route);
      return Boolean(declared) && declared === inSmoke && routeImports;
    },
  },
  {
    id: "down-token-disjoint",
    what: "слово отказа не содержит слова успеха подстрокой (ловушка healthy/unhealthy)",
    check: ({ tokens }) => {
      const ok = tokens.match(/HEALTH_OK_TOKEN\s*=\s*"([^"]+)"/)?.[1];
      const down = tokens.match(/HEALTH_DOWN_TOKEN\s*=\s*"([^"]+)"/)?.[1];
      return Boolean(ok) && Boolean(down) && !down.includes(ok) && !ok.includes(down);
    },
  },
];

function sources() {
  return {
    route: readFileSync(ROUTE, "utf-8"),
    tokens: readFileSync(TOKENS, "utf-8"),
    robots: readFileSync(ROBOTS, "utf-8"),
    sitemap: readFileSync(SITEMAP, "utf-8"),
    smoke: readFileSync(SMOKE, "utf-8"),
  };
}

function audit(files) {
  return RULES.filter((r) => !r.check(files)).map((r) => r.id);
}

/** Подсадки: каждая портит ровно одно свойство и обязана быть поймана
 *  ИМЕННО своим правилом — иначе «поймано» означало бы, что сработало
 *  чужое, и дыра осталась бы. */
const PLANTS = [
  { id: "select-1", title: "запрос к базе стал обращением к модели", break: (f) => ({ ...f, route: f.route.replace(/\$queryRaw`SELECT 1`/, "db.user.findFirst()") }) },
  { id: "timeout", title: "таймаут вырос до полминуты", break: (f) => ({ ...f, route: f.route.replace(/DB_TIMEOUT_MS = \d+/, "DB_TIMEOUT_MS = 30000") }) },
  { id: "no-auth", title: "маршрут стал читать куки", break: (f) => ({ ...f, route: f.route.replace('import { db }', 'import { cookies } from "next/headers";\nimport { db }') }) },
  { id: "no-leak", title: "текст исключения драйвера поехал наружу", break: (f) => ({ ...f, route: f.route.replace("} catch {", "} catch (error) {").replace('reason: "db_unreachable"', "reason: String(error)") }) },
  { id: "503-with-body", title: "отказ стал пятисоткой", break: (f) => ({ ...f, route: f.route.replace("{ status: 503,", "{ status: 500,") }) },
  { id: "cache-30-60", title: "кеш вырос до получаса", break: (f) => ({ ...f, route: f.route.replace(/CACHE_SECONDS = \d+/, "CACHE_SECONDS = 1800") }) },
  { id: "no-store-on-503", title: "отказ начал кешироваться", break: (f) => ({ ...f, route: f.route.replace('"Cache-Control": "no-store"', '"Cache-Control": "public, s-maxage=45"') }) },
  { id: "noindex", title: "ответ перестал говорить noindex", break: (f) => ({ ...f, route: f.route.replace(/"X-Robots-Tag": "noindex, nofollow"/g, '"X-Robots-Tag": "all"') }) },
  { id: "robots-disallow", title: "`/api/` пропал из robots.txt", break: (f) => ({ ...f, robots: f.robots.replace('"/api/",', "") }) },
  { id: "not-in-sitemap", title: "адрес доступности попал в карту сайта", break: (f) => ({ ...f, sitemap: f.sitemap + '\nconst leak = "/api/health";\n' }) },
  { id: "token-matches-smoke", title: "слово живого ответа разошлось между маршрутом и прогоном", break: (f) => ({ ...f, smoke: f.smoke.replace(/HEALTH_OK_TOKEN = "[^"]+"/, 'HEALTH_OK_TOKEN = "RF-ALIVE"') }) },
  { id: "down-token-disjoint", title: "слова успеха и отказа стали healthy/unhealthy", break: (f) => ({ ...f, tokens: f.tokens.replace(/HEALTH_OK_TOKEN = "[^"]+"/, 'HEALTH_OK_TOKEN = "healthy"').replace(/HEALTH_DOWN_TOKEN = "[^"]+"/, 'HEALTH_DOWN_TOKEN = "unhealthy"') }) },
  { id: "token-matches-smoke", title: "маршрут объявил своё слово вместо общего", break: (f) => ({ ...f, route: f.route.replace(/import \{ HEALTH_DOWN_TOKEN, HEALTH_OK_TOKEN \} from "@\/lib\/health-tokens";/, 'const HEALTH_OK_TOKEN = "RF-OK";\nconst HEALTH_DOWN_TOKEN = "RF-DOWN";') }) },
];

if (IS_ENTRY_POINT) {
  const files = sources();

  if (process.argv.includes("--plant")) {
    console.log("check:health-route --plant");
    let caught = 0;
    const wrong = [];

    // Отрицательный контроль: нетронутые файлы обязаны пройти молча.
    const clean = audit(files);
    if (clean.length === 0) caught += 1;
    else wrong.push(`чистый набор не прошёл: ${clean.join(", ")}`);
    console.log(`  ${clean.length === 0 ? "СОШЛОСЬ " : "НЕ СОШЛОСЬ"} отрицательный контроль: нетронутые файлы проходят`);

    for (const plant of PLANTS) {
      const broken = audit(plant.break(files));
      const ok = broken.includes(plant.id);
      if (ok) caught += 1;
      else wrong.push(`${plant.title} → поймано ${broken.join(", ") || "ничего"}`);
      console.log(`  ${ok ? "ЛОВИТСЯ " : "ПРОПУЩЕНО"} ${plant.title}`);
    }

    console.log(`\nправил ${RULES.length}, подсадок ${PLANTS.length} + 1 отрицательный контроль; сошлось ${caught} из ${PLANTS.length + 1}`);
    if (wrong.length) {
      console.error("НЕ СОШЛОСЬ: " + wrong.join("; "));
      process.exit(1);
    }
    console.log("контроль пройден");
  } else {
    const broken = audit(files);
    if (broken.length) {
      console.error(`адрес доступности нарушает ${broken.length} правил из ${RULES.length}:`);
      for (const id of broken) console.error(`  — ${RULES.find((r) => r.id === id).what}`);
      process.exit(1);
    }
    console.log(`адрес доступности: ${RULES.length} правил из ${RULES.length} соблюдены`);
  }
}
