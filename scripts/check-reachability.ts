/**
 * Достижимость URL карты сайта по ссылкам от корней локалей.
 *
 * Зачем отдельный, постоянный скрипт. Этот замер делался руками уже
 * четырежды — 7.102, 7.111, 7.112, 7.113/7.114 — и каждый раз заново, из
 * одноразового файла, который после захода выбрасывался. Цена такой
 * привычки названа в самом коде проекта: в комментарии `robots-matcher.ts`
 * записано, как очередной одноразовый аудит переписал матчер `robots.txt`
 * из прозы и ошибся молча. Здесь матчер импортируется, а не пересказывается.
 *
 * Что считается ребром. Только `<a href>` из СЕРВЕРНОГО HTML: JavaScript не
 * исполняется, кук нет. Клиентский подборщик игр и клиентские каталоги в
 * это определение не попадают намеренно — краулер их тоже не видит, и
 * ровно из-за этого 516 URL были недостижимы (7.112).
 *
 * Что считается достижимым. URL, до которого есть путь по таким рёбрам от
 * `/<lang>` хотя бы одной локали, через страницы, которые (а) отдали 200 и
 * (б) разрешены в `robots.txt`. Страница, отдавшая 307 в `/pricing`,
 * считается достигнутой, но её ссылки дальше не читаются: краулер их не
 * увидит.
 *
 * Семейство URL определяется по СЕГМЕНТАМ пути, а не по подстроке. В 7.94
 * подстрочный фильтр назвал сиротой сам хаб `/es/stories`, потому что путь
 * карточки начинается с него же.
 *
 *   npx tsx scripts/check-reachability.ts --base=https://rusofacilapp.com
 *   npx tsx scripts/check-reachability.ts --plant          # позитивный контроль
 *   npx tsx scripts/check-reachability.ts --frozen=docs/frozen-baseline-2026-08-30.json
 *   npx tsx scripts/check-reachability.ts --drop-sections=story-link-index,media-link-index
 *
 * `--plant` обязателен всякий раз, когда ответ «недостижимых 0»: проверка,
 * которая ничего не нашла, сначала обязана доказать, что умеет находить
 * (правило замера 4.5).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { isDisallowed, parseRobotsTxt } from "../src/lib/robots-matcher";
import { anchorTargets, normalizeUrl, urlFamily } from "../src/lib/link-graph";
import { isEntryPoint } from "../src/lib/entry-point";

const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name: string) => argv.includes(`--${name}`);

const BASE = arg("base", "https://rusofacilapp.com").replace(/\/$/, "");
const CONCURRENCY = Number(arg("concurrency", "8"));
const FROZEN = arg("frozen", "");
const OUT = arg("out", "");
const PLANT = flag("plant");
/** Список секций, чьи рёбра вырезаются из графа. Пусто по умолчанию.
 * Нужен, чтобы посчитать граф, каким он был ДО правки, не пересобирая
 * приложение и не откатывая код: секции серверных списков помечены
 * `data-testid`, и вырезание ровно их воспроизводит прежнее состояние. */
const DROP_SECTIONS = arg("drop-sections", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function getText(url: string): Promise<{ status: number; body: string }> {
  try {
    const res = await fetch(url, { redirect: "manual", headers: { "user-agent": "rusofacilapp-reachability/1.0" } });
    const type = res.headers.get("content-type") ?? "";
    const body = res.status === 200 && type.includes("html") ? await res.text() : "";
    return { status: res.status, body };
  } catch (error) {
    // Сетевой отказ — это не «страница пустая», а «мы её не видели».
    // Ноль в статусе отличает её от 404 и от 307 в отчёте.
    process.stderr.write(`  ! ${url}: ${String(error).slice(0, 80)}\n`);
    return { status: 0, body: "" };
  }
}

async function main() {
  const robotsRes = await fetch(`${BASE}/robots.txt`);
  const rules = parseRobotsTxt(await robotsRes.text());
  const allows = rules.filter((r) => r.allow).map((r) => r.pattern);
  const disallows = rules.filter((r) => !r.allow).map((r) => r.pattern);
  const allowed = (url: string) => !isDisallowed(url.slice(BASE.length) || "/", disallows, allows);

  const sitemapXml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const sitemap = new Set<string>();
  for (const m of sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = normalizeUrl(m[1].trim(), BASE, BASE);
    if (url) sitemap.add(url);
  }

  const planted = new Set<string>();
  if (PLANT) {
    // Три выдуманных адреса: их нет ни на одной странице, значит проверка
    // ОБЯЗАНА назвать их недостижимыми. Четвёртый — живой контроль на
    // ложное срабатывание.
    for (const p of ["/es/plant-orphan-a", "/ru/plant-orphan-b", "/es/stories/plant-not-a-story"]) {
      sitemap.add(BASE + p);
      planted.add(BASE + p);
    }
  }

  const roots = [`${BASE}/es`, `${BASE}/ru`];
  const depth = new Map<string, number>();
  const inCount = new Map<string, number>();
  const status = new Map<string, number>();
  const queue: string[] = [];
  for (const r of roots) {
    depth.set(r, 0);
    queue.push(r);
  }

  let fetched = 0;
  let active = 0;
  // Пул, который НЕ выходит на пустой очереди, пока кто-то ещё качает.
  // Первая редакция выходила: очередь стартует с двух корней, поэтому из
  // двенадцати рабочих десять завершались сразу же, и обход шёл в один
  // поток — 200 страниц за шесть минут вместо всех за столько же. Ошибка
  // тихая: результат тот же, время другое.
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const url = queue.shift();
      if (url === undefined) {
        if (active === 0) return;
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }
      active += 1;
      try {
        const { status: code, body } = await getText(url);
        status.set(url, code);
        fetched += 1;
        if (fetched % 200 === 0) process.stderr.write(`  … ${fetched} страниц, очередь ${queue.length}\n`);
        if (code === 200) {
          const here = depth.get(url) ?? 0;
          for (const target of anchorTargets(body, url, BASE, DROP_SECTIONS)) {
            inCount.set(target, (inCount.get(target) ?? 0) + 1);
            if (!depth.has(target)) {
              depth.set(target, here + 1);
              if (allowed(target)) queue.push(target);
            }
          }
        }
      } finally {
        active -= 1;
      }
    }
  });
  await Promise.all(workers);

  const unreachable = [...sitemap].filter((u) => !depth.has(u)).sort();
  const byFamily = new Map<string, number>();
  for (const u of unreachable) byFamily.set(urlFamily(u, BASE), (byFamily.get(urlFamily(u, BASE)) ?? 0) + 1);

  console.log(`база: ${BASE}${DROP_SECTIONS.length ? `  (ВЫРЕЗАНЫ рёбра секций: ${DROP_SECTIONS.join(", ")})` : ""}`);
  console.log(`страниц скачано: ${fetched}`);
  console.log(`URL в карте сайта: ${sitemap.size}${PLANT ? ` (из них подсажено ${planted.size})` : ""}`);
  console.log(`НЕДОСТИЖИМЫХ ОТ КОРНЕЙ: ${unreachable.length}`);
  for (const [fam, n] of [...byFamily].sort((a, b) => b[1] - a[1])) console.log(`  — ${fam}: ${n}`);

  let failed = false;
  if (PLANT) {
    const caught = [...planted].filter((p) => unreachable.includes(p));
    console.log(`\nподсадка: ${caught.length} из ${planted.size} названы недостижимыми`);
    const control = `${BASE}/es/terms`;
    const controlOk = depth.has(control);
    console.log(`контроль на ложное срабатывание: ${control} — ${controlOk ? `достижим, глубина ${depth.get(control)}, входящих ${inCount.get(control) ?? 0}` : "НЕ ДОСТИЖИМ"}`);
    if (caught.length !== planted.size || !controlOk) failed = true;
  }

  if (FROZEN) {
    const frozen = new Set<string>(
      (JSON.parse(readFileSync(FROZEN, "utf8")) as { url: string }[]).map((r) => normalizeUrl(r.url, BASE, BASE) ?? r.url),
    );
    const hit = unreachable.filter((u) => frozen.has(u));
    console.log(`\nзамороженных URL в базовой линии: ${frozen.size}`);
    console.log(`ПЕРЕСЕЧЕНИЕ недостижимых с замороженными: ${hit.length}`);
    const frozenReach = [...frozen].filter((u) => depth.has(u));
    console.log(`замороженных достижимо: ${frozenReach.length} из ${frozen.size}`);
    const multi = new Map<number, number>();
    for (const u of frozen) multi.set(inCount.get(u) ?? 0, (multi.get(inCount.get(u) ?? 0) ?? 0) + 1);
    console.log(`кратности входящих у замороженных: ${[...multi].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}→${v}`).join(", ")}`);
  }

  if (OUT) {
    writeFileSync(
      OUT,
      JSON.stringify(
        {
          base: BASE,
          dropSections: DROP_SECTIONS,
          fetched,
          sitemap: [...sitemap].sort(),
          unreachable,
          depth: Object.fromEntries([...depth].sort()),
          inCount: Object.fromEntries([...inCount].sort()),
        },
        null,
        1,
      ),
    );
    console.log(`\nснимок записан: ${OUT}`);
  }

  if (failed) {
    console.log("\nFAIL — подсадка не поймана");
    process.exit(1);
  }
}

// Обход прода стоит полутора тысяч рендеров — он не должен начинаться
// оттого, что файл кто-то импортировал (правило 7.30).
if (isEntryPoint(import.meta.url)) {
  main();
}
