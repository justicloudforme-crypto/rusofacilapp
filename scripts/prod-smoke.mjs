// ЖИВОЙ ПРОД ПОСЛЕ ВЫКАТА — НАСТОЯЩИМ БРАУЗЕРОМ, ГОСТЕМ, ТОЛЬКО ЧТЕНИЕ.
//
// ЗАЧЕМ. Всё, что стоит на пути мержа, отвечает на вопрос «сломает ли этот
// PR сайт». Ни одна проверка не отвечает на вопрос «работает ли сайт
// ПРЯМО СЕЙЧАС», и это стоило двух аварий. 29.08.2026 все 240 страниц
// уроков отдавали пустое «Something went wrong» ПРИ HTTP 200 и полном
// корректном HTML (инцидент №1 в PROGRESS.md 2.1): 455 зелёных тестов и
// обход 1908 URL этого не увидели, потому что отказ жил в React на
// клиенте. 11.09.2026 на проде кончилась квота чтений Turso. Про обе
// владелец узнал глазами.
//
// ПОЭТОМУ ЗДЕСЬ БРАУЗЕР, А НЕ curl. Страница считается живой только если
// после гидратации в ней есть УЗНАВАЕМЫЙ ПРИЗНАК СОДЕРЖИМОГО, на экране
// нет текста границы ошибок и в консоли нет ни одного необработанного
// исключения. «Ответ 200» сам по себе не значит ничего — ровно это и
// показал инцидент №1.
//
// ПРИЗНАКИ БЕРУТСЯ ИЗ КОДА, А НЕ ПРИДУМЫВАЮТСЯ. Заголовки страниц
// читаются из `src/dictionaries/es.json` и `ru.json` — из тех же строк,
// которые рисует сам сайт. Придуманный признак — это ложная тревога на
// первой же правке текста.
//
// ЧЕГО ЭТОТ ПРОГОН НЕ ДЕЛАЕТ. Не входит в аккаунты, не регистрируется, не
// отвечает на карточки и вообще не делает ни одного не-GET запроса:
// с 17.09.2026 (заход 7.204) ответ в карточке СТАВИТ ДЕНЬ ЗАНЯТИЯ, и
// сторож доступности, который ставит живым людям дни, — это не измерение,
// а порча данных. Ни одной записи в базу.
//
// ЛОЖНЫХ ТРЕВОГ БЫТЬ НЕ ДОЛЖНО. Страница объявляется упавшей только
// после ВТОРОЙ неудачи, разделённой паузой (--retry-delay-ms, по
// умолчанию 45 с). Разовый таймаут холодной функции — не авария.
//
//   node scripts/prod-smoke.mjs                      # против живого прода
//   node scripts/prod-smoke.mjs --base=http://…      # против чего угодно
//   node scripts/prod-smoke.mjs --plant              # позитивный контроль
import { chromium, webkit } from "playwright";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Ни одна строка этого файла не должна исполняться от того, что его
// кто-то импортировал — то же правило и та же вставленная форма, что в
// scripts/check-brand-name.mjs; разбор случая, ради которого правило
// заведено, — в src/lib/entry-point.ts.
const IS_ENTRY_POINT = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;


const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = (arg("base", "https://rusofacilapp.com")).replace(/\/$/, "");
const ENGINE = arg("engine", "chromium");
const RETRY_DELAY_MS = Number(arg("retry-delay-ms", "45000"));
const OUT_DIR = arg("out", "smoke-artifacts");
const NAV_TIMEOUT_MS = Number(arg("nav-timeout-ms", "45000"));

/** Текст границы ошибок. Первые два — наши собственные (`src/app/**\/error.tsx`
 *  и `src/app/global-error.tsx`), третий и четвёртый — то, что показывает
 *  Next.js и React БЕЗ наших границ: ровно это и видели люди 29.08.2026. */
const ERROR_ON_SCREEN = [
  "Algo salió mal",
  "Что-то пошло не так",
  "Application error",
  "Something went wrong",
];

/** Бесплатный рассказ. Оба бесплатных взяты из боевой базы 17.09.2026
 *  (`SELECT id, title FROM Story WHERE isPremium = 0` → «Репка» и
 *  «Снегурочка»); здесь первый. Платный рассказ гостю показал бы замок, и
 *  признак содержимого пришлось бы писать про замок, а не про текст. */
const FREE_STORY_ID = "cmsxtq13w000cqwnc466c87es";
const FREE_STORY_TITLE = "Репка";

/** Бесплатная категория словаря — первая в карте сайта. */
const VOCABULARY_CATEGORY = "comida";

/** Слово, по которому узнаётся живой ответ `/api/health`. Тот же литерал
 *  объявлен в `src/app/api/health/route.ts`; их сличает сторож
 *  `npm run check:health-route`. */
const HEALTH_OK_TOKEN = "RF-OK";

/** Чем проверка представляется серверу. Написание НЕ брендовое и
 *  намеренно — ровно по той же причине, что и токен оболочки
 *  (`src/lib/native-shell-token.ts`): имя продукта пишется «RusoFácilapp»,
 *  «á» в заголовок HTTP не кладётся, а написать то же имя без диакритики
 *  запрещает `npm run check:brand` по всему репозиторию. Стоило одного
 *  красного CI 17.09.2026: локально `verify` был зелёным, потому что
 *  сторож смотрит ОТСЛЕЖИВАЕМЫЕ файлы, а новый файл в тот момент ещё не
 *  был добавлен в индекс. */
const SMOKE_USER_AGENT = "RFProdSmoke";

function dictionary(lang) {
  return JSON.parse(readFileSync(`src/dictionaries/${lang}.json`, "utf-8"));
}

/** Список целей. Каждая — «что открыть» и «по чему видно, что оно живое».
 *  Заголовки приходят из словаря интерфейса, а не из этого файла. */
export function targets() {
  const es = dictionary("es");
  const ru = dictionary("ru");
  const exact = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  return [
    { name: "главная /es", path: "/es", h1: exact(es.home.heroTitle), links: { sel: 'a[href^="/es/"]', min: 3 } },
    { name: "главная /ru", path: "/ru", h1: exact(ru.home.heroTitle), links: { sel: 'a[href^="/ru/"]', min: 3 } },
    { name: "каталог курсов", path: "/es/courses", h1: exact(es.courses.pageTitle), links: { sel: 'a[href^="/es/courses/"]', min: 4 } },
    { name: "бесплатный урок A1/1", path: "/es/courses/a1/1", h1: /\S/, links: { sel: "h2", min: 1 } },
    { name: "словарь", path: "/es/vocabulary", h1: exact(es.vocabulary.pageTitle), links: { sel: 'a[href^="/es/vocabulary/"]', min: 5 } },
    { name: `категория словаря /${VOCABULARY_CATEGORY}`, path: `/es/vocabulary/${VOCABULARY_CATEGORY}`, h1: /\S/, links: { sel: "h2", min: 1 } },
    { name: "каталог рассказов", path: "/es/stories", h1: exact(es.stories.pageTitle), links: { sel: 'a[href^="/es/stories/"]', min: 5 } },
    { name: `бесплатный рассказ «${FREE_STORY_TITLE}»`, path: `/es/stories/${FREE_STORY_ID}`, h1: exact(FREE_STORY_TITLE), links: { sel: "h2", min: 1 } },
    { name: "игры", path: "/es/word-games", h1: exact(es.nav.wordGames), links: { sel: 'a[href^="/es/word-games/"]', min: 3 } },
    { name: "вход", path: "/es/login", h1: exact(es.auth.loginTitle), links: { sel: 'input[type="password"]', min: 1 } },
    // Правило 7.201: кабинет гостю отвечает ОДНИМ 307 на вход, а не
    // цепочкой и не 200 с пустотой. Проверяется запросом без браузера:
    // браузер редирект проглотил бы и число переходов не показал.
    { name: "кабинет гостю → один 307", path: "/es/profile", redirect: { status: 307, location: /\/es\/login\?redirectTo=/ } },
    { name: "/api/health", path: "/api/health", json: { contains: HEALTH_OK_TOKEN, status: 200 } },
  ];
}

/** Одна цель, один заход. Возвращает список причин; пустой — цель жива. */
async function probe(context, base, target) {
  const url = `${base}${target.path}`;

  if (target.redirect) {
    const res = await fetch(url, { redirect: "manual", headers: { "user-agent": SMOKE_USER_AGENT } });
    const why = [];
    if (res.status !== target.redirect.status) why.push(`ответ ${res.status}, ожидался ${target.redirect.status}`);
    const location = res.headers.get("location") ?? "";
    if (!target.redirect.location.test(location)) why.push(`уводит на «${location || "никуда"}»`);
    return { why, status: res.status };
  }

  if (target.json) {
    const res = await fetch(url, { headers: { "user-agent": SMOKE_USER_AGENT } });
    const text = await res.text();
    const why = [];
    if (res.status !== target.json.status) why.push(`ответ ${res.status}, ожидался ${target.json.status}`);
    if (!text.includes(target.json.contains)) why.push(`в ответе нет слова «${target.json.contains}»`);
    return { why, status: res.status };
  }

  const page = await context.newPage();
  // Необработанное исключение на странице — это и есть класс отказа,
  // который прошёл мимо всех тестов 29.08.2026. Считаются именно
  // `pageerror` (исключения, до которых никто не дотянулся), а не
  // `console.error`: чужие встраивания (YouTube) пишут в консоль своё, и
  // сторож, краснеющий от чужой строки, — это ложная тревога раз в день.
  const crashes = [];
  page.on("pageerror", (error) => crashes.push(String(error.message ?? error).slice(0, 200)));

  const why = [];
  let status = 0;
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    status = response?.status() ?? 0;
    if (status !== 200) why.push(`ответ ${status}, ожидался 200`);
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const seen = await page.evaluate(
      ({ sel, errors }) => ({
        h1: (document.querySelector("h1")?.textContent ?? "").trim(),
        found: sel ? document.querySelectorAll(sel).length : 0,
        onScreen: errors.filter((e) => (document.body?.innerText ?? "").includes(e)),
      }),
      { sel: target.links?.sel ?? null, errors: ERROR_ON_SCREEN },
    );

    if (target.h1 && !target.h1.test(seen.h1)) {
      why.push(`признака содержимого нет: h1 = «${seen.h1.slice(0, 60) || "пусто"}»`);
    }
    if (target.links && seen.found < target.links.min) {
      why.push(`«${target.links.sel}» найдено ${seen.found}, нужно ${target.links.min}`);
    }
    if (seen.onScreen.length) why.push(`на экране текст ошибки: ${seen.onScreen.join(", ")}`);
    if (crashes.length) why.push(`необработанная ошибка в консоли: ${crashes[0]}`);

    if (why.length) {
      mkdirSync(OUT_DIR, { recursive: true });
      const file = join(OUT_DIR, `${target.path.replace(/[^\w]+/g, "_") || "root"}.png`);
      await page.screenshot({ path: file, fullPage: false }).catch(() => {});
      why.push(`снимок: ${file}`);
    }
  } catch (error) {
    why.push(`не открылась: ${String(error).slice(0, 160)}`);
  } finally {
    await page.close().catch(() => {});
  }
  return { why, status };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Прогон по всем целям с ОДНОЙ повторной попыткой на упавшую. */
export async function run({ base, list, retryDelayMs, engine }) {
  const browser = await (engine === "webkit" ? webkit : chromium).launch();
  const context = await browser.newContext({ locale: "es-ES" });
  const startedAt = Date.now();
  const results = [];

  try {
    for (const target of list) {
      let attempt = await probe(context, base, target);
      let retried = false;
      if (attempt.why.length) {
        retried = true;
        await sleep(retryDelayMs);
        attempt = await probe(context, base, target);
      }
      results.push({ name: target.name, path: target.path, status: attempt.status, why: attempt.why, retried });
      const mark = attempt.why.length ? "КРАСНЫЙ" : "зелёный";
      console.log(`${mark.padEnd(8)} ${target.path.padEnd(42)} ${attempt.why.join("; ") || attempt.status}`);
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  return {
    base,
    engine,
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    checked: results.length,
    failures: results.filter((r) => r.why.length),
    results,
  };
}

/** ПОЗИТИВНЫЙ КОНТРОЛЬ. Тот же детектор натравливается на заведомо
 *  сломанную цель — местный сервер, отдающий по одной подсадке на дефект.
 *  Прогон обязан покраснеть на каждой и НЕ покраснеть на исправной
 *  странице (отрицательный контроль). Сети наружу не нужно, настоящий
 *  прод не трогается, тревога не поднимается. */
async function plant() {
  console.log("prod-smoke --plant — сухой прогон против заведомо сломанной цели");

  const pages = {
    // Отрицательный контроль: всё на месте.
    "/ok": { status: 200, body: `<h1>Ровно тот заголовок</h1><a href="/ok/a">1</a><a href="/ok/b">2</a><a href="/ok/c">3</a>` },
    "/status-500": { status: 500, body: `<h1>Ровно тот заголовок</h1><a href="/ok/a">1</a><a href="/ok/b">2</a><a href="/ok/c">3</a>` },
    "/no-marker": { status: 200, body: `<h1>Совсем другой заголовок</h1><a href="/ok/a">1</a><a href="/ok/b">2</a><a href="/ok/c">3</a>` },
    "/empty": { status: 200, body: `<h1>Ровно тот заголовок</h1>` },
    // Класс инцидента №1: HTTP 200, корректный HTML и текст границы ошибок.
    "/boundary": { status: 200, body: `<h1>Ровно тот заголовок</h1><a href="/ok/a">1</a><a href="/ok/b">2</a><a href="/ok/c">3</a><p>Algo salió mal · Что-то пошло не так</p>` },
    "/crash": { status: 200, body: `<h1>Ровно тот заголовок</h1><a href="/ok/a">1</a><a href="/ok/b">2</a><a href="/ok/c">3</a><script>setTimeout(()=>{throw new Error("подсаженное падение")},0)</script>` },
    // Кабинет, который перестал уводить гостя на вход.
    "/profile-200": { status: 200, body: "<h1>Кабинет</h1>" },
    "/profile-307": { status: 307, location: "/es/login?redirectTo=%2Fes%2Fprofile", body: "" },
    "/health-ok": { status: 200, body: JSON.stringify({ status: HEALTH_OK_TOKEN, ok: true }) },
    "/health-503": { status: 503, body: JSON.stringify({ status: "RF-DOWN", ok: false, reason: "db_unreachable" }) },
  };

  const server = createServer((req, res) => {
    const page = pages[req.url.split("?")[0]];
    if (!page) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end("<h1>нет такой</h1>");
      return;
    }
    const headers = { "content-type": "text/html; charset=utf-8" };
    if (page.location) headers.location = page.location;
    res.writeHead(page.status, headers);
    res.end(page.body);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const H1 = /Ровно тот заголовок/i;
  const LINKS = { sel: "a[href]", min: 3 };
  const cases = [
    { title: "ИСПРАВНАЯ страница (отрицательный контроль)", expectRed: false, target: { name: "ok", path: "/ok", h1: H1, links: LINKS } },
    { title: "ответ не 200", expectRed: true, target: { name: "500", path: "/status-500", h1: H1, links: LINKS } },
    { title: "признака содержимого нет (чужой заголовок)", expectRed: true, target: { name: "no-marker", path: "/no-marker", h1: H1, links: LINKS } },
    { title: "содержимого меньше обещанного", expectRed: true, target: { name: "empty", path: "/empty", h1: H1, links: LINKS } },
    { title: "HTTP 200 и текст границы ошибок на экране (класс инцидента №1)", expectRed: true, target: { name: "boundary", path: "/boundary", h1: H1, links: LINKS } },
    { title: "необработанная ошибка в консоли", expectRed: true, target: { name: "crash", path: "/crash", h1: H1, links: LINKS } },
    { title: "кабинет перестал уводить гостя на вход", expectRed: true, target: { name: "profile", path: "/profile-200", redirect: { status: 307, location: /\/es\/login\?redirectTo=/ } } },
    { title: "кабинет уводит на вход (отрицательный контроль)", expectRed: false, target: { name: "profile", path: "/profile-307", redirect: { status: 307, location: /\/es\/login\?redirectTo=/ } } },
    { title: "/api/health отдаёт 503", expectRed: true, target: { name: "health", path: "/health-503", json: { contains: HEALTH_OK_TOKEN, status: 200 } } },
    { title: "/api/health отдаёт живое слово (отрицательный контроль)", expectRed: false, target: { name: "health", path: "/health-ok", json: { contains: HEALTH_OK_TOKEN, status: 200 } } },
  ];

  let caught = 0;
  const wrong = [];
  const browser = await chromium.launch();
  const context = await browser.newContext();
  try {
    for (const c of cases) {
      const { why } = await probe(context, base, c.target);
      const red = why.length > 0;
      const ok = red === c.expectRed;
      if (ok) caught += 1;
      else wrong.push(c.title);
      console.log(`  ${ok ? "ЛОВИТСЯ" : "ПРОПУЩЕНО"}  ${c.title}${red ? ` — ${why[0]}` : ""}`);
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    server.close();
  }

  // Второй контроль — не про детектор, а про СПИСОК: признаки обязаны
  // приходить из словаря интерфейса, а не быть вписаны сюда руками.
  const es = dictionary("es");
  const ru = dictionary("ru");
  const list = targets();
  // Сличается ИСХОДНИК регулярного выражения со строкой словаря, а не
  // «подходит ли она под него»: `/\S/` подходит под любую строку и дал бы
  // 8 из 6 на пустом месте — ровно так первая редакция этого контроля и
  // соврала.
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fromDictionary = [es.home.heroTitle, ru.home.heroTitle, es.courses.pageTitle, es.vocabulary.pageTitle, es.stories.pageTitle, es.nav.wordGames, es.auth.loginTitle]
    .filter((s) => list.some((t) => t.h1 && t.h1.source === escape(s)));
  console.log(`\n  целей в списке: ${list.length}; признаков, взятых ДОСЛОВНО из словаря интерфейса: ${fromDictionary.length} из 7`);

  console.log(`\nподсадок ${cases.filter((c) => c.expectRed).length} + отрицательных контролей ${cases.filter((c) => !c.expectRed).length}; сошлось ${caught} из ${cases.length}`);
  if (wrong.length) {
    console.error("НЕ СОШЛОСЬ: " + wrong.join("; "));
    process.exit(1);
  }
  if (fromDictionary.length < 7) {
    console.error(`признаки перестали браться из словаря интерфейса: ${fromDictionary.length} из 7`);
    process.exit(1);
  }
  console.log("контроль пройден");
}

async function main() {
  if (argv.includes("--plant")) return plant();

  const list = targets();
  console.log(`prod-smoke: ${list.length} целей против ${BASE}, движок ${ENGINE}, повтор через ${RETRY_DELAY_MS} мс\n`);
  const report = await run({ base: BASE, list, retryDelayMs: RETRY_DELAY_MS, engine: ENGINE });

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "smoke-result.json"), JSON.stringify(report, null, 2));

  const lines = report.failures.map((f) => `- **${f.name}** (\`${f.path}\`) — ${f.why.join("; ")}`);
  writeFileSync(
    join(OUT_DIR, "summary.md"),
    report.failures.length
      ? `Проверено ${report.checked}, упало ${report.failures.length}:\n\n${lines.join("\n")}\n`
      : `Проверено ${report.checked}, упавших нет.\n`,
  );

  console.log(`\nпроверено ${report.checked}, упало ${report.failures.length}, время ${(report.durationMs / 1000).toFixed(1)} с`);
  if (report.failures.length) process.exit(1);
}

if (IS_ENTRY_POINT) {
  await main();
}
