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
  return bad;
}

// -------------------------------------------------------------- живая

interface Page {
  path: string;
  status: number;
  html: string;
  robotsHeader: string;
}
export interface Snapshot {
  web: Page[];
  app: Page[];
  sitemap: string | null;
  robots: string | null;
}

async function fetchPage(base: string, path: string, app: boolean): Promise<Page> {
  const headers: Record<string, string> = { "user-agent": app ? APP_UA : UA };
  if (app) headers.cookie = "rf_native_shell=1; rf_shell_version=14";
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
  const sm = await fetchPage(base, "/sitemap.xml", false);
  const rb = await fetchPage(base, "/robots.txt", false);
  return { web, app, sitemap: sm.status === 200 ? sm.html : null, robots: rb.status === 200 ? rb.html : null };
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
  const bad = judgeStatic(f);
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
    ];
    const cases: [string, boolean][] = planted.map(([label, files, expect]) => [
      files ? label : `${label} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`,
      files !== null && judgeStatic(files).some((x) => x.includes(expect)),
    ]);
    return report("check:store-seo", cases, bad.length === 0);
  }
  if (bad.length) {
    console.error(`check:store-seo — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log("check:store-seo — /download индексируется (браузер без robots, приложение noindex), в карте сайта, robots.txt открыт; Organization.sameAs = Google Play вне приложения, вызовов 3; нарушений 0");
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
    `check:store-seo (живая, ${base}) — /es и /ru /download: 200, без noindex, canonical и hreflang на месте, в карте сайта, robots.txt открыт; Organization на ${ORG_PAGES.length} страницах — ${orgCount}, у каждой sameAs Google Play; в ответах приложению адреса магазина 0`,
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
