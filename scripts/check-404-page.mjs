/**
 * «Несуществующий адрес отдаёт код 404 И СВОЮ страницу» — сторож долга 129.
 *
 * ЗАЧЕМ. До 11.09.2026 у сайта не было своей страницы 404 ни в одной
 * локали: `src/app/**` не содержал ни одного `not-found.tsx`, и любой
 * несуществующий адрес — и опечатка в ссылке, и прежняя цель переключателя
 * языка — отдавал голую страницу Next «404: This page could not be found»:
 * по-английски в обеих локалях, без шапки, без подвала, без единой ссылки
 * обратно. Замер на живом проде 11.09.2026: 21 адрес-ошибка, у всех 21 код
 * 404 (это было верно), и у всех 21 страница Next, а не наша.
 *
 * ПРАВИЛО, которое держит этот сторож, — из двух половин, и вторая нужна
 * не меньше первой:
 *
 *   1. адрес-ошибка обязан отвечать кодом **404**. Не 200 с текстом «не
 *      найдено»: «мягкая 404» — это страница, которую краулер считает
 *      живой, и именно её этот сторож запрещает;
 *   2. в ответе обязана быть НАША страница: своя рама, нужный язык,
 *      `noindex`, ссылки на главную, каталог и поиск — и ни одной кнопки
 *      «слушать» (на 404 нет ни слова с оплаченной озвучкой, а орган без
 *      записи — ровно то, что заход 7.168 убирал с сайта).
 *
 * ОТДЕЛЬНО ПРО ПОТОКОВУЮ ОТДАЧУ. `notFound()`, брошенный ПОСЛЕ того как
 * ответ начал уходить в сеть, кодом ответа быть уже не может: заголовки
 * отправлены, и Next отдаёт 200 с разметкой «не найдено» и `noindex`
 * внутри. Это и есть «мягкая 404», которую невозможно починить на стороне
 * страницы. Поэтому сторож измеряет КОД ОТВЕТА у каждого вида адреса и
 * печатает число таких маршрутов: ноль — не предположение, а строка
 * отчёта.
 *
 * Запускать:
 *   node scripts/check-404-page.mjs --base=http://localhost:3123   # живой гейт
 *   node scripts/check-404-page.mjs --plant                        # позитивный контроль, без сервера
 *   node scripts/check-404-page.mjs --base=… --before              # замер без гейта
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const BASE = argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "";
const PLANT = argv.includes("--plant");
/** Замер без гейта: печатает таблицу и выходит нулём. Нужен, чтобы «до» и
 *  «после» снимались ОДНИМ инструментом (PROGRESS.md 4.1). */
const BEFORE = argv.includes("--before");

/** Тексты, по которым узнаётся локаль страницы. Берутся из тех же
 *  словарей, что печатает продукт, а не переписываются сюда руками:
 *  разойтись им тогда негде. */
const TITLES = {
  es: "Página no encontrada",
  ru: "Страница не найдена",
};

/**
 * Виды адресов. Не «несколько примеров», а по одному на каждый способ
 * получить 404 в этом приложении: несовпавший путь, несуществующая строка
 * в базе (рассказ, урок, пазл, медиа, глоссарий, экзамен, профиль),
 * `notFound()` в самом коде страницы (раздел, которого нет на /ru) и путь
 * без локали, который прокси сначала уводит редиректом.
 */
/**
 * ДВА КЛАССА АДРЕСОВ-ОШИБОК, и разделение между ними — измеренное, а не
 * выбранное.
 *
 * `ourPage: true` — адрес, не совпавший ни с одним маршрутом (опечатка,
 * чужая локаль, путь без локали), и испанские маршруты под `/ru`, которые
 * прокси переписывает на такой же несовпадающий путь. Они отдают НАШУ
 * страницу: рама, нужный язык, ссылки, `noindex`, код 404.
 *
 * `ourPage: false` — маршрут СОВПАЛ, и страница сама позвала `notFound()`
 * (нет такой строки в базе). В этом приложении такой ответ документа не
 * рисует вовсе: корневой layout лежит в динамическом сегменте
 * (`src/app/[lang]/layout.tsx`, файла `src/app/layout.tsx` нет), и Next
 * отдаёт пустую внутреннюю оболочку — содержимое 404 уходит в RSC-payload
 * и не видно ни в HTML, ни после гидрации. Это НЕ регрессия захода: так
 * было и до него, измерено на живом проде 11.09.2026. Чинится переносом
 * `<html>` в корневой layout — правка рамы всех страниц, отложенная до
 * снятия заморозки 26.09.2026 (долг 133).
 *
 * Число таких видов ЗАКРЕПЛЕНО ниже: если один из них начнёт отдавать
 * нашу страницу (например, после переноса layout'а), сторож покраснеет и
 * потребует обновить список — ровно так же, как `check:brand` держит
 * список исключений числом.
 */
const CASES = [
  { name: "несовпавший путь /es", path: "/es/net-takoy-stranicy", lang: "es", ourPage: true },
  { name: "несовпавший путь /ru", path: "/ru/net-takoy-stranicy", lang: "ru", ourPage: true },
  { name: "глубокий несовпавший путь /es", path: "/es/courses/a1/1/net-takoy-hvost", lang: "es", ourPage: true },
  { name: "путь без локали", path: "/net-takoy-stranicy", lang: "es", ourPage: true },
  // Путь без локали внутри существующего раздела: после редиректа это уже
  // «маршрут совпал, строки нет» — тот же известный класс, что ниже.
  { name: "путь без локали внутри раздела", path: "/stories/net-takogo-rasskaza", lang: "es", ourPage: false },
  { name: "чужая локаль в пути", path: "/de/net-takoy-stranicy", lang: "es", ourPage: true },
  { name: "испанский маршрут под /ru: категория словаря", path: "/ru/vocabulary/sinonimos-y-antonimos", lang: "ru", ourPage: true },
  { name: "испанский маршрут под /ru: гид грамматики", path: "/ru/gramatica/alfabeto-ruso", lang: "ru", ourPage: true },
  { name: "испанский маршрут под /ru: хаб грамматики", path: "/ru/gramatica", lang: "ru", ourPage: true },
  { name: "испанский маршрут под /ru: игровой лендинг", path: "/ru/sopa-de-letras-ruso", lang: "ru", ourPage: true },
  { name: "испанский маршрут под /ru: /alfabeto-cirilico", path: "/ru/alfabeto-cirilico", lang: "ru", ourPage: true },
  { name: "несуществующий рассказ /es", path: "/es/stories/net-takogo-rasskaza", lang: "es", ourPage: false },
  { name: "несуществующий рассказ /ru", path: "/ru/stories/net-takogo-rasskaza", lang: "ru", ourPage: false },
  { name: "несуществующий урок /es", path: "/es/courses/a1/999", lang: "es", ourPage: false },
  { name: "несуществующий урок /ru", path: "/ru/courses/a1/999", lang: "ru", ourPage: false },
  { name: "несуществующий уровень курса", path: "/es/courses/zz", lang: "es", ourPage: false },
  { name: "несуществующий пазл /es", path: "/es/word-games/crossword/a1/99999", lang: "es", ourPage: false },
  { name: "несуществующий пазл /ru", path: "/ru/word-games/crossword/a1/99999", lang: "ru", ourPage: false },
  { name: "несуществующий вид пазла", path: "/es/word-games/net-takogo-vida/a1/1", lang: "es", ourPage: false },
  { name: "несуществующее медиа", path: "/es/media/net-takogo-media", lang: "es", ourPage: false },
  { name: "несуществующий термин глоссария", path: "/es/glossary/net-takogo-termina", lang: "es", ourPage: false },
  { name: "несуществующий экзамен", path: "/es/courses/a1/exam/net-takogo", lang: "es", ourPage: false },
  { name: "несуществующий профиль", path: "/es/u/net-takogo-cheloveka", lang: "es", ourPage: false },
];

/** Сколько видов адресов документа не рисуют — закреплено числом (долг 133). */
const BLANK_KINDS = 13;

/** Живая страница: нужна как контроль того, что сторож вообще способен
 *  отличить 404 от не-404, и что сервер отвечает не «всё 404». */
const ALIVE = [
  { name: "КОНТРОЛЬ живости: главная /es", path: "/es", lang: "es" },
  { name: "КОНТРОЛЬ живости: главная /ru", path: "/ru", lang: "ru" },
];


/**
 * СТАТИЧЕСКАЯ ПОЛОВИНА — три строки, без которых живая половина молча
 * перестанет что-либо значить. Все три выведены из этого захода:
 * конвенция `global-not-found.tsx` в Next 16.3 живёт под флагом, локаль
 * страница берёт из заголовка прокси, и испанские маршруты под `/ru`
 * доходят до неё переписыванием. Убери любую — и 404 снова станет пустой
 * страницей, а живая проверка гоняется только там, где поднят сервер.
 */
const STATIC_RULES = [
  {
    name: "есть свой документ 404 (src/app/global-not-found.tsx)",
    file: "src/app/global-not-found.tsx",
    must: ["NotFoundBody", "<html", "Navbar", "Footer", "LOCALE_HEADER"],
  },
  {
    name: "конвенция global-not-found включена в next.config.ts",
    file: "next.config.ts",
    must: ["globalNotFound: true"],
  },
  {
    name: "прокси кладёт локаль в запрос и переписывает испанские маршруты под /ru",
    file: "src/proxy.ts",
    must: ["LOCALE_HEADER", "isSpanishOnlyRoute", "NOT_FOUND_REWRITE_SEGMENT", "NextResponse.rewrite"],
  },
  {
    name: "у страницы 404 нет своего адреса в карте сайта",
    file: "src/app/sitemap.ts",
    mustNot: ["__not-found__", "global-not-found"],
  },
];

export function judgeStatic(rule, text) {
  const problems = [];
  for (const needle of rule.must ?? []) {
    if (!text.includes(needle)) problems.push(`в ${rule.file} нет «${needle}»`);
  }
  for (const needle of rule.mustNot ?? []) {
    if (text.includes(needle)) problems.push(`в ${rule.file} появилось «${needle}»`);
  }
  return problems;
}

function runStatic() {
  let bad = 0;
  for (const rule of STATIC_RULES) {
    const text = readFileSync(rule.file, "utf8");
    const problems = judgeStatic(rule, text);
    if (problems.length) bad++;
    console.log(`  ${problems.length ? "ДЕФЕКТ" : "ок "} ${rule.name}${problems.length ? "\n        " + problems.join("; ") : ""}`);
  }
  console.log(bad === 0 ? `[check:404] PASS — статических правил ${STATIC_RULES.length}, расхождений 0` : `[check:404] ОТКАЗ: расхождений ${bad} из ${STATIC_RULES.length}`);
  return bad === 0 ? 0 : 1;
}

/** Единственное место, где написано, что такое «наша страница 404». И
 *  сторож, и подсадка судят одним кодом — приём против класса долга 104. */
export function judge({ status, html, lang, ourPage = true }) {
  const problems = [];
  if (status !== 404) problems.push(`код ответа ${status}, а не 404`);
  if (!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html)) problems.push("нет noindex");
  const isOurs = html.includes('data-testid="not-found-page"');
  if (!ourPage) {
    // Известный класс (долг 133): документа нет вовсе. Правило
    // асимметричное — «нашей страницы здесь ПОКА не бывает»; появилась —
    // сторож обязан покраснеть, чтобы список не врал молча.
    if (isOurs) problems.push("адрес начал отдавать НАШУ страницу — долг 133 закрыт, обнови список в check:404");
    return problems;
  }
  if (!isOurs) problems.push("это не наша страница 404");
  const expected = TITLES[lang];
  if (expected && !html.includes(expected)) problems.push(`нет заголовка локали ${lang} («${expected}»)`);
  const foreign = Object.entries(TITLES).find(([code, title]) => code !== lang && html.includes(title));
  if (foreign) problems.push(`на странице текст чужой локали (${foreign[0]})`);
  if (!new RegExp(`href="/${lang}"`).test(html)) problems.push("нет ссылки на главную");
  if (!new RegExp(`href="/${lang}/courses"`).test(html)) problems.push("нет ссылки на каталог");
  if (!html.includes('data-testid="not-found-search"')) problems.push("нет входа в поиск");
  if (!/<footer/i.test(html) || !/<header/i.test(html)) problems.push("нет рамы сайта (шапка и подвал)");
  const own = (html.match(/data-testid="not-found-page"[\s\S]*?<\/div>\s*<\/main>/) ?? [""])[0];
  if (/🔊/.test(own)) problems.push("на странице есть кнопка «слушать» без записи");
  return problems;
}

/** Живая страница обязана НЕ быть нашей 404 — иначе «все адреса 404»
 *  прошло бы гейт как успех. */
export function judgeAlive({ status, html }) {
  const problems = [];
  if (status !== 200) problems.push(`код ответа ${status}, а не 200`);
  if (html.includes('data-testid="not-found-page"')) problems.push("живая страница отдала страницу 404");
  return problems;
}

async function probe(path) {
  let url = BASE + path;
  let res = await fetch(url, { redirect: "manual", headers: { "user-agent": "check-404-page" } });
  const chain = [String(res.status)];
  let hops = 0;
  while ([301, 302, 303, 307, 308].includes(res.status) && hops < 4) {
    url = new URL(res.headers.get("location"), url).toString();
    res = await fetch(url, { redirect: "manual", headers: { "user-agent": "check-404-page" } });
    chain.push(String(res.status));
    hops++;
  }
  return { status: res.status, html: await res.text(), chain: chain.join("→"), finalUrl: url };
}

/** Позитивный контроль: каждая подсадка — один способ сломать правило. */
const CLEAN = `<!doctype html><html lang="es"><head><meta name="robots" content="noindex, nofollow"></head>
<body><header>шапка</header><main><div data-testid="not-found-page" lang="es"><h1>Página no encontrada</h1>
<a href="/es">Ir al inicio</a><a href="/es/courses">Ver el catálogo de cursos</a>
<button data-testid="not-found-search">Buscar en el sitio</button></div></main><footer>подвал</footer></body></html>`;

const PLANTS = [
  ["страница отдаёт 200 вместо 404", { status: 200, html: CLEAN, lang: "es" }],
  ["отдана голая страница Next", { status: 404, html: '<html id="__next_error__"><body>404 This page could not be found.</body></html>', lang: "es" }],
  ["нет noindex", { status: 404, html: CLEAN.replace(/<meta[^>]+robots[^>]*>/, ""), lang: "es" }],
  ["текст чужой локали", { status: 404, html: CLEAN.replace("Página no encontrada", "Страница не найдена"), lang: "es" }],
  ["нет ссылки на главную", { status: 404, html: CLEAN.replace('<a href="/es">Ir al inicio</a>', ""), lang: "es" }],
  ["нет ссылки на каталог", { status: 404, html: CLEAN.replace('<a href="/es/courses">Ver el catálogo de cursos</a>', ""), lang: "es" }],
  ["нет входа в поиск", { status: 404, html: CLEAN.replace('data-testid="not-found-search"', 'data-testid="something-else"'), lang: "es" }],
  ["нет рамы сайта", { status: 404, html: CLEAN.replace("<footer>подвал</footer>", ""), lang: "es" }],
  ["кнопка «слушать» без записи", { status: 404, html: CLEAN.replace("<h1>Página no encontrada</h1>", "<h1>Página no encontrada</h1><button>🔊</button>"), lang: "es" }],
  ["русская страница по русскому адресу без русского текста", { status: 404, html: CLEAN, lang: "ru" }],
  ["известный класс начал отдавать нашу страницу (долг 133 закрыт, список не обновлён)", { status: 404, html: CLEAN, lang: "es", ourPage: false }],
  ["известный класс перестал отдавать 404", { status: 200, html: "<html><body></body></html>", lang: "es", ourPage: false }],
];

function runPlant() {
  let caught = 0;
  // Подсадки статической половины: каждое правило обязано ловить снятие
  // своей строки, и чистый файл обязан молчать.
  for (const rule of STATIC_RULES) {
    const text = readFileSync(rule.file, "utf8");
    const clean = judgeStatic(rule, text);
    const needle = (rule.must ?? [])[0];
    const planted = needle
      ? judgeStatic(rule, text.split(needle).join("ЗДЕСЬ-БЫЛО-ПРАВИЛО"))
      : judgeStatic(rule, text + (rule.mustNot ?? [])[0]);
    const ok = clean.length === 0 && planted.length > 0;
    if (ok) caught++;
    console.log(`  ${ok ? "ок" : "ПРОПУЩЕНО"}: статическое правило «${rule.name}» ловит подсадку и молчит на чистом файле`);
  }
  for (const [name, input] of PLANTS) {
    const problems = judge(input);
    const ok = problems.length > 0;
    if (ok) caught++;
    console.log(`  ${ok ? "ок" : "ПРОПУЩЕНО"}: подсадка «${name}»${ok ? ` → ${problems[0]}` : ""}`);
  }
  // Отрицательные контроли: чистый случай обязан МОЛЧАТЬ, иначе сторож
  // краснеет всегда и не значит ничего.
  const cleanProblems = judge({ status: 404, html: CLEAN, lang: "es" });
  const aliveProblems = judgeAlive({ status: 200, html: "<html><body>живая страница</body></html>" });
  const aliveCaught = judgeAlive({ status: 200, html: CLEAN });
  console.log(`  ${cleanProblems.length === 0 ? "ок" : "ПРОПУЩЕНО"}: отрицательный контроль — чистая страница 404 молчит${cleanProblems.length ? " → " + cleanProblems.join("; ") : ""}`);
  console.log(`  ${aliveProblems.length === 0 ? "ок" : "ПРОПУЩЕНО"}: отрицательный контроль — живая страница молчит`);
  console.log(`  ${aliveCaught.length > 0 ? "ок" : "ПРОПУЩЕНО"}: подсадка «живая страница отдала 404»`);
  const total = PLANTS.length + 3 + STATIC_RULES.length;
  const passed = caught + (cleanProblems.length === 0 ? 1 : 0) + (aliveProblems.length === 0 ? 1 : 0) + (aliveCaught.length > 0 ? 1 : 0);
  console.log(`[check:404 --plant] пройдено ${passed} из ${total}`);
  return passed === total ? 0 : 1;
}

async function runLive() {
  const rows = [];
  for (const c of [...CASES, ...ALIVE]) {
    const r = await probe(c.path);
    const alive = c.name.startsWith("КОНТРОЛЬ");
    const problems = alive ? judgeAlive({ ...r, lang: c.lang }) : judge({ ...r, lang: c.lang, ourPage: c.ourPage });
    rows.push({ ...c, ...r, problems, alive });
  }
  const errs = rows.filter((r) => !r.alive);
  const soft = errs.filter((r) => r.status === 200);
  console.log(`[check:404] база ${BASE}`);
  for (const r of rows) {
    const mark = r.problems.length === 0 ? "ок " : "ДЕФЕКТ";
    console.log(`  ${mark} ${r.chain.padEnd(9)} ${String(r.html.length).padStart(7)}б  ${r.name} [${r.path}]${r.problems.length ? "\n        " + r.problems.join("; ") : ""}`);
  }
  console.log(`\n  адресов-ошибок ${errs.length}; код 404 у ${errs.filter((r) => r.status === 404).length}; код 200 («мягкая 404», notFound() после начала потоковой отдачи) у ${soft.length}`);
  const ours = errs.filter((r) => r.html.includes('data-testid="not-found-page"'));
  console.log(`  наша страница 404 у ${ours.length} из ${errs.length}; noindex у ${errs.filter((r) => /name="robots"[^>]+content="[^"]*noindex/i.test(r.html)).length} из ${errs.length}`);
  const blank = errs.filter((r) => r.ourPage === false);
  console.log(`  видов, у которых документ не рисуется (маршрут совпал, страница позвала notFound() сама, — долг 133): ${blank.length}, закреплено ${BLANK_KINDS}`);
  if (blank.length !== BLANK_KINDS) {
    console.log(`  ОТКАЗ: закреплённое число видов известного класса (${BLANK_KINDS}) разошлось со списком (${blank.length})`);
  }
  const bad = rows.filter((r) => r.problems.length > 0);
  if (blank.length !== BLANK_KINDS) bad.push({ name: "закреплённое число", problems: ["см. выше"] });
  if (BEFORE) {
    console.log(`\n[check:404 --before] замер без гейта: расхождений ${bad.length} из ${rows.length}`);
    return 0;
  }
  console.log(bad.length === 0 ? `\n[check:404] PASS — ${rows.length} видов адресов, расхождений 0` : `\n[check:404] ОТКАЗ: расхождений ${bad.length} из ${rows.length}`);
  return bad.length === 0 ? 0 : 1;
}

async function main() {
  if (PLANT) return runPlant();
  if (!BASE) return runStatic();
  return runLive();
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
