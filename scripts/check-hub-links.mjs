// ХАБЫ РАЗДЕЛОВ ДОСТИЖИМЫ ИЗ СЕРВЕРНОГО HTML КАЖДОЙ СТРАНИЦЫ — заход 7.273.
//
// ОТКУДА. Выгрузка Search Console «Discovered – currently not indexed»
// (1286 адресов, стоит с 28.08) и обход сайта по серверному HTML (без
// JavaScript, как его видит краулер до рендера) 17.10.2026 показали одно
// структурное отличие застрявших страниц от проиндексированных — у медиа:
//   * каталог `/es/media` и `/ru/media` лежал на ГЛУБИНЕ 4 от `/es`: ни
//     главная, ни шапка, ни подвал не давали на него серверной ссылки;
//     «Audio y video» в шапке живёт в выпадающем «Practicar» и в ящике,
//     которые рисуются только по нажатию — человеку путь есть, краулеру
//     нет. 275 входящих у каталога — только обратные ссылки с самих медиа;
//   * поэтому 270 медиа-страниц (песни, часть фильмов и видео), на которые
//     ведёт ТОЛЬКО каталог, лежали на глубине 5 с одной входящей ссылкой.
//     Из них в очереди «Discovered» 189 (70 %), с показами 25 (9 %); у 280
//     медиа на глубине 3 — 151 (54 %) и 56 (20 %);
//   * хаб грамматики `/es/gramatica` — та же картина, глубина 4.
// Ровно эта ошибка уже чинилась для глоссария и словаря: их ссылки вынесены
// в подвал, потому что подвал — серверный компонент на каждой странице
// (комментарии в `src/components/Footer.tsx`). Медиа и грамматику тогда не
// докрутили. Сторож держит весь список, а не одну исправленную ссылку.
//
// ЧТО СТЕРЕЖЁТСЯ.
//   1. СТАТИЧЕСКАЯ (без `--base`). В `Footer.tsx` есть `<Link>` на каждый
//      хаб из HUBS; испанский хаб печатается только под `lang === "es"`
//      (из `/ru` ссылка либо на существующий адрес, либо не печатается —
//      раздел 3.12 PROGRESS.md). `--plant` — подсадки в копию исходника.
//   2. ЖИВАЯ (`--base=…`). Обе локали, страницы PAGES (не зависят от базы,
//      поэтому полноценны и на пустой базе CI): в СЕРВЕРНОМ ответе внутри
//      `<footer … data-rf-web-footer>` ровно по одной ссылке на каждый хаб
//      своей локали; у `/ru` нет ссылки на испанский хаб ни под `/ru`, ни
//      под `/es`. Пустая выборка — красная. `--plant` — ссылка убрана,
//      подвал убран, испанский хаб подсажен в `/ru`, выборка пуста;
//      настоящая отдача — отрицательный контроль.
//
//   node scripts/check-hub-links.mjs [--plant]
//   node scripts/check-hub-links.mjs --base=http://… [--plant]
//   node scripts/check-hub-links.mjs --base=https://rusofacilapp.com   (прод после выката)
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const FOOTER = "src/components/Footer.tsx";

/** Хабы, у которых в шапке серверной ссылки нет, — их держит подвал. */
export const HUBS = [
  { path: "/glossary", esOnly: false },
  { path: "/vocabulary", esOnly: false },
  { path: "/media", esOnly: false },
  { path: "/gramatica", esOnly: true },
];
export const LANGS = ["es", "ru"];
/** Страницы без базы: на пустой базе CI отдают тот же подвал, что и на проде. */
export const PAGES = ["", "/terms", "/privacy", "/sobre-nosotros"];

const strip = (src) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------------------------------------------------------- исходник
export function judgeStatic(src) {
  const f = strip(src ?? "");
  const bad = [];
  if (!/<footer\b[^>]*data-rf-web-footer/.test(f)) bad.push("Footer.tsx: нет <footer data-rf-web-footer> — живой половине нечего мерить");
  for (const hub of HUBS) {
    const re = new RegExp(`<Link\\s+href=\\{\`/\\$\\{lang\\}${escapeRe(hub.path)}\`\\}`, "g");
    const reEs = new RegExp(`<Link\\s+href="/es${escapeRe(hub.path)}"`, "g");
    const n = (f.match(re) ?? []).length + (f.match(reEs) ?? []).length;
    if (n !== 1) bad.push(`Footer.tsx: ссылок на ${hub.path} — ${n}, ожидается 1`);
    if (hub.esOnly) {
      if ((f.match(re) ?? []).length) bad.push(`Footer.tsx: ${hub.path} есть только на /es, а ссылка строится от lang — на /ru это 404`);
      const at = f.search(reEs);
      const guard = f.lastIndexOf('lang === "es" && (', at);
      if (at !== -1 && (guard === -1 || f.slice(guard, at).includes(")}"))) bad.push(`Footer.tsx: ссылка на /es${hub.path} не под условием lang === "es"`);
    }
  }
  return bad;
}

function staticRun(plant) {
  const src = readFileSync(FOOTER, "utf8");
  const problems = judgeStatic(src);
  if (plant) {
    const cases = [
      ["ссылка на /media убрана", src.replace(/<Link href=\{`\/\$\{lang\}\/media`\}[\s\S]*?<\/Link>/, "")],
      ["ссылка на /gramatica убрана", src.replace(/<Link href="\/es\/gramatica"[\s\S]*?<\/Link>/, "")],
      ["/gramatica строится от lang", src.replace('href="/es/gramatica"', "href={`/${lang}/gramatica`}")],
      ["условие lang === \"es\" снято", src.replace('lang === "es" && (', "(")],
      ["ссылка на /media задвоена", src.replace(/(<Link href=\{`\/\$\{lang\}\/media`\}[\s\S]*?<\/Link>)/, "$1$1")],
      ["подвал без метки", src.replaceAll("data-rf-web-footer", "")],
      ["пустой файл", ""],
    ];
    let caught = 0;
    for (const [name, copy] of cases) {
      const hit = copy !== src && judgeStatic(copy).length > 0;
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
    }
    const clean = problems.length === 0;
    console.log(`  ${clean ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящий Footer.tsx (отрицательный контроль)`);
    for (const p of problems) console.log(`    ${p}`);
    const ok = clean && caught === cases.length;
    console.log(ok ? `check:hub-links:plant — ${caught} из ${cases.length} подсадок, 1 из 1 отрицательный контроль` : "check:hub-links:plant — FAILED");
    return ok ? 0 : 1;
  }
  for (const p of problems) console.log(`  ${p}`);
  console.log(problems.length ? "check:hub-links — FAILED" : `check:hub-links — ${HUBS.length} хабов в подвале, испанский только на /es`);
  return problems.length ? 1 : 0;
}

// ---------------------------------------------------------------- отдача
/** Подвал из СЕРВЕРНОГО ответа; null — подвала нет. */
export function footerOf(html) {
  const m = /<footer\b[^>]*data-rf-web-footer[^>]*>([\s\S]*?)<\/footer>/i.exec(html ?? "");
  return m ? m[1] : null;
}

/** Сколько раз в подвале стоит ссылка на `href` (атрибут — в любых кавычках, без учёта регистра). */
export function countHref(footer, href) {
  const re = new RegExp(`<a\\b[^>]*\\bhref\\s*=\\s*(?:"${escapeRe(href)}"|'${escapeRe(href)}'|${escapeRe(href)}(?=[\\s>]))`, "gi");
  return (footer.match(re) ?? []).length;
}

/** Суд над выборкой `rows` = [{ lang, path, html }]. Пусто — красное. */
export function judgeLive(rows) {
  if (rows.length === 0) return ["выборка пуста — «ссылки на месте» доказано пустотой"];
  const problems = [];
  const expected = LANGS.length * PAGES.length;
  if (rows.length < expected) problems.push(`ответов ${rows.length} из ${expected} — часть страниц не открылась`);
  for (const { lang, path, html } of rows) {
    const where = `/${lang}${path}`;
    if (html == null) {
      problems.push(`${where}: страница не отдала 200`);
      continue;
    }
    const footer = footerOf(html);
    if (footer == null) {
      problems.push(`${where}: в серверном ответе нет <footer data-rf-web-footer>`);
      continue;
    }
    for (const hub of HUBS) {
      const own = countHref(footer, `/${lang}${hub.path}`);
      if (hub.esOnly && lang !== "es") {
        const es = countHref(footer, `/es${hub.path}`);
        if (own || es) problems.push(`${where}: в подвале ссылка на испанский хаб ${hub.path} (/${lang}: ${own}, /es: ${es}) — на /ru её быть не должно`);
      } else if (own !== 1) {
        problems.push(`${where}: в подвале ссылок на /${lang}${hub.path} — ${own}, ожидается 1`);
      }
    }
  }
  return problems;
}

async function get(base, path) {
  const res = await fetch(`${base}${path}`, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
  return res.status === 200 ? res.text() : null;
}

async function live(base, plant) {
  const rows = [];
  for (const lang of LANGS) for (const path of PAGES) rows.push({ lang, path, html: await get(base, `/${lang}${path}`) });
  const problems = judgeLive(rows);
  const links = rows.reduce((s, r) => {
    const f = footerOf(r.html);
    return s + (f ? HUBS.reduce((a, h) => a + countHref(f, `/${r.lang}${h.path}`), 0) : 0);
  }, 0);
  console.log(`  страниц ${rows.length} (2 локали × ${PAGES.length}): ссылок на хабы в серверных подвалах ${links}`);
  if (plant) {
    const dropMedia = (r) => ({ ...r, html: r.html && r.html.replace(new RegExp(`<a\\b[^>]*href="/${r.lang}/media"[^>]*>[\\s\\S]*?</a>`, "i"), "") });
    const cases = [
      ["ссылка на /media убрана из подвала", rows.map(dropMedia)],
      ["ссылка на /es/gramatica убрана", rows.map((r) => ({ ...r, html: r.html && r.html.replace(/<a\b[^>]*href="\/es\/gramatica"[^>]*>[\s\S]*?<\/a>/i, "") }))],
      ["испанский хаб подсажен в /ru", rows.map((r) => ({ ...r, html: r.html && r.lang === "ru" ? r.html.replace("</footer>", '<a href="/ru/gramatica">x</a></footer>') : r.html }))],
      ["подвала нет (как в приложении)", rows.map((r) => ({ ...r, html: r.html && r.html.replace(/data-rf-web-footer/g, "") }))],
      ["ссылка есть, но вне подвала", rows.map((r) => ({ ...r, html: r.html && dropMedia(r).html.replace("</body>", `<a href="/${r.lang}/media">x</a></body>`) }))],
      ["выборка пуста", []],
      ["пол выборки: одна страница", rows.slice(0, 1)],
    ];
    let caught = 0;
    for (const [name, sample] of cases) {
      const hit = judgeLive(sample).length > 0;
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
    }
    const clean = problems.length === 0;
    console.log(`  ${clean ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящая отдача (отрицательный контроль)`);
    for (const p of problems) console.log(`    ${p}`);
    const ok = clean && caught === cases.length;
    console.log(ok ? `check:hub-links --base --plant — ${caught} из ${cases.length} подсадок, 1 из 1 отрицательный контроль` : "check:hub-links --base --plant — FAILED");
    return ok ? 0 : 1;
  }
  for (const p of problems) console.log(`  ${p}`);
  console.log(problems.length ? "check:hub-links --base — FAILED" : `check:hub-links --base — ${HUBS.length} хабов в подвале каждой из ${rows.length} страниц`);
  return problems.length ? 1 : 0;
}

async function main() {
  const argv = process.argv.slice(2);
  const plant = argv.includes("--plant");
  const base = argv.find((a) => a.startsWith("--base="))?.slice("--base=".length).replace(/\/$/, "");
  return base ? live(base, plant) : staticRun(plant);
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) main().then((c) => (process.exitCode = c)).catch((e) => { console.error(e); process.exitCode = 1; });
