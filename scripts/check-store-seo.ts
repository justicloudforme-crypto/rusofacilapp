/**
 * «DESCARGAR LA APP» В ПОИСКЕ И GOOGLE PLAY В ДАННЫХ ОБ ОРГАНИЗАЦИИ —
 * заход 7.259.
 *
 * ОТКУДА. Приложение «RusoFácil: aprender ruso» опубликовано в Google Play
 * 07.10.2026. Заход 7.258 поставил бейдж на `/download`, но оставил две
 * правки в SEO-очереди, потому что обе ждали «дня, когда адрес магазина
 * станет настоящим»: страница `/download` была `noindex` и не стояла в
 * карте сайта, а у `organizationJsonLd` не было `sameAs`. Этот день
 * настал; сторож держит оба решения в обе стороны.
 *
 * ЧТО СТЕРЕЖЁТСЯ.
 *   1. СТАТИЧЕСКАЯ (без `--base`):
 *      а) у ответа БРАУЗЕРУ `/download` нет `robots` в метаданных, есть
 *         `routeAlternates(lang, "/download")` (canonical + hreflang, как у
 *         соседей); у ответа ПРИЛОЖЕНИЮ `noindex` остаётся;
 *      б) `/download` — в `staticPaths` карты сайта;
 *      в) `robots.ts` не закрывает `/es/download` и `/ru/download` (тем же
 *         матчером, что и `crawlable-surface.test.ts`);
 *      г) `organizationJsonLd` несёт `sameAs: [PLAY_STORE_URL]` только вне
 *         приложения, а каждый её вызов (и `websiteJsonLd`) передаёт
 *         признак приложения с сервера, а не буквальное `false`.
 *   2. ЖИВАЯ (`--base=…`):
 *      а) `/es/download` и `/ru/download` в браузере — 200, ни `noindex` в
 *         мете `robots`, ни в заголовке `X-Robots-Tag`; canonical — сама
 *         страница; hreflang es, ru, x-default — на `/…/download`;
 *      б) в `/sitemap.xml` есть обе `/…/download`;
 *      в) отданный `/robots.txt` их не закрывает;
 *      г) у каждой `Organization` в JSON-LD главной и «О проекте» (обе
 *         локали, включая вложенную в `WebSite.publisher`) в `sameAs` —
 *         страница Google Play; в ответе ПРИЛОЖЕНИЮ этих страниц адреса
 *         магазина нет вовсе, `Organization` при этом есть (иначе «нет
 *         sameAs» доказано пустотой), а `/download` приложению — `noindex`.
 *      Пустая выборка — красная.
 *
 * ЦЕНА В РАЗМЕТКЕ `/pricing` — заход 7.260. Product JSON-LD назывался
 * валютой страны посетителя (робот Google из США читал 8.66 / 51.92 /
 * 133 USD), а списываются везде песо. Теперь `Offer` — всегда базовые
 * цены в MXN из `plans.ts`, и они ВИДНЫ на странице любому читателю: на
 * карточках в Мексике и без курса, в сноске при пересчёте (правило Google
 * «цена разметки видна на странице»).
 *   1д) СТАТИКА: `pricingOffersJsonLd` берёт цену и валюту из `BASE_OFFERS`,
 *       `copy` не читает; `BASE_OFFERS` — `pesoOffer(plans.<план>.amountMxnCents)`
 *       по каждому плану, `pesoOffer` — валюта `BASE_CURRENCY`; страница не
 *       передаёт в разметку `copy`; сноска с базовыми ценами стоит под тем же
 *       условием `copy.converted`, что и пересчёт. И ИСПОЛНЕНИЕМ: настоящая
 *       функция отдаёт три `Offer` в MXN, равные `plans.ts`.
 *   2д) ЖИВАЯ: `/es|ru/pricing` с `x-vercel-ip-country` MX, US, ES — у каждой
 *       отдачи один Product, три `Offer`, `priceCurrency` MXN, цены = `plans.ts`,
 *       и каждая цена, записанная как её читает человек («$2,299 MXN»), есть
 *       в ВИДИМОМ тексте страницы. Против прода страна берётся по IP, а не из
 *       заголовка, — сторож печатает, сколько разных отрисовок он увидел.
 *   `--plant` — в обе половины: подсадки в исходники и в отдачу;
 *   настоящие файлы и настоящая отдача — отрицательный контроль.
 *
 *   npx tsx scripts/check-store-seo.ts [--plant]
 *   npx tsx scripts/check-store-seo.ts --base=http://… [--plant]
 *   npx tsx scripts/check-store-seo.ts --base=https://rusofacilapp.com   (прод после выката)
 */
import { readFileSync } from "node:fs";
import { isEntryPoint } from "../src/lib/entry-point";
import { isDisallowed, parseRobotsTxt, decidingRule } from "../src/lib/robots-matcher";
import { formatMoney, plans } from "../src/lib/plans";
import { pricingOffersJsonLd } from "../src/lib/pricing-display";

export const PLAY_URL = "https://play.google.com/store/apps/details?id=com.rusofacilapp.app";
const LANGS = ["es", "ru"] as const;
const UA = "Mozilla/5.0 (Linux; Android 16; POCO) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Mobile Safari/537.36";
const APP_UA = `${UA} RFNativeShell/14`;

const FILES = {
  download: "src/app/[lang]/download/page.tsx",
  sitemap: "src/app/sitemap.ts",
  robots: "src/app/robots.ts",
  site: "src/lib/site.ts",
  home: "src/app/[lang]/page.tsx",
  about: "src/app/[lang]/sobre-nosotros/page.tsx",
  pricingDisplay: "src/lib/pricing-display.ts",
  pricing: "src/app/[lang]/pricing/page.tsx",
} as const;
type Files = Record<(typeof FILES)[keyof typeof FILES], string>;

// ------------------------------------------------------------ статика

function block(src: string, re: RegExp): string {
  return re.exec(src)?.[1] ?? "";
}

export function judgeStatic(f: Files): string[] {
  const bad: string[] = [];
  const dl = f[FILES.download];
  const gm = dl.slice(dl.indexOf("export async function generateMetadata"), dl.indexOf("export default async function"));
  if (!gm) bad.push(`${FILES.download}: generateMetadata не найден — сторож ослеп`);
  const shellAt = gm.indexOf("if (await isNativeShellRequest()) {");
  const shellEnd = shellAt < 0 ? -1 : gm.indexOf("\n  }\n", shellAt);
  if (shellAt < 0 || shellEnd < 0) {
    bad.push(`${FILES.download}: ветки приложения в метаданных нет — ответ приложению потерял свой noindex`);
  } else {
    const shell = gm.slice(shellAt, shellEnd);
    const web = gm.slice(shellEnd);
    if (!/robots:\s*\{\s*index:\s*false/.test(shell)) bad.push(`${FILES.download}: у ответа приложению нет noindex — его содержимое не для поиска`);
    if (/\brobots\s*:/.test(web)) bad.push(`${FILES.download}: у ответа браузеру снова есть robots — страница «Descargar la app» выпадает из поиска`);
    if (!/\balternates\b/.test(web)) bad.push(`${FILES.download}: у ответа браузеру нет alternates — ни canonical, ни hreflang`);
  }
  if (!/routeAlternates\(lang, "\/download"\)/.test(gm)) bad.push(`${FILES.download}: alternates — не routeAlternates(lang, "/download")`);

  const staticPaths = block(f[FILES.sitemap], /const staticPaths = \[([\s\S]*?)\n {2}\];/);
  if (!staticPaths) bad.push(`${FILES.sitemap}: staticPaths не найден — сторож ослеп`);
  else if (!/^\s*"\/download",/m.test(staticPaths)) bad.push(`${FILES.sitemap}: "/download" нет в staticPaths — страницы нет в карте сайта`);

  const disallows = [...block(f[FILES.robots], /disallow: \[([\s\S]*?)\n {8}\],/).matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  const allowsRaw = block(f[FILES.robots], /allow: \[([\s\S]*?)\],/);
  const allows = [...allowsRaw.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  if (disallows.length < 5 || !allows.includes("/")) bad.push(`${FILES.robots}: списки allow/disallow не прочитаны — сторож ослеп`);
  for (const lang of LANGS) {
    if (isDisallowed(`/${lang}/download`, disallows, allows)) bad.push(`${FILES.robots}: /${lang}/download закрыт robots.txt`);
  }

  const site = f[FILES.site];
  const org = site.slice(site.indexOf("export function organizationJsonLd"), site.indexOf("export function websiteJsonLd"));
  if (!/export function organizationJsonLd\(lang: Locale, nativeShell: boolean\)/.test(org)) {
    bad.push(`${FILES.site}: organizationJsonLd не принимает признак приложения — адрес магазина попадёт в ответ приложению`);
  }
  if (!/\.\.\.\(nativeShell \? \{\} : \{ sameAs: \[PLAY_STORE_URL\] \}\)/.test(org)) {
    bad.push(`${FILES.site}: у Organization нет sameAs: [PLAY_STORE_URL] вне приложения`);
  }
  if (!/import \{ PLAY_STORE_URL \} from "@\/lib\/pwa-manifest";/.test(site)) bad.push(`${FILES.site}: PLAY_STORE_URL не из pwa-manifest.ts — адрес магазина записан второй раз`);
  if (!/publisher: organizationJsonLd\(lang, nativeShell\)/.test(site)) bad.push(`${FILES.site}: WebSite.publisher не передаёт признак приложения`);

  for (const key of ["home", "about"] as const) {
    const src = f[FILES[key]];
    const calls = [...src.matchAll(/\b(organizationJsonLd|websiteJsonLd)\(([^)]*)\)/g)].filter((m) => !/^import/.test(m[0]));
    const real = calls.filter((m) => m[2].trim() !== "" && !/^\s*lang\s*:/.test(m[2]));
    if (real.length === 0) bad.push(`${FILES[key]}: вызова organizationJsonLd нет — Organization пропала со страницы`);
    for (const m of real) {
      if (!/^lang, nativeShell$/.test(m[2].trim())) bad.push(`${FILES[key]}: ${m[1]}(${m[2]}) — признак приложения не с сервера`);
    }
    if (!/isNativeShellRequest\(\)/.test(src)) bad.push(`${FILES[key]}: признак приложения не спрашивается у сервера`);
  }

  // 1д) цена в разметке /pricing — песо из plans.ts (7.260)
  const pd = f[FILES.pricingDisplay];
  const fnAt = pd.indexOf("export function pricingOffersJsonLd(");
  const fn = fnAt < 0 ? "" : pd.slice(fnAt);
  if (!fn) bad.push(`${FILES.pricingDisplay}: pricingOffersJsonLd не найдена — сторож ослеп`);
  else {
    if (!/price: BASE_OFFERS\[plan\]\.price,/.test(fn) || !/priceCurrency: BASE_OFFERS\[plan\]\.currency,/.test(fn)) {
      bad.push(`${FILES.pricingDisplay}: Offer берёт цену не из BASE_OFFERS — в разметку уйдёт пересчёт по стране, а не списываемые песо`);
    }
    if (/\bcopy\b/.test(fn)) bad.push(`${FILES.pricingDisplay}: pricingOffersJsonLd снова читает copy — цена разметки пойдёт за валютой посетителя`);
  }
  const offersDef = block(pd, /export const BASE_OFFERS[^=]*= \{([\s\S]*?)\n\};/);
  for (const plan of PLANS) {
    if (!new RegExp(`\\b${plan}: pesoOffer\\(plans\\.${plan}\\.amountMxnCents\\),`).test(offersDef)) {
      bad.push(`${FILES.pricingDisplay}: BASE_OFFERS.${plan} — не pesoOffer(plans.${plan}.amountMxnCents): цена записана мимо источника цен`);
    }
  }
  if (!/currency: BASE_CURRENCY\.toUpperCase\(\),/.test(block(pd, /export function pesoOffer\([\s\S]*?\{([\s\S]*?)\n\}/))) {
    bad.push(`${FILES.pricingDisplay}: pesoOffer — валюта не BASE_CURRENCY`);
  }
  const pg = f[FILES.pricing];
  const call = block(pg, /pricingOffersJsonLd\(\{([\s\S]*?)\}\)\}/);
  if (!call) bad.push(`${FILES.pricing}: вызова pricingOffersJsonLd нет — Product пропал со страницы`);
  else if (/\bcopy\b/.test(call)) bad.push(`${FILES.pricing}: в разметку передаётся copy — цена пойдёт за валютой посетителя`);
  if (!/\{copy\.converted && \([\s\S]{0,200}withBasePrices\(p\.approxNote, basePricesText\(lang\)\)/.test(pg)) {
    bad.push(`${FILES.pricing}: сноска с базовыми ценами не стоит под copy.converted — при пересчёте цены в песо на странице может не оказаться`);
  }
  return bad;
}

const PLANS = ["monthly", "annual", "lifetime"] as const;

/** Цены, которые обязана нести разметка: из источника цен сайта, как
 * schema.org их пишет («150», «2299»), и как их читает человек («$2,299 MXN»). */
export const EXPECTED_OFFERS = PLANS.map((plan) => {
  const cents = plans[plan].amountMxnCents;
  const price = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return { plan, price, written: formatMoney(cents) };
});

interface OfferLike {
  "@type"?: unknown;
  price?: unknown;
  priceCurrency?: unknown;
}

/** Суд над списком Offer: три штуки, MXN, цены = plans.ts по порядку. */
export function judgeOffers(where: string, offers: OfferLike[] | null): string[] {
  if (!offers) return [`${where}: Product с offers нет`];
  const bad: string[] = [];
  if (offers.length !== PLANS.length) bad.push(`${where}: Offer ${offers.length}, а не ${PLANS.length}`);
  offers.forEach((o, i) => {
    const want = EXPECTED_OFFERS[i];
    if (o.priceCurrency !== "MXN") bad.push(`${where}: Offer ${i + 1} — priceCurrency ${String(o.priceCurrency)}, а списываются MXN`);
    if (want && o.price !== want.price) bad.push(`${where}: Offer ${i + 1} — price ${String(o.price)}, а в plans.ts ${want.price}`);
  });
  return bad;
}

/** Настоящая функция разметки, исполненная: то, что уйдёт в обе локали. */
export function realOffers(lang: "es" | "ru"): OfferLike[] {
  return pricingOffersJsonLd({
    lang,
    url: `https://rusofacilapp.com/${lang}/pricing`,
    name: "x",
    description: "x",
    planNames: { monthly: "m", annual: "a", lifetime: "l" },
  }).offers;
}

// -------------------------------------------------------------- живая

interface Page {
  path: string;
  status: number;
  html: string;
  robotsHeader: string;
}
interface PricingPage extends Page {
  country: string;
}
export interface Snapshot {
  web: Page[];
  app: Page[];
  sitemap: string | null;
  robots: string | null;
  pricing?: PricingPage[];
}

async function fetchPage(base: string, path: string, app: boolean, country?: string): Promise<Page> {
  const headers: Record<string, string> = { "user-agent": app ? APP_UA : UA };
  if (app) headers.cookie = "rf_native_shell=1; rf_shell_version=14";
  if (country) headers["x-vercel-ip-country"] = country;
  try {
    const res = await fetch(`${base}${path}`, { headers, redirect: "manual", signal: AbortSignal.timeout(60_000) });
    return { path, status: res.status, html: await res.text(), robotsHeader: res.headers.get("x-robots-tag") ?? "" };
  } catch (e) {
    return { path, status: 0, html: String(e), robotsHeader: "" };
  }
}

const ORG_PAGES = LANGS.flatMap((l) => [`/${l}`, `/${l}/sobre-nosotros`]);
const DL_PAGES = LANGS.map((l) => `/${l}/download`);

async function snapshot(base: string): Promise<Snapshot> {
  const web: Page[] = [];
  const app: Page[] = [];
  for (const p of [...DL_PAGES, ...ORG_PAGES]) {
    web.push(await fetchPage(base, p, false));
    app.push(await fetchPage(base, p, true));
  }
  const pricing: PricingPage[] = [];
  for (const lang of LANGS) {
    for (const country of PRICING_COUNTRIES) pricing.push({ ...(await fetchPage(base, `/${lang}/pricing`, false, country)), country });
  }
  const sm = await fetchPage(base, "/sitemap.xml", false);
  const rb = await fetchPage(base, "/robots.txt", false);
  return { web, app, sitemap: sm.status === 200 ? sm.html : null, robots: rb.status === 200 ? rb.html : null, pricing };
}

/** MX — песо на карточках; US и ES — пересчёт (если сервер принял страну и
 * курс пришёл). Минимум, названный заходом 7.260. */
const PRICING_COUNTRIES = ["MX", "US", "ES"] as const;

/** Текст, который видит человек: без скриптов, стилей и тегов, сущности
 * раскодированы (PROGRESS.md 4.3). */
export function visibleText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|&#xa0;/gi, "\u00a0")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** Все Product в JSON-LD отдачи. */
export function products(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const d = JSON.parse(m[1]);
      for (const x of Array.isArray(d) ? d : [d]) if (x && x["@type"] === "Product") out.push(x);
    } catch {
      out.push({ "@type": "Product", __broken: true });
    }
  }
  return out;
}

/** Валюта карточек: «≈ 8,66 USD*» → USD; песо → MXN. Для отчёта о том,
 * сколько разных отрисовок сторож на самом деле видел. */
function cardCurrency(text: string): string {
  return /≈\s?[\d.,\u00a0\u202f ]+\s([A-Z]{3})\*/.exec(text)?.[1] ?? "MXN";
}

export function judgePricing(pages: PricingPage[] | undefined): string[] {
  if (!pages || pages.length === 0) return ["/pricing: выборка пуста — сторож ослеп, а не доволен"];
  const bad: string[] = [];
  const expected = LANGS.length * PRICING_COUNTRIES.length;
  if (pages.length < expected) bad.push(`/pricing: отдач ${pages.length} из ${expected} — часть выборки потеряна`);
  for (const p of pages) {
    const where = `${p.path} (${p.country})`;
    if (p.status !== 200) {
      bad.push(`${where}: ответ ${p.status}`);
      continue;
    }
    const prods = products(p.html);
    if (prods.length !== 1) {
      bad.push(`${where}: Product в JSON-LD — ${prods.length}, а не 1`);
      continue;
    }
    if (prods[0].__broken) {
      bad.push(`${where}: JSON-LD не разбирается`);
      continue;
    }
    bad.push(...judgeOffers(where, Array.isArray(prods[0].offers) ? (prods[0].offers as OfferLike[]) : null));
    const text = visibleText(p.html);
    for (const o of EXPECTED_OFFERS) {
      if (!text.includes(o.written)) bad.push(`${where}: «${o.written}» нет в видимом тексте — цена разметки не видна на странице`);
    }
  }
  return bad;
}

export function pricingRenderings(pages: PricingPage[] | undefined): string {
  return (pages ?? []).map((p) => `${p.country}→${cardCurrency(visibleText(p.html))}`).filter((v, i, a) => a.indexOf(v) === i).join(", ");
}

function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}
function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? (m[2] ?? m[3] ?? "").replace(/&amp;/g, "&") : null;
}
function metaNoindex(html: string): boolean {
  return tags(html, "meta").some((t) => /^(robots|googlebot)$/i.test(attr(t, "name") ?? "") && /\bnoindex\b/i.test(attr(t, "content") ?? ""));
}

/** Все объекты @type Organization в JSON-LD страницы, включая вложенные. */
export function organizations(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (o["@type"] === "Organization") out.push(o);
      Object.values(o).forEach(walk);
    }
  };
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1]));
    } catch {
      out.push({ "@type": "Organization", __broken: true });
    }
  }
  return out;
}

export function judgeLive(s: Snapshot): string[] {
  const bad: string[] = [];
  if (s.web.length === 0 || s.app.length === 0) return ["выборка пуста — сторож ослеп, а не доволен"];
  const expected = DL_PAGES.length + ORG_PAGES.length;
  if (s.web.length < expected || s.app.length < expected) bad.push(`страниц ${s.web.length}/${s.app.length} из ${expected} — часть выборки потеряна`);

  for (const p of s.web.filter((x) => x.path.endsWith("/download"))) {
    const lang = p.path.split("/")[1];
    if (p.status !== 200) {
      bad.push(`${p.path} (браузер): ответ ${p.status}, а не 200`);
      continue;
    }
    if (metaNoindex(p.html)) bad.push(`${p.path} (браузер): в мете robots noindex — «Descargar la app» снова вне поиска`);
    if (/\bnoindex\b/i.test(p.robotsHeader)) bad.push(`${p.path} (браузер): X-Robots-Tag «${p.robotsHeader}»`);
    const links = tags(p.html, "link");
    const canonical = links.find((t) => (attr(t, "rel") ?? "").toLowerCase() === "canonical");
    if (!canonical || !(attr(canonical, "href") ?? "").endsWith(`/${lang}/download`)) {
      bad.push(`${p.path} (браузер): canonical «${canonical ? attr(canonical, "href") : "—"}», а не сама страница`);
    }
    for (const hl of ["es", "ru", "x-default"]) {
      const alt = links.find((t) => (attr(t, "rel") ?? "").toLowerCase() === "alternate" && (attr(t, "hreflang") ?? "").toLowerCase() === hl);
      const want = hl === "x-default" ? "/es/download" : `/${hl}/download`;
      if (!alt || !(attr(alt, "href") ?? "").endsWith(want)) bad.push(`${p.path} (браузер): hreflang ${hl} — «${alt ? attr(alt, "href") : "—"}», ожидается …${want}`);
    }
  }
  for (const p of s.app.filter((x) => x.path.endsWith("/download"))) {
    if (p.status === 200 && !metaNoindex(p.html)) bad.push(`${p.path} (приложение): нет noindex — содержимое ответа приложению не для поиска`);
  }

  if (s.sitemap === null) bad.push("/sitemap.xml: не отдан");
  else {
    const locs = new Set([...s.sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname));
    if (locs.size === 0) bad.push("/sitemap.xml: ни одного <loc> — сторож ослеп");
    for (const p of DL_PAGES) if (!locs.has(p)) bad.push(`/sitemap.xml: ${p} нет в карте сайта`);
  }

  if (s.robots === null) bad.push("/robots.txt: не отдан");
  else {
    const rules = parseRobotsTxt(s.robots);
    if (rules.length === 0) bad.push("/robots.txt: правил не прочитано — сторож ослеп");
    for (const p of DL_PAGES) {
      const rule = decidingRule(p, rules);
      if (rule && !rule.allow) bad.push(`/robots.txt: ${p} закрыт строкой «Disallow: ${rule.pattern}»`);
    }
  }

  for (const p of s.web.filter((x) => ORG_PAGES.includes(x.path))) {
    if (p.status !== 200) {
      bad.push(`${p.path} (браузер): ответ ${p.status}`);
      continue;
    }
    const orgs = organizations(p.html);
    if (orgs.length === 0) bad.push(`${p.path} (браузер): Organization в JSON-LD нет`);
    for (const o of orgs) {
      const same = Array.isArray(o.sameAs) ? o.sameAs : o.sameAs ? [o.sameAs] : [];
      if (o.__broken) bad.push(`${p.path} (браузер): JSON-LD не разбирается`);
      else if (!same.includes(PLAY_URL)) bad.push(`${p.path} (браузер): у Organization sameAs ${JSON.stringify(same)} — нет страницы Google Play`);
    }
  }
  for (const p of s.app.filter((x) => ORG_PAGES.includes(x.path))) {
    if (p.status !== 200) {
      bad.push(`${p.path} (приложение): ответ ${p.status}`);
      continue;
    }
    if (!/<html\b[^>]*\bdata-shell="1"/.test(p.html)) bad.push(`${p.path} (приложение): у <html> нет data-shell — это не ответ приложению`);
    if (organizations(p.html).length === 0) bad.push(`${p.path} (приложение): Organization нет вовсе — «нет sameAs» доказано пустотой`);
    if (p.html.includes("play.google.com/store/apps")) bad.push(`${p.path} (приложение): адрес магазина в ответе приложению`);
  }
  bad.push(...judgePricing(s.pricing));
  return bad;
}

// ---------------------------------------------------------------- суд

function readFiles(): Files {
  const out = {} as Files;
  for (const p of Object.values(FILES)) out[p] = readFileSync(p, "utf8");
  return out;
}

function report(name: string, cases: [string, boolean][], clean: boolean): number {
  let caught = 0;
  for (const [label, hit] of cases) {
    if (hit) caught++;
    console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${label}`);
  }
  console.log(`  ${clean ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящие данные (отрицательный контроль)`);
  const ok = clean && caught === cases.length;
  console.log(ok ? `${name} --plant — ${caught} из ${cases.length} подсадок, 1 из 1 отрицательный контроль` : `${name} --plant — FAILED`);
  return ok ? 0 : 1;
}

function staticMain(plant: boolean): number {
  const f = readFiles();
  const bad = [
    ...judgeStatic(f),
    ...LANGS.flatMap((lang) => {
      try {
        return judgeOffers(`pricingOffersJsonLd("${lang}")`, realOffers(lang));
      } catch (e) {
        return [`pricingOffersJsonLd("${lang}") без copy не исполняется (${(e as Error).message}) — разметка зависит от пересчёта`];
      }
    }),
  ];
  if (plant) {
    const edit = (path: string, from: string | RegExp, to: string): Files | null => {
      const next = f[path as keyof Files].replace(from, to);
      return next === f[path as keyof Files] ? null : { ...f, [path]: next };
    };
    const planted: [string, Files | null, string][] = [
      ["noindex вернулся в ответ браузеру /download", edit(FILES.download, "    description: truncateForMeta(dict.download.pageSubtitle),\n", "    description: truncateForMeta(dict.download.pageSubtitle),\n    robots: { index: false, follow: true },\n"), "снова есть robots"],
      ["ответ приложению /download потерял noindex", edit(FILES.download, "description: copy.body, robots: { index: false }, alternates", "description: copy.body, alternates"), "нет noindex"],
      ["/download вычеркнут из карты сайта", edit(FILES.sitemap, /\n {4}"\/download",/, ""), "нет в staticPaths"],
      ["robots.txt закрывает /download", edit(FILES.robots, '          "/api/",', '          "/api/",\n          "/*/download",'), "закрыт robots.txt"],
      ["sameAs убран из Organization", edit(FILES.site, "    ...(nativeShell ? {} : { sameAs: [PLAY_STORE_URL] }),\n", ""), "нет sameAs"],
      ["sameAs выдаётся и приложению", edit(FILES.site, "...(nativeShell ? {} : { sameAs: [PLAY_STORE_URL] })", "sameAs: [PLAY_STORE_URL]"), "нет sameAs"],
      ["главная передаёт буквальное false", edit(FILES.home, "organizationJsonLd(lang, nativeShell)", "organizationJsonLd(lang, false)"), "не с сервера"],
      ["«О проекте» передаёт буквальное false", edit(FILES.about, "organizationJsonLd(lang, nativeShell)", "organizationJsonLd(lang, false)"), "не с сервера"],
      ["разметка цен снова из copy (как до 7.260)", edit(FILES.pricingDisplay, "price: BASE_OFFERS[plan].price,", "price: copy.offers[plan].price,"), "не из BASE_OFFERS"],
      ["валюта разметки — валюта посетителя", edit(FILES.pricingDisplay, "priceCurrency: BASE_OFFERS[plan].currency,", "priceCurrency: copy.offers[plan].currency,"), "не из BASE_OFFERS"],
      ["цена годового вписана руками", edit(FILES.pricingDisplay, "annual: pesoOffer(plans.annual.amountMxnCents),", 'annual: { price: "899", currency: "MXN" },'), "мимо источника цен"],
      ["pesoOffer с валютой USD", edit(FILES.pricingDisplay, "currency: BASE_CURRENCY.toUpperCase(),", 'currency: "USD",'), "не BASE_CURRENCY"],
      ["страница передаёт copy в разметку", edit(FILES.pricing, "          planNames: { monthly: p.monthly.name, annual: p.annual.name, lifetime: p.lifetime.name },\n        })}", "          planNames: { monthly: p.monthly.name, annual: p.annual.name, lifetime: p.lifetime.name },\n          copy,\n        })}"), "передаётся copy"],
      ["сноска с песо снята со страницы", edit(FILES.pricing, "{copy.converted && (", "{false && ("), "сноска с базовыми ценами"],
    ];
    const cases: [string, boolean][] = planted.map(([label, files, expect]) => [
      files ? label : `${label} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`,
      files !== null && judgeStatic(files).some((x) => x.includes(expect)),
    ]);
    // Исполненная функция: испорченный выход обязан ловиться тем же судом.
    const real = realOffers("es");
    const offerPlants: [string, OfferLike[]][] = [
      ["Offer в USD (8.66 / 51.92 / 133 — что видел робот из США)", [{ price: "8.66", priceCurrency: "USD" }, { price: "51.92", priceCurrency: "USD" }, { price: "133", priceCurrency: "USD" }]],
      ["неверное число у годового", real.map((o, i) => (i === 1 ? { ...o, price: "900" } : o))],
      ["Offer потерян", real.slice(0, 2)],
    ];
    for (const [label, offers] of offerPlants) cases.push([`исполнение: ${label}`, judgeOffers("plant", offers).length > 0]);
    return report("check:store-seo", cases, bad.length === 0);
  }
  if (bad.length) {
    console.error(`check:store-seo — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(`check:store-seo — /download индексируется (браузер без robots, приложение noindex), в карте сайта, robots.txt открыт; Organization.sameAs = Google Play вне приложения, вызовов 3; Product на /pricing — ${EXPECTED_OFFERS.map((o) => `${o.price} MXN`).join(" / ")} из plans.ts, сноска с песо под copy.converted; нарушений 0`);
  return 0;
}

async function liveMain(base: string, plant: boolean): Promise<number> {
  const s = await snapshot(base);
  const bad = judgeLive(s);
  if (plant) {
    const map = (pages: Page[], fn: (p: Page) => Page) => pages.map(fn);
    const variants: [string, Snapshot][] = [
      ["noindex в мете /download браузеру", { ...s, web: map(s.web, (p) => (p.path === "/es/download" ? { ...p, html: p.html.replace("<head>", '<head><meta name="robots" content="NOINDEX, follow">') } : p)) }],
      ["X-Robots-Tag: noindex у /ru/download", { ...s, web: map(s.web, (p) => (p.path === "/ru/download" ? { ...p, robotsHeader: "noindex" } : p)) }],
      ["/download вычеркнут из карты", { ...s, sitemap: (s.sitemap ?? "").replace(/<url>(?:(?!<\/url>)[\s\S])*?\/es\/download<\/loc>[\s\S]*?<\/url>/, "") }],
      ["robots.txt закрывает /download", { ...s, robots: `${s.robots ?? ""}\nDisallow: /*/download\n` }],
      ["sameAs пропал у Organization главной", { ...s, web: map(s.web, (p) => (p.path === "/ru" ? { ...p, html: p.html.replaceAll(`"sameAs":["${PLAY_URL}"]`, '"sameAs":[]') } : p)) }],
      ["sameAs ведёт на чужой пакет", { ...s, web: map(s.web, (p) => (p.path === "/es/sobre-nosotros" ? { ...p, html: p.html.replaceAll(PLAY_URL, "https://play.google.com/store/apps/details?id=x") } : p)) }],
      ["sameAs подсажен в ответ приложению", { ...s, app: map(s.app, (p) => (p.path === "/es" ? { ...p, html: p.html.replace('"@type":"Organization",', `"@type":"Organization","sameAs":["${PLAY_URL}"],`) } : p)) }],
      ["ответ браузера выдан за ответ приложения", { ...s, app: s.web }],
      ["выборка пуста", { web: [], app: [], sitemap: null, robots: null }],
      ["/pricing (US): Offer в USD", { ...s, pricing: (s.pricing ?? []).map((p) => (p.path === "/es/pricing" && p.country === "US" ? { ...p, html: p.html.replaceAll('"priceCurrency":"MXN"', '"priceCurrency":"USD"') } : p)) }],
      ["/pricing (ES): неверное число у Premium", { ...s, pricing: (s.pricing ?? []).map((p) => (p.path === "/ru/pricing" && p.country === "ES" ? { ...p, html: p.html.replace(/"price":"2299"/, '"price":"2399"') } : p)) }],
      ["/pricing (US): песо не видны на странице", { ...s, pricing: (s.pricing ?? []).map((p) => (p.path === "/es/pricing" && p.country === "US" ? { ...p, html: p.html.replaceAll(EXPECTED_OFFERS[1].written, "") } : p)) }],
      ["/pricing (MX): Product пропал", { ...s, pricing: (s.pricing ?? []).map((p) => (p.path === "/ru/pricing" && p.country === "MX" ? { ...p, html: p.html.replace('"@type":"Product"', '"@type":"Thing"') } : p)) }],
      ["/pricing: выборка пуста", { ...s, pricing: [] }],
    ];
    const cases: [string, boolean][] = variants.map(([label, v]) => [label, judgeLive(v).length > 0]);
    return report("check:store-seo (живая)", cases, bad.length === 0);
  }
  if (bad.length) {
    console.error(`check:store-seo (живая, ${base}) — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  const orgCount = s.web.filter((p) => ORG_PAGES.includes(p.path)).reduce((n, p) => n + organizations(p.html).length, 0);
  console.log(
    `check:store-seo (живая, ${base}) — /es и /ru /download: 200, без noindex, canonical и hreflang на месте, в карте сайта, robots.txt открыт; Organization на ${ORG_PAGES.length} страницах — ${orgCount}, у каждой sameAs Google Play; в ответах приложению адреса магазина 0; /pricing ${s.pricing?.length ?? 0} отдач (страна→карточки: ${pricingRenderings(s.pricing)}) — Offer ${EXPECTED_OFFERS.map((o) => `${o.price}`).join(" / ")} MXN, каждая цена видна на странице`,
  );
  return 0;
}

async function main(): Promise<number> {
  const plant = process.argv.includes("--plant");
  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  return baseArg ? liveMain(baseArg.slice("--base=".length).replace(/\/$/, ""), plant) : staticMain(plant);
}

if (isEntryPoint(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
