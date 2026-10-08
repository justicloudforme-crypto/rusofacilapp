// ЗАМОРОЗКА СНЯТА: 165 СТРАНИЦ ЭКСПЕРИМЕНТА ЖИВУТ ПО ОБЩИМ ПРАВИЛАМ —
// долги 3 и 4, заход 7.258.
//
// ОТКУДА. Эксперимент «тело тонким страницам» (65 рассказов и 100 песен,
// 330 URL) держал эти страницы в состоянии 28.08.2026 до 25.09.2026:
// рассказы без `<lastmod>` в карте сайта (долг 3), заголовки длиннее 70
// знаков, описания длиннее 155 и пять групп одинаковых описаний у `/ru`
// песен (долг 4, раздел 6 PROGRESS.md). Замерный период эксперимента
// кончился 25.09.2026 и лежит в Search Console (16 месяцев), поэтому
// правка страниц сейчас прошлый замер не сдвигает.
//
// ЧТО СТЕРЕЖЁТСЯ.
//   1. СТАТИЧЕСКАЯ (без `--base`). В карте сайта дата рассказа — всегда
//      `story.updatedAt`, без `isFrozenStory`; `contentPageTitle` — всегда
//      `fitTitle`, без ветки `isFrozenPage`; описание рассказа — всегда
//      `truncateForMeta`, описание песни — всегда `mediaDescription`.
//      `--plant` — каждая ветка заморозки подсаживается обратно.
//   2. ЖИВАЯ (`--base=…`; против прода — только с `--against-prod`, цена
//      в `prod-read-budget.mjs`). Карта сайта: у КАЖДОГО URL рассказа есть
//      `<lastmod>`. 330 URL манифеста `docs/experiment-groups-2026-08-28.json`:
//      `<title>` не длиннее 70 знаков, `description` не длиннее 155, у
//      одной локали нет двух страниц с одинаковым описанием. Пустая или
//      неполная выборка — красная. `--plant` — дата снята с одного
//      рассказа, длинный заголовок, длинное описание, два одинаковых
//      описания, пустая выборка; настоящая отдача — отрицательный контроль.
//
//   node scripts/check-thaw.mjs [--plant]
//   node scripts/check-thaw.mjs --base=http://localhost:3199 [--plant]
//   node scripts/check-thaw.mjs --base=https://rusofacilapp.com --against-prod
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { guardLiveCrawl } from "./prod-read-budget.mjs";

const FILES = {
  sitemap: "src/app/sitemap.ts",
  frozen: "src/lib/frozen-pages.ts",
  story: "src/app/[lang]/stories/[id]/page.tsx",
  media: "src/app/[lang]/media/[id]/page.tsx",
};
const MANIFEST = "docs/experiment-groups-2026-08-28.json";

export const TITLE_MAX = 70;
export const DESCRIPTION_MAX = 155;

const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

export function judgeStatic(files) {
  const f = Object.fromEntries(Object.entries(FILES).map(([k, p]) => [k, strip(files[p] ?? "")]));
  const bad = [];
  const need = (cond, msg) => {
    if (!cond) bad.push(msg);
  };
  need(!/isFrozenStory/.test(f.sitemap), "sitemap.ts: дата рассказа снова зависит от isFrozenStory (долг 3)");
  need(/lastModifiedField\(story\.updatedAt\)/.test(f.sitemap), "sitemap.ts: у URL рассказа нет lastModifiedField(story.updatedAt) (долг 3)");
  const title = /export function contentPageTitle\([\s\S]*?\n\}/.exec(f.frozen)?.[0] ?? "";
  need(title.length > 0, "frozen-pages.ts: contentPageTitle не найден");
  need(!/isFrozenPage/.test(title) && /return fitTitle\(base, qualifier, shortQualifier\);/.test(title), "frozen-pages.ts: у contentPageTitle снова ветка заморозки — заголовок длиннее 70 (долг 4)");
  need(!/isFrozenPage\(/.test(f.story), "stories/[id]/page.tsx: снова ветка isFrozenPage (долг 4)");
  need(/const description = truncateForMeta\(rawDescription\);/.test(f.story), "stories/[id]/page.tsx: описание рассказа не через truncateForMeta (долг 4)");
  need(!/isFrozenPage\(|frozenMediaDescription/.test(f.media), "media/[id]/page.tsx: снова ветка заморозки описания (долг 4)");
  need(/const description = mediaDescription\(lang, item\);/.test(f.media), "media/[id]/page.tsx: описание песни не через mediaDescription (долг 4)");
  return bad;
}

// ---------------------------------------------------------------- отдача
const decode = (s) =>
  s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–");
const pick = (html, re) => decode((html.match(re)?.[1] ?? "").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

/** Поля одной страницы (регистронезависимо, с раскодированием — PROGRESS 4.2, 4.3). */
export function fieldsOf(html) {
  return {
    title: pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i),
  };
}

/** Записи карты сайта: [{ url, lastmod }]. */
export function storyEntries(xml) {
  return (xml.match(/<url>[\s\S]*?<\/url>/g) ?? [])
    .map((b) => ({ url: b.match(/<loc>([\s\S]*?)<\/loc>/)?.[1] ?? "", lastmod: b.match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1] ?? null }))
    .filter((e) => /\/stories\/[^/]+$/.test(e.url));
}

/** Суд над картой и 330 страницами. `pages` = [{ path, status, title, description }]. */
export function judgeLive({ stories, pages, expectedPages }) {
  const problems = [];
  if (stories.length === 0) problems.push("в карте сайта ни одного URL рассказа — «все с датой» доказано пустотой");
  const undated = stories.filter((e) => !e.lastmod);
  if (undated.length) problems.push(`карта сайта: ${undated.length} URL рассказов без <lastmod> (первый: ${undated[0].url}) — долг 3`);
  if (pages.length === 0) return [...problems, "выборка 330 URL пуста"];
  const ok = pages.filter((p) => p.status === 200);
  if (ok.length < expectedPages) problems.push(`страниц эксперимента ответили 200: ${ok.length} из ${expectedPages}`);
  const longTitles = ok.filter((p) => [...p.title].length > TITLE_MAX);
  if (longTitles.length) problems.push(`title длиннее ${TITLE_MAX}: ${longTitles.length} (первый: ${longTitles[0].path} — ${[...longTitles[0].title].length})`);
  const longDesc = ok.filter((p) => [...p.description].length > DESCRIPTION_MAX);
  if (longDesc.length) problems.push(`description длиннее ${DESCRIPTION_MAX}: ${longDesc.length} (первый: ${longDesc[0].path} — ${[...longDesc[0].description].length})`);
  const empty = ok.filter((p) => !p.title || !p.description);
  if (empty.length) problems.push(`без title или description: ${empty.length} (первый: ${empty[0].path})`);
  for (const lang of ["es", "ru"]) {
    const by = new Map();
    for (const p of ok.filter((x) => x.path.startsWith(`/${lang}/`) && x.description)) by.set(p.description, [...(by.get(p.description) ?? []), p.path]);
    const groups = [...by.values()].filter((g) => g.length > 1);
    if (groups.length) problems.push(`/${lang}: ${groups.length} групп одинаковых description (${groups.reduce((s, g) => s + g.length, 0)} URL; первая: ${groups[0].slice(0, 2).join(", ")}…)`);
  }
  return problems;
}

export function summary({ stories, pages }) {
  const ok = pages.filter((p) => p.status === 200);
  const dup = (lang) => {
    const by = new Map();
    for (const p of ok.filter((x) => x.path.startsWith(`/${lang}/`) && x.description)) by.set(p.description, (by.get(p.description) ?? 0) + 1);
    return [...by.values()].filter((n) => n > 1).length;
  };
  return {
    stories: stories.length,
    undated: stories.filter((e) => !e.lastmod).length,
    pages: pages.length,
    ok: ok.length,
    titleOver70: ok.filter((p) => [...p.title].length > TITLE_MAX).length,
    descOver155: ok.filter((p) => [...p.description].length > DESCRIPTION_MAX).length,
    descUnder70: ok.filter((p) => [...p.description].length < 70).length,
    dupGroups: dup("es") + dup("ru"),
  };
}

function frozenPaths() {
  const g = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const out = [];
  for (const lang of ["es", "ru"]) {
    for (const id of [...g.storyPilot, ...g.storyControl]) out.push(`/${lang}/stories/${id}`);
    for (const id of [...g.mediaPilot, ...g.mediaControl]) out.push(`/${lang}/media/${id}`);
  }
  return out;
}

async function capture(base, paths, concurrency) {
  const out = [];
  const queue = [...paths];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
        try {
          const res = await fetch(`${base}${path}`, { headers: { "user-agent": "Mozilla/5.0 (check:thaw)" }, redirect: "manual", signal: AbortSignal.timeout(60_000) });
          const html = res.status === 200 ? await res.text() : "";
          out.push({ path, status: res.status, ...fieldsOf(html) });
        } catch (e) {
          out.push({ path, status: 0, title: "", description: "", error: String(e) });
        }
      }
    }),
  );
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

async function live(base, plant, argv) {
  const guard = guardLiveCrawl({ name: "check:thaw", argv, base });
  if (guard !== 0) return guard;
  const res = await fetch(`${base}/sitemap.xml`, { signal: AbortSignal.timeout(120_000) });
  const stories = res.status === 200 ? storyEntries(await res.text()) : [];
  const paths = frozenPaths();
  const pages = await capture(base, paths, Number(argv.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? 6));
  const sample = { stories, pages, expectedPages: paths.length };
  const problems = judgeLive(sample);
  console.log(`  ${JSON.stringify(summary(sample))}`);
  if (plant) {
    const firstStory = pages.findIndex((p) => p.path.includes("/stories/") && p.status === 200);
    const firstMedia = pages.findIndex((p) => p.path.startsWith("/ru/media/") && p.status === 200);
    const swap = (i, patch) => pages.map((p, k) => (k === i ? { ...p, ...patch } : p));
    const second = pages.findIndex((p, k) => k > firstMedia && p.path.startsWith("/ru/media/") && p.status === 200);
    const cases = [
      ["у одного рассказа снята дата в карте", { ...sample, stories: stories.map((e, k) => (k === 0 ? { ...e, lastmod: null } : e)) }],
      ["заголовок рассказа длиннее 70", { ...sample, pages: swap(firstStory, { title: "x".repeat(TITLE_MAX + 1) }) }],
      ["описание песни длиннее 155", { ...sample, pages: swap(firstMedia, { description: "y".repeat(DESCRIPTION_MAX + 1) }) }],
      ["две песни /ru с одним описанием", { ...sample, pages: pages.map((p, k) => (k === second ? { ...p, description: pages[firstMedia].description } : p)) }],
      ["страница перестала отвечать 200", { ...sample, pages: swap(firstStory, { status: 500, title: "", description: "" }) }],
      ["карта сайта пуста", { ...sample, stories: [] }],
      ["выборка 330 URL пуста", { ...sample, pages: [] }],
    ];
    let caught = 0;
    for (const [name, s] of cases) {
      const hit = judgeLive(s).length > 0;
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
    }
    const clean = problems.length === 0;
    console.log(`  ${clean ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящая отдача (отрицательный контроль)`);
    const ok = clean && caught === cases.length;
    console.log(ok ? `check:thaw --base --plant — ${caught} из ${cases.length} подсадок, 1 из 1 отрицательный контроль` : "check:thaw --base --plant — FAILED");
    return ok ? 0 : 1;
  }
  if (problems.length) {
    console.error("check:thaw (живая) — ОТКАЗ:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(`check:thaw (живая) — у ${stories.length} URL рассказов есть <lastmod>; ${pages.length} URL эксперимента: title ≤ ${TITLE_MAX}, description ≤ ${DESCRIPTION_MAX}, одинаковых описаний 0.`);
  return 0;
}

function main() {
  const argv = process.argv.slice(2);
  const plant = argv.includes("--plant");
  const baseArg = argv.find((a) => a.startsWith("--base="));
  if (baseArg) return live(baseArg.slice("--base=".length).replace(/\/$/, ""), plant, argv);
  const files = Object.fromEntries(Object.values(FILES).map((p) => [p, readFileSync(p, "utf8")]));
  const bad = judgeStatic(files);
  if (plant) {
    let ok = bad.length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящие исходники`);
    const edit = (key, from, to) => {
      const p = FILES[key];
      const next = files[p].replace(from, to);
      return next === files[p] ? null : { ...files, [p]: next };
    };
    const cases = [
      ["дата рассказа снова за isFrozenStory", edit("sitemap", "lastModifiedField(story.updatedAt)", "lastModifiedField(isFrozenStory(story) ? undefined : story.updatedAt)"), "долг 3"],
      ["заголовок снова с веткой заморозки", edit("frozen", "  return fitTitle(base, qualifier, shortQualifier);", "  if (isFrozenPage(id)) return `${base} — ${qualifier} | RusoFácilapp`;\n  return fitTitle(base, qualifier, shortQualifier);"), "contentPageTitle"],
      ["описание рассказа снова без обрезки", edit("story", "const description = truncateForMeta(rawDescription);", "const description = isFrozenPage(id) ? rawDescription : truncateForMeta(rawDescription);"), "stories/[id]"],
      ["описание песни снова замороженное", edit("media", "const description = mediaDescription(lang, item);", "const description = isFrozenPage(item.id) ? frozenMediaDescription(lang, item) : mediaDescription(lang, item);"), "media/[id]"],
    ];
    let caught = 0;
    for (const [name, patched, expect] of cases) {
      if (!patched) {
        console.log(`  НЕ ПРИМЕНИЛАСЬ — ${name}`);
        ok = false;
        continue;
      }
      const hit = judgeStatic(patched).some((m) => m.includes(expect));
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
    }
    ok &&= caught === cases.length;
    console.log(ok ? `check:thaw --plant — ${caught} из ${cases.length} подсадок, 1 из 1 отрицательный контроль` : "check:thaw --plant — FAILED");
    return Promise.resolve(ok ? 0 : 1);
  }
  if (bad.length) {
    console.error("check:thaw — ОТКАЗ:");
    for (const b of bad) console.error(`  ${b}`);
    return Promise.resolve(1);
  }
  console.log("check:thaw — карта сайта даёт дату каждому рассказу, заголовки и описания 165 страниц эксперимента — по общим правилам (fitTitle, truncateForMeta, mediaDescription). Контроль — --plant; живая — --base=.");
  return Promise.resolve(0);
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) main().then((c) => (process.exitCode = c)).catch((e) => { console.error(e); process.exitCode = 1; });
