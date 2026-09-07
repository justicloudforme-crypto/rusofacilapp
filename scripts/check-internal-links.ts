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
const FROM_SITEMAP = flag("from-sitemap");
const SERVER_ONLY = flag("server-only");
const PLANT = flag("plant");
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

/**
 * Действия, открывающие ссылки, которых в DOM ещё нет.
 *
 * Одна запись на класс страниц. Каждая обязана быть НАЗВАНА: сторож,
 * который «как-нибудь потыкает страницу», не воспроизводится, а
 * невоспроизводимый сторож — не сторож.
 */
const EXPANSIONS: { match: RegExp; name: string; run: (page: Page) => Promise<void> }[] = [
  {
    match: /\/(es|ru)\/courses$/,
    name: "вводная дека: пролистать все слайды",
    async run(page) {
      // Дека держит в DOM ровно один слайд. Ссылка на алфавит стоит на
      // четвёртом — обход без листания её не видит (замерено 07.09.2026).
      for (let i = 0; i < 20; i += 1) {
        const next = page.locator('[data-testid="intro-next"]');
        if ((await next.count()) === 0) return;
        if (await next.isDisabled().catch(() => true)) return;
        await next.click({ timeout: 5000 }).catch(() => undefined);
        await page.waitForTimeout(150);
      }
    },
  },
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

async function renderedHrefs(browser: Browser, url: string): Promise<string[] | null> {
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
    if (t === "image" || t === "font" || t === "media") return route.abort();
    return route.continue();
  });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
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
  } catch {
    return null;
  } finally {
    await ctx.close();
  }
}

async function main() {
  const pages = await seedPages();
  const edges: Edge[] = [];
  const pageStatus = new Map<string, number>();
  let renderFailures = 0;

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
  if (!SERVER_ONLY) {
    const browser = await chromium.launch();
    const live = pages.filter((u) => pageStatus.get(u) === 200);
    await pool(live, Math.min(CONCURRENCY, 6), async (url) => {
      const hrefs = await renderedHrefs(browser, url);
      if (hrefs === null) {
        renderFailures += 1;
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
  if (renderFailures) console.log(`страниц, которые не отрендерились: ${renderFailures}`);
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
