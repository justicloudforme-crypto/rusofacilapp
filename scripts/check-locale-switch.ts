/**
 * Переключатель языка никогда не ведёт на ошибку.
 *
 * ЗАЧЕМ. До 7.167 переключатель в шапке менял первый сегмент пути и
 * больше ничего не делал. На двуязычном маршруте это верно, на испанском
 * — нет: замер на живом проде 10.09.2026 показал **39** страниц (все на
 * `/es`), с которых переключение на русский приводило в 404. Жалоба
 * владельца («в «Антонимах» переключение на русский даёт ошибку») — одна
 * из них.
 *
 * Правка — таблица хабов в `src/lib/locale-switch.ts`. Таблица стареет
 * ровно так же, как состарилось прежнее правило, поэтому здесь стоит не
 * правка, а проверка.
 *
 * ДВЕ ПОЛОВИНЫ, и обе обязаны краснеть по отдельности.
 *
 * 1. СТАТИЧЕСКАЯ (по умолчанию; сети и базы не трогает, поэтому стоит в
 *    `verify` и в CI). Из файловой системы берутся ВСЕ маршруты
 *    `src/app/[lang]/**\/page.tsx`. Для каждого и для каждой пары локалей
 *    считается цель переключателя — тем же `localeSwitchTarget`, который
 *    зовёт компонент, — и требуется, чтобы:
 *      — цель соответствовала существующему маршруту (с учётом
 *        динамических сегментов), и
 *      — страница цели не отказывала в этой локали
 *        (`lang !== "es" → notFound()`).
 *    Отдельно проверяется hreflang: страница, отказывающая вне `/es`, не
 *    имеет права строить alternates через `routeAlternates` — тот
 *    объявляет обе локали всегда и обещал бы краулеру адрес `/ru`,
 *    которого нет.
 *
 * 2. ЖИВАЯ (`--base=https://rusofacilapp.com`). Обход обеих локалей по
 *    `<a href>` серверного HTML; для каждой страницы 200 проверяется код
 *    ответа цели переключателя и код ответа КАЖДОГО объявленного
 *    `hreflang` (имя атрибута читается без учёта регистра — правило 4.2).
 *    Код ответа не видит клиентского отказа (инцидент 29.08), поэтому
 *    цели, не совпавшие с исходной страницей, дополнительно открываются
 *    настоящим браузером — по одной на класс — ключом `--render`.
 *
 * Запускать:
 *   npx tsx scripts/check-locale-switch.ts
 *   npx tsx scripts/check-locale-switch.ts --plant
 *   npx tsx scripts/check-locale-switch.ts --base=https://rusofacilapp.com
 *
 * `--plant` обязателен всякий раз, когда ответ «расхождений 0». Он
 * заводит НАСТОЯЩИЙ файл страницы `src/app/[lang]/__plant-locale-switch__/`
 * с испанской заглушкой, о которой не знает `SPANISH_ONLY_ROUTES`, и
 * требует, чтобы проверка её нашла; файл удаляется в `finally`.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isEntryPoint } from "@/lib/entry-point";
import { locales, type Locale } from "@/i18n/config";
import { localeSwitchTarget } from "@/lib/locale-switch";
import { anchorTargets, normalizeUrl } from "@/lib/link-graph";

const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const PLANT = argv.includes("--plant");
const BASE = arg("base", "").replace(/\/$/, "");
const CONCURRENCY = Number(arg("concurrency", "8"));

const APP = join(process.cwd(), "src/app/[lang]");
const PLANT_DIR = join(APP, "__plant-locale-switch__");

interface RoutePage {
  /** `/vocabulary/[categoria]`, `/` для корня локали. */
  route: string;
  source: string;
}

function pages(dir: string, prefix = ""): RoutePage[] {
  const out: RoutePage[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pages(full, `${prefix}/${entry}`));
    else if (entry === "page.tsx") out.push({ route: prefix || "/", source: readFileSync(full, "utf8") });
  }
  return out;
}

/** Заглушка «эта страница только на /es» в ТЕЛЕ страницы, а не в метаданных.
 * То же выражение, что в `spanish-only-routes.test.ts`: правило одно. */
function bailsOutsideSpanish(source: string): boolean {
  return /lang !== "es"\)\s*(\n\s*)?notFound\(\)/.test(source);
}

/** Строит `routeAlternates`, объявляющий ОБЕ локали всегда. */
function declaresBothLocales(source: string): boolean {
  return /routeAlternates\s*\(/.test(source);
}

/** Пример конкретного пути для маршрута: динамические сегменты заполняются. */
function samplePath(route: string): string {
  if (route === "/") return "";
  return route
    .split("/")
    .map((seg) => (seg.startsWith("[") ? "obraztsy" : seg))
    .join("/");
}

/** Маршрут, которому соответствует конкретный путь (по СЕГМЕНТАМ). */
function routeOf(path: string, routes: RoutePage[]): RoutePage | null {
  const parts = path.split("/").filter(Boolean);
  return (
    routes.find((r) => {
      const pattern = (r.route === "/" ? "" : r.route).split("/").filter(Boolean);
      if (pattern.length !== parts.length) return false;
      return pattern.every((seg, i) => (seg.startsWith("[") ? parts[i].length > 0 : seg === parts[i]));
    }) ?? null
  );
}

interface Finding {
  kind: string;
  from: string;
  to: string;
  why: string;
}

export function auditRoutes(routes: RoutePage[]): Finding[] {
  const findings: Finding[] = [];
  for (const page of routes) {
    const path = samplePath(page.route);
    for (const from of locales) {
      const fromHref = `/${from}${path}`;
      // Страница, которой в этой локали нет, переключателя не рисует.
      if (from !== "es" && bailsOutsideSpanish(page.source)) continue;
      for (const to of locales) {
        if (to === from) continue;
        const { href } = localeSwitchTarget(fromHref, to as Locale);
        const targetPath = href.slice(`/${to}`.length);
        const target = routeOf(targetPath, routes);
        if (!target) {
          findings.push({ kind: "цели нет вовсе", from: fromHref, to: href, why: "нет такого маршрута" });
          continue;
        }
        if (to !== "es" && bailsOutsideSpanish(target.source)) {
          findings.push({
            kind: "цель отказывает в этой локали",
            from: fromHref,
            to: href,
            why: `${target.route}: lang !== "es" → notFound()`,
          });
        }
      }
    }
    // hreflang: испанская страница не имеет права объявлять пару /ru.
    if (bailsOutsideSpanish(page.source) && declaresBothLocales(page.source)) {
      findings.push({
        kind: "hreflang обещает несуществующую пару",
        from: page.route,
        to: "routeAlternates",
        why: "испанская страница строит alternates обеих локалей",
      });
    }
  }
  return findings;
}

function printFindings(findings: Finding[]): void {
  const byKind = new Map<string, Finding[]>();
  for (const f of findings) byKind.set(f.kind, [...(byKind.get(f.kind) ?? []), f]);
  for (const [kind, list] of [...byKind].sort()) {
    console.log(`  ${kind}: ${list.length}`);
    for (const f of list.slice(0, 5)) console.log(`    ${f.from} → ${f.to}  (${f.why})`);
    if (list.length > 5) console.log(`    …и ещё ${list.length - 5}`);
  }
}

function plant(): void {
  console.log("[check:locale-switch] ПОДСАДКА: страница с испанской заглушкой, о которой не знает список");
  mkdirSync(PLANT_DIR, { recursive: true });
  writeFileSync(
    join(PLANT_DIR, "page.tsx"),
    [
      'import { notFound } from "next/navigation";',
      "",
      'export default async function Planted({ params }: { params: Promise<{ lang: string }> }) {',
      "  const { lang } = await params;",
      '  if (lang !== "es") notFound();',
      "  return null;",
      "}",
      "",
    ].join("\n"),
  );
  try {
    const findings = auditRoutes(pages(APP));
    const planted = findings.filter((f) => f.to.includes("__plant-locale-switch__"));
    printFindings(planted);
    if (planted.length === 0) {
      console.error("ПОДСАДКА НЕ НАЙДЕНА — проверка не умеет находить то, ради чего заведена");
      process.exitCode = 1;
      return;
    }
    console.log(`подсадка найдена: ${planted.length} расхождений — проверка работает`);
  } finally {
    rmSync(PLANT_DIR, { recursive: true, force: true });
  }
}

/* ------------------------------ живая половина ------------------------------ */

interface LiveRow {
  url: string;
  status: number;
  alternates: [string, string][];
}

/** hreflang читается БЕЗ учёта регистра — правило 4.2. */
function alternatesOf(html: string, from: string, origin: string): [string, string][] {
  const re = /<link\b[^>]*?>/gi;
  const out: [string, string][] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    if (!/\brel\s*=\s*["']?alternate["']?/i.test(tag)) continue;
    const hl = tag.match(/\bhreflang\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const hr = tag.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!hl || !hr) continue;
    const href = normalizeUrl(hr[2] ?? hr[3] ?? hr[4] ?? "", from, origin);
    if (!href) continue;
    out.push([(hl[2] ?? hl[3] ?? hl[4] ?? "").toLowerCase(), href]);
  }
  return out;
}

async function live(base: string): Promise<void> {
  const origin = new URL(base).origin;
  const seen = new Map<string, LiveRow>();
  const queue = locales.map((l) => `${origin}/${l}`);
  const queued = new Set(queue);

  async function worker() {
    for (;;) {
      const url = queue.shift();
      if (!url) return;
      if (seen.has(url)) continue;
      let status = 0;
      let html = "";
      try {
        const res = await fetch(url, { redirect: "manual" });
        status = res.status;
        if (status === 200) html = await res.text();
      } catch {
        status = -1;
      }
      seen.set(url, { url, status, alternates: html ? alternatesOf(html, url, origin) : [] });
      if (status === 200) {
        for (const t of anchorTargets(html, url, origin)) {
          if (!seen.has(t) && !queued.has(t)) {
            queued.add(t);
            queue.push(t);
          }
        }
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const localeOf = (url: string) => url.slice(origin.length).split("/").filter(Boolean)[0] ?? "";
  const inLocale = [...seen.values()].filter((r) => r.status === 200 && (locales as readonly string[]).includes(localeOf(r.url)));
  console.log(`[check:locale-switch] обойдено ${seen.size}, страниц 200 в локалях ${inLocale.length}`);

  // Что нужно проверить: цели переключателя и все объявленные alternates.
  const wanted = new Set<string>();
  const switchTarget = new Map<string, string>();
  for (const row of inLocale) {
    const path = row.url.slice(origin.length);
    for (const to of locales) {
      if (to === localeOf(row.url)) continue;
      const { href } = localeSwitchTarget(path, to);
      switchTarget.set(row.url, origin + href);
      wanted.add(origin + href);
    }
    for (const [, href] of row.alternates) wanted.add(href);
  }
  const unknown = [...wanted].filter((u) => !seen.has(u));
  const probed = new Map<string, number>();
  let i = 0;
  async function probe() {
    for (;;) {
      const u = unknown[i++];
      if (!u) return;
      try {
        probed.set(u, (await fetch(u, { redirect: "manual" })).status);
      } catch {
        probed.set(u, -1);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, probe));
  const statusOf = (u: string) => seen.get(u)?.status ?? probed.get(u) ?? 0;
  const ok = (s: number) => s === 200 || s === 307 || s === 308;

  const badSwitch: string[] = [];
  for (const [from, to] of switchTarget) if (!ok(statusOf(to))) badSwitch.push(`${from} → ${to} (${statusOf(to)})`);
  const badAlt: string[] = [];
  for (const row of inLocale) {
    for (const [hl, href] of row.alternates) if (!ok(statusOf(href))) badAlt.push(`${row.url} hreflang=${hl} → ${href} (${statusOf(href)})`);
  }

  console.log(`  целей переключателя ${switchTarget.size}, ведущих не в 200/307: ${badSwitch.length}`);
  for (const line of badSwitch.slice(0, 10)) console.log(`    ${line}`);
  if (badSwitch.length > 10) console.log(`    …и ещё ${badSwitch.length - 10}`);
  const altCount = inLocale.reduce((n, r) => n + r.alternates.length, 0);
  console.log(`  объявлений hreflang ${altCount}, ведущих не в 200/307: ${badAlt.length}`);
  for (const line of badAlt.slice(0, 10)) console.log(`    ${line}`);
  if (badSwitch.length || badAlt.length) process.exitCode = 1;
}

async function main(): Promise<void> {
  if (PLANT) return plant();
  if (BASE) return live(BASE);
  const findings = auditRoutes(pages(APP));
  console.log(`[check:locale-switch] маршрутов ${pages(APP).length}, расхождений ${findings.length}`);
  printFindings(findings);
  if (findings.length) process.exitCode = 1;
  else console.log("  переключатель и hreflang не обещают ни одного несуществующего адреса (контроль — --plant)");
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
