/**
 * Ни одна внутренняя ссылка не ведёт в не-200.
 *
 * Зачем сторож, а не одноразовый обход. 07.09.2026 человек нашёл с
 * телефона: на `/ru` во вводной презентации ссылка «Открыть кириллицу»
 * ведёт на `/ru/alfabeto-cirilico` и отдаёт 404. Страница существует
 * только на `/es` (`if (lang !== "es") notFound()` — девятнадцать таких
 * маршрутов), а ссылка строилась как `/${lang}${link.href}`, то есть
 * префикс приклеивался к пути, которого во второй локали нет. Ни одна
 * проверка проекта этого не видела, и вот почему:
 *
 *   - `check:reachability` читает только СЕРВЕРНЫЙ HTML и спрашивает
 *     «достижим ли адрес из sitemap», а не «куда ведут ссылки»;
 *   - `check:rendered` открывает браузер, но смотрит на содержимое
 *     страницы, а не на её ссылки;
 *   - перепись 7.131 нашла 16 таких адресов и записала их в норму
 *     («404 по замыслу»), потому что спрашивала про КРАУЛИМОСТЬ, а не
 *     про то, печатает ли сайт на них ссылку.
 *
 * Что считается ребром. `<a href>` из ДВУХ источников на каждой
 * странице: серверный HTML и отрендеренный DOM после гидрации. Одного
 * источника не хватает, и это замерено: `/ru/alfabeto-cirilico` в
 * серверном HTML `/ru/courses` отсутствует вовсе — дека это клиентский
 * компонент, и её ссылки появляются только после гидрации.
 *
 * Что считается битым. Цель, у которой КОНЕЧНЫЙ код после прохода по
 * редиректам того же origin не 200. Это важнее, чем «первый ответ 200»:
 * 400 платных пазлов отвечают 307 в `/pricing`, и это не битая ссылка —
 * человек попадает на настоящую страницу. А 404 — тупик.
 *
 * ЧЕГО СТОРОЖ НЕ ВИДИТ, и это названо, а не замазано: ссылки, которые
 * печатаются только после действия человека. Дека показывает по одному
 * слайду за раз, поэтому обход, который её не листает, видит 1 ссылку
 * из 2 — ровно тот случай, ради которого сторож написан. Поэтому
 * действия перечислены поимённо в EXPANSIONS ниже; страница с
 * неперечисленным действием меряется без него, и число таких страниц
 * печатается в итоге.
 *
 *   npx tsx scripts/check-internal-links.ts                    # набор CI
 *   npx tsx scripts/check-internal-links.ts --plant            # позитивный контроль
 *   npx tsx scripts/check-internal-links.ts --base=https://rusofacilapp.com --from-sitemap
 *   npx tsx scripts/check-internal-links.ts --server-only      # без браузера (быстро, половина сайта)
 *   npx tsx scripts/check-internal-links.ts --plant-render-failure  # контроль отчёта об отказах
 *
 * ОТКАЗЫ РЕНДЕРА печатаются поимённо, с причиной и временем — всегда, в
 * том числе когда их ноль. До 07.09.2026 здесь стоял счётчик и
 * `catch { return null }`, и два захода подряд нельзя было назвать ни одну
 * из 39, а затем 93 не отрендерившихся страниц (долг 66). Ждём `load`, а не
 * `networkidle`: на сайте с постоянным префетчем тишины не бывает, и
 * ожидание тишины давало 3–5 % неосмотренных страниц случайным составом и
 * прогон в 2 ч 40 мин (долг 67).
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { anchorTargets, normalizeUrl } from "../src/lib/link-graph";
import { isSpanishOnlyRoute } from "../src/lib/spanish-only-routes";
import { isEntryPoint } from "../src/lib/entry-point";

const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name: string) => argv.includes(`--${name}`);

const BASE = arg("base", "http://localhost:3000").replace(/\/$/, "");
const ORIGIN = new URL(BASE).origin;
const CONCURRENCY = Number(arg("concurrency", "8"));
/**
 * Сколько ждать страницу. Ждём `load`, а не `networkidle` (см. большой
 * комментарий у `renderedHrefs`), поэтому 30 с — это запас на порядок, а
 * не впритык: замер 07.09.2026 дал 0,9–1,4 с на страницу.
 */
const RENDER_TIMEOUT = Number(arg("render-timeout", "30000"));
/** Сколько контекстов браузера одновременно. Отдельно от `--concurrency`
 * (тот про HTTP): рендер дороже, и раньше это число было зашито. */
const RENDER_CONCURRENCY = Number(arg("render-concurrency", "6"));
const FROM_SITEMAP = flag("from-sitemap");
const SERVER_ONLY = flag("server-only");
const PLANT = flag("plant");
/**
 * Позитивный контроль для отчёта об отказах рендера: первой живой
 * странице обхода документ отдаётся `abort`, то есть она заведомо не
 * рендерится. Сторож обязан назвать её адрес и причину, а не только
 * посчитать. Без такого контроля строка «не отрендерилось: 0» не значит
 * ничего (правило замера 4.1).
 */
const PLANT_RENDER_FAILURE = flag("plant-render-failure");
const OUT = arg("out", "");
const MAX_PER_FAMILY = Number(arg("max-per-family", "0"));
/** Свой список путей вместо набора по умолчанию — для позитивного
 * контроля, которому хватает двух страниц, и для точечной перепроверки. */
const PATHS_ARG = arg("paths", "");
/**
 * «Каждая битая цель — настоящая». Для прогона против прода, где строки
 * в базе есть все. Без флага 404 на адресе, который читает базу,
 * считается «не проверено на этой базе», а не находкой.
 */
const REQUIRE_CONTENT = flag("require-content");

/** Подсаженная цель позитивного контроля. Такого маршрута нет и быть не может. */
const PLANTED_HREF = "/es/__planted-broken-link__";

/**
 * Набор страниц по умолчанию — тот, что переживает пустую базу CI.
 *
 * Это НЕ «весь сайт»: у CI база собирается `prisma db push` плюс
 * фикстура, и половина каталогов там пуста. Список подобран так, чтобы
 * каждый ШАБЛОН маршрута был представлен хотя бы одним адресом, потому
 * что ссылки печатает шаблон, а не строка. Полный обход прода делается
 * отдельно — `--from-sitemap`.
 */
const CI_PATHS = [
  "/es", "/ru",
  "/es/courses", "/ru/courses",
  "/es/courses/a1", "/ru/courses/a1",
  "/es/courses/a1/1", "/ru/courses/a1/1",
  "/es/stories", "/ru/stories",
  "/es/media", "/ru/media",
  "/es/word-games", "/ru/word-games",
  "/es/flashcards", "/ru/flashcards",
  "/es/glossary",
  "/es/vocabulary",
  "/es/gramatica",
  "/es/alfabeto-cirilico",
  "/es/juegos-para-aprender-ruso",
  "/es/pricing", "/ru/pricing",
  "/es/login", "/ru/login",
  "/es/register", "/ru/register",
  "/es/terms", "/ru/terms",
  "/es/privacy", "/ru/privacy",
  "/es/download", "/ru/download",
];

/** Одно раскрытие: где применяется, как называется и что делает. */
interface Expansion {
  match: RegExp;
  name: string;
  run: (page: Page) => Promise<void>;
}

/**
 * Пролистать вводную деку до конца.
 *
 * Отдельной ИМЕНОВАННОЙ функцией верхнего уровня, а не телом метода
 * внутри литерала таблицы, и это не стиль. `src/lib/entry-point.test.ts`
 * читает файлы `prisma/` и `scripts/` как ТЕКСТ (импортировать их — ровно
 * то, что он предотвращает) и опирается на одно соглашение, общее для всех
 * 58 файлов: объявление верхнего уровня начинается с нулевой колонки и
 * закрывается `}` в нулевой колонке. Многострочное тело внутри
 * `const X = [ … ]` этому соглашению не отвечает — сканер видел здесь
 * `await` на уровне модуля, то есть работу, которая началась бы от одного
 * импорта. Цена такой ошибки записана в самом стороже: 29.08.2026
 * read-only аудит импортировал `prisma/ensure-schema-sync.ts` ради
 * разборщика схемы, и мигратор боевой схемы выполнился.
 *
 * Здесь ничего не пишется в базу, но правило потому и правило, что не
 * проверяет намерения автора файла: любой `await` в области модуля —
 * работа, которую делает импорт.
 */
async function expandIntroDeck(page: Page): Promise<void> {
  // Кнопка деки появляется только после гидрации, а ждём мы теперь `load`,
  // который наступает раньше неё. Без этого ожидания первый же `count()`
  // вернул бы 0, дека осталась бы нелистанной — и сторож молча потерял бы
  // ровно тот класс ссылок, ради которого он написан. Отказ ожидания не
  // фатален: страница просто меряется без раскрытия, и она попадёт в
  // число страниц без раскрытия.
  await page.waitForSelector('[data-testid="intro-next"]', { timeout: 15_000 }).catch(() => undefined);
  // Дека держит в DOM ровно один слайд. Ссылка на алфавит стоит на
  // четвёртом — обход без листания её не видит (замерено 07.09.2026).
  for (let i = 0; i < 20; i += 1) {
    const next = page.locator('[data-testid="intro-next"]');
    if ((await next.count()) === 0) return;
    if (await next.isDisabled().catch(() => true)) return;
    await next.click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(150);
  }
}

/**
 * Действия, открывающие ссылки, которых в DOM ещё нет.
 *
 * Одна запись на класс страниц, и каждая обязана быть НАЗВАНА: сторож,
 * который «как-нибудь потыкает страницу», не воспроизводится, а
 * невоспроизводимый сторож — не сторож. Само действие живёт в именованной
 * функции выше, а не в теле литерала (см. её комментарий).
 */
const EXPANSIONS: Expansion[] = [
  { match: /\/(es|ru)\/courses$/, name: "вводная дека: пролистать все слайды", run: expandIntroDeck },
];

interface Edge { target: string; from: string; source: "server" | "rendered" }

/**
 * Адреса, чей 404 на базе БЕЗ содержимого ничего не говорит о ссылке.
 *
 * Ровно тот же класс ошибки, что стоил `check:layout` двух разных ответов
 * на один вопрос (PROGRESS 7.136 часть 4, 7.137 часть 2): страница
 * отвечает 404 не потому, что ссылка неверна, а потому, что строки, из
 * которой она рендерится, в этой базе нет. Считать это находкой —
 * получить красный сторож на пустой базе CI; считать это нормой всегда —
 * ослепнуть на проде. Поэтому список НАЗВАН, а решение принимает флаг
 * `--require-content`: против прода не прощается ничего.
 */
const CONTENT_BACKED = [
  /^\/(es|ru)\/glossary\/[^/]+$/,
  /^\/(es|ru)\/stories\/[^/]+$/,
  /^\/(es|ru)\/media\/[^/]+$/,
  /^\/(es|ru)\/word-games\/[^/]+/,
  /^\/(es|ru)\/vocabulary\/[^/]+$/,
  // Тематические лендинги и два игровых хаба встраивают НАСТОЯЩИЙ пазл и
  // без него вызывают notFound() — см. TopicLandingPage.
  /^\/(es|ru)\/sopa-de-letras[^/]*$/,
  /^\/(es|ru)\/crucigramas[^/]*$/,
];
const isContentBacked = (path: string) => CONTENT_BACKED.some((re) => re.test(path));

/**
 * Ссылка на маршрут, который существует только на `/es`, построенная с
 * ЧУЖИМ префиксом локали.
 *
 * Этот класс не зависит ни от какой базы: он доказывается кодом
 * (`SPANISH_ONLY_ROUTES` сверяется с файловой системой в обе стороны), и
 * потому краснеет всегда — и в CI на пустой базе, и на проде.
 */
function isForeignLocaleSpanishRoute(path: string): boolean {
  const m = path.match(/^\/(es|ru)(\/.*)$/);
  if (!m) return false;
  const [, lang, rest] = m;
  return lang !== "es" && isSpanishOnlyRoute(rest);
}

async function getHtml(url: string): Promise<{ status: number; body: string }> {
  try {
    const res = await fetch(url, { redirect: "manual", headers: { "user-agent": "rusofacilapp-linkcheck/1.0" } });
    const type = res.headers.get("content-type") ?? "";
    const body = res.status === 200 && type.includes("html") ? await res.text() : "";
    return { status: res.status, body };
  } catch {
    return { status: 0, body: "" };
  }
}

/** Конечный код после прохода по редиректам ТОГО ЖЕ origin. */
async function finalStatus(url: string): Promise<{ final: number; via: number[] }> {
  const via: number[] = [];
  let cur = url;
  for (let i = 0; i < 6; i += 1) {
    let res: Response;
    try {
      res = await fetch(cur, { redirect: "manual", headers: { "user-agent": "rusofacilapp-linkcheck/1.0" } });
    } catch {
      return { final: 0, via };
    }
    via.push(res.status);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { final: res.status, via };
      cur = new URL(loc, cur).toString();
      continue;
    }
    return { final: res.status, via };
  }
  return { final: -1, via };
}

async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i;
        i += 1;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

function family(url: string): string {
  const segs = url.slice(ORIGIN.length).split("/").filter(Boolean);
  return segs.slice(0, 2).join("/") || "/";
}

async function seedPages(): Promise<string[]> {
  if (PATHS_ARG) return PATHS_ARG.split(",").map((p) => ORIGIN + p.trim()).filter(Boolean);
  if (!FROM_SITEMAP) return CI_PATHS.map((p) => ORIGIN + p);
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/\/$/, ""));
  const roots = [`${ORIGIN}/es`, `${ORIGIN}/ru`];
  const all = [...new Set([...roots, ...locs])];
  if (!MAX_PER_FAMILY) return all;
  const seen = new Map<string, number>();
  return all.filter((u) => {
    const f = family(u);
    const n = (seen.get(f) ?? 0) + 1;
    seen.set(f, n);
    return n <= MAX_PER_FAMILY;
  });
}

/** Отказ рендера, названный поимённо: адрес, причина, сколько ждали. */
interface RenderFailure { url: string; reason: string; ms: number }

/**
 * Дождаться, пока список ссылок перестанет расти.
 *
 * Зачем это вместо `networkidle`. `load` наступает до гидрации, а часть
 * ссылок печатают клиентские компоненты. Ждать тишины в сети для этого
 * нельзя: сайт непрерывно префетчит маршруты, и окно тишины не наступает
 * вовсе (замер 07.09.2026: одна и та же страница — 5 успехов по ~2 с и
 * 1 отказ по полному таймауту из 6 попыток, промежуточных значений нет).
 * Поэтому ждём не сеть, а сам ответ на наш вопрос: число `<a href>`.
 * Условие ограничено сверху и всегда завершается.
 */
async function waitForLinksToSettle(page: Page): Promise<void> {
  let previous = -1;
  let stable = 0;
  for (let i = 0; i < 15; i += 1) {
    const n = await page.evaluate(() => document.querySelectorAll("a[href]").length).catch(() => -1);
    if (n < 0) return;
    stable = n === previous ? stable + 1 : 0;
    previous = n;
    if (stable >= 2) return;
    await page.waitForTimeout(200);
  }
}

async function renderedHrefs(browser: Browser, url: string, plantFailure = false): Promise<string[] | RenderFailure> {
  const ctx = await browser.newContext({ userAgent: "rusofacilapp-linkcheck-rendered/1.0" });
  if (PLANT) {
    // Подсадка живёт в самой странице, а не в разборе: контроль обязан
    // пройти тот же путь, что настоящая ссылка, иначе он проверяет
    // регулярку, а не сторожа.
    await ctx.addInitScript(`
      addEventListener("DOMContentLoaded", () => {
        const a = document.createElement("a");
        a.setAttribute("href", ${JSON.stringify(PLANTED_HREF)});
        a.textContent = "planted";
        document.body.appendChild(a);
      });
    `);
  }
  const page = await ctx.newPage();
  await page.route("**/*", (route) => {
    const t = route.request().resourceType();
    // Подсадка позитивного контроля: документ этой страницы не доедет
    // никогда, значит она заведомо не отрендерится. Отказ приходит по
    // тому же пути, что настоящий, — через `goto`, а не мимо него.
    if (plantFailure && t === "document") return route.abort("failed");
    if (t === "image" || t === "font" || t === "media") return route.abort();
    return route.continue();
  });
  const started = Date.now();
  try {
    // `load`, а НЕ `networkidle`. Полное обоснование — в комментарии
    // `waitForLinksToSettle` выше и в PROGRESS 7.138 (долг 67): на этом
    // сайте тишины в сети не бывает, поэтому `networkidle` — не «дольше
    // ждать», а лотерея, в которой 3–5 % страниц не осматриваются вовсе.
    await page.goto(url, { waitUntil: "load", timeout: RENDER_TIMEOUT });
    await waitForLinksToSettle(page);
    const collected = new Set<string>();
    const grab = async () => {
      const hrefs = await page.evaluate(() =>
        [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") ?? ""),
      );
      hrefs.forEach((h) => collected.add(h));
    };
    await grab();
    for (const step of EXPANSIONS) {
      if (!step.match.test(url)) continue;
      // Ссылки снимаются ПОСЛЕ каждого шага, а не один раз в конце:
      // дека выбрасывает предыдущий слайд из DOM.
      const before = collected.size;
      await step.run(page);
      await grab();
      void before;
    }
    return [...collected];
  } catch (error) {
    // ДОЛГ 66 закрыт здесь. Раньше стояло `catch { return null }`, наверх
    // шёл только счётчик, и назвать не отрендерившиеся страницы было
    // нельзя в принципе — два захода подряд оговорка оставалась
    // неснимаемой не потому, что причина сложная, а потому, что её
    // выбрасывали в этой строке.
    const reason = String(error instanceof Error ? error.message : error)
      .split("\n")[0]
      .replace(/\s+/g, " ")
      .slice(0, 160);
    return { url, reason, ms: Date.now() - started };
  } finally {
    await ctx.close();
  }
}

const isRenderFailure = (r: string[] | RenderFailure): r is RenderFailure => !Array.isArray(r);

async function main() {
  const pages = await seedPages();
  const edges: Edge[] = [];
  const pageStatus = new Map<string, number>();
  const renderFailures: RenderFailure[] = [];

  process.stderr.write(`страниц к обходу: ${pages.length}\n`);

  // --- Источник 1: серверный HTML. ---
  await pool(pages, CONCURRENCY, async (url) => {
    const { status, body } = await getHtml(url);
    pageStatus.set(url, status);
    if (status !== 200 || !body) return;
    const html = PLANT ? body.replace("</body>", `<a href="${PLANTED_HREF}">planted</a></body>`) : body;
    for (const t of anchorTargets(html, url, ORIGIN)) edges.push({ target: t, from: url, source: "server" });
  });

  // --- Источник 2: отрендеренный DOM. ---
  const expanded = new Set<string>();
  let plantedRenderFailurePage: string | undefined;
  if (!SERVER_ONLY) {
    const browser = await chromium.launch();
    const live = pages.filter((u) => pageStatus.get(u) === 200);
    plantedRenderFailurePage = PLANT_RENDER_FAILURE ? live[0] : undefined;
    await pool(live, RENDER_CONCURRENCY, async (url) => {
      const hrefs = await renderedHrefs(browser, url, url === plantedRenderFailurePage);
      if (isRenderFailure(hrefs)) {
        renderFailures.push(hrefs);
        return;
      }
      if (EXPANSIONS.some((e) => e.match.test(url))) expanded.add(url);
      for (const h of hrefs) {
        const t = normalizeUrl(h, url, ORIGIN);
        if (t) edges.push({ target: t, from: url, source: "rendered" });
      }
    });
    await browser.close();
  }

  // --- Проверка целей. ---
  const refs = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!refs.has(e.target)) refs.set(e.target, new Set());
    refs.get(e.target)!.add(e.from);
  }
  const targets = [...refs.keys()];
  const statuses = await pool(targets, CONCURRENCY, (t) => finalStatus(t));
  type Verdict = "чужая локаль" | "нет строк в базе" | "битая";
  const broken: { target: string; final: number; from: string[]; verdict: Verdict }[] = [];
  targets.forEach((t, i) => {
    if (statuses[i].final === 200) return;
    const path = t.slice(ORIGIN.length);
    const verdict: Verdict = isForeignLocaleSpanishRoute(path)
      ? "чужая локаль"
      : statuses[i].final === 404 && isContentBacked(path) && !REQUIRE_CONTENT
        ? "нет строк в базе"
        : "битая";
    broken.push({ target: t, final: statuses[i].final, from: [...refs.get(t)!], verdict });
  });
  const fatal = broken.filter((b) => b.verdict !== "нет строк в базе");
  const excused = broken.filter((b) => b.verdict === "нет строк в базе");

  const renderedOnly = new Set(edges.filter((e) => e.source === "rendered").map((e) => e.target));
  const serverSeen = new Set(edges.filter((e) => e.source === "server").map((e) => e.target));
  const onlyAfterHydration = [...renderedOnly].filter((t) => !serverSeen.has(t));

  console.log(`\nстраниц обойдено: ${pages.length}, из них отдали 200: ${[...pageStatus.values()].filter((s) => s === 200).length}`);
  console.log(`ссылок (страница → цель): ${edges.length}`);
  console.log(`различных целей: ${targets.length}`);
  console.log(`целей, которых нет в серверном HTML (только после гидрации): ${onlyAfterHydration.length}`);
  console.log(`страниц с раскрытием (${EXPANSIONS.map((e) => e.name).join("; ")}): ${expanded.size}`);
  console.log(`страниц, которые не отрендерились: ${renderFailures.length}`);
  // Поимённо и с причиной — всегда, а не «в отладочном режиме». Число без
  // состава не позволяет ни проверить гипотезу о причине, ни сравнить два
  // прогона между собой.
  for (const f of [...renderFailures].sort((a, b) => a.url.localeCompare(b.url))) {
    console.log(`  ✗ ${f.url.slice(ORIGIN.length)}  (${(f.ms / 1000).toFixed(1)} с)  ${f.reason}`);
  }
  console.log(`\nцелей с конечным кодом НЕ 200: ${broken.length}`);
  console.log(`из них разбор не выдерживают: ${fatal.length}; отложено «нет строк в этой базе»: ${excused.length}`);
  for (const b of [...fatal, ...excused].sort((a, b2) => b2.from.length - a.from.length)) {
    console.log(
      `  ${b.final}  [${b.verdict}]  ${b.target.slice(ORIGIN.length)}  ← ${b.from.length} стр.: ` +
        `${b.from.slice(0, 3).map((f) => f.slice(ORIGIN.length)).join(", ")}${b.from.length > 3 ? " …" : ""}`,
    );
  }
  if (!REQUIRE_CONTENT && excused.length) {
    console.log(`  (эти ${excused.length} не проверены: адрес читает базу, а она в этом прогоне без содержимого. Прогон против прода — \`--require-content\` — не прощает ни одного)`);
  }

  if (OUT) writeFileSync(OUT, JSON.stringify({ broken, targets: targets.length, edges: edges.length }, null, 1));

  if (PLANT_RENDER_FAILURE) {
    const named = renderFailures.filter((f) => f.url === plantedRenderFailurePage);
    console.log(`\nпозитивный контроль отказа рендера: подсажена 1 страница (${(plantedRenderFailurePage ?? "").slice(ORIGIN.length)})`);
    console.log(`названо ${named.length} из 1${named.length ? `: ${named[0].url.slice(ORIGIN.length)} — ${named[0].reason}` : ""}`);
    // Негативная половина: кроме подсадки не должно отказать ничего, иначе
    // «поймали 1 из 1» уживается с молчаливой потерей соседних страниц.
    console.log(`кроме подсадки не отрендерилось: ${renderFailures.length - named.length}`);
    process.exitCode = named.length === 1 && named[0].reason.length > 0 ? 0 : 1;
    return;
  }

  if (PLANT) {
    const caught = fatal.filter((b) => b.target.endsWith(PLANTED_HREF)).length;
    console.log(`\nпозитивный контроль: подсажено 1, поймано ${caught} из 1`);
    console.log(`кроме подсадки не прошедших разбор целей: ${fatal.length - caught}`);
    process.exitCode = caught === 1 ? 0 : 1;
    return;
  }

  /**
   * Пол: прогон, который ничего не обошёл, обязан краснеть.
   *
   * «0 битых» из обхода, где ни одна страница не отдала 200, — это ответ
   * про сервер, а не про ссылки, и он неотличим от настоящего нуля.
   */
  const alive = [...pageStatus.values()].filter((s) => s === 200).length;
  if (alive < Math.ceil(pages.length / 2)) {
    console.log(`\nпол обхода не взят: 200 отдали ${alive} страниц из ${pages.length}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = fatal.length ? 1 : 0;
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
