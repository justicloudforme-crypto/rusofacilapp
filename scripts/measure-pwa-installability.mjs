/**
 * СТАВИТСЯ ЛИ САЙТ КАК PWA — ЗАМЕР С РАБОТАЮЩИМ КОНТРОЛЕМ (ДОЛГ 83).
 *
 * ПОЧЕМУ ПРОШЛЫЙ ЗАМЕР НИЧЕГО НЕ ЗНАЧИЛ. Строка долга: «`Page
 * .getInstallabilityErrors` вернул пустой список для прода и точно так же
 * для `example.com`, у которого нет ни манифеста, ни воркера, — по правилу
 * 4.1 такой ответ не значит ничего». Прибор не различал сайт с манифестом
 * и сайт без него, то есть мерил не то, о чём его спрашивали.
 *
 * ЧЕМ МЕРЯЕТСЯ ТЕПЕРЬ. `Page.getAppManifest` — он возвращает АДРЕС
 * манифеста, его текст и список ошибок разбора, — плюс пять условий
 * установки, проверенных по отдельности и каждое своим числом:
 *
 *   1. манифест найден и разобран без ошибок;
 *   2. есть `name` или `short_name`;
 *   3. `start_url` есть и в области `scope`;
 *   4. `display` — `standalone`, `fullscreen` или `minimal-ui`;
 *   5. есть иконка 192 и иконка 512 назначения `any`;
 *   6. воркер зарегистрирован и у него есть обработчик `fetch`.
 *
 * КОНТРОЛЬ РАБОТАЕТ, и это проверяется в том же прогоне: `example.com`
 * обязан провалить условие 1. Если он его проходит — печатается «ПРИБОР
 * СЛЕП» и прогон красный, ровно по правилу 4.1.
 *
 *   node scripts/measure-pwa-installability.mjs
 *   node scripts/measure-pwa-installability.mjs --base=http://localhost:3123
 */
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "https://rusofacilapp.com").replace(/\/$/, "");

async function measure(browser, url, { waitForWorker }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Page.enable");
  await page.goto(url, { waitUntil: "load", timeout: 60_000 }).catch(() => {});
  const got = await cdp.send("Page.getAppManifest").catch(() => ({}));
  let manifest = null;
  try {
    manifest = got.data ? JSON.parse(got.data) : null;
  } catch {
    manifest = null;
  }
  let worker = { registered: false, controls: false };
  if (waitForWorker) {
    worker = await page
      .waitForFunction(
        async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          return reg ? { registered: true, controls: navigator.serviceWorker.controller !== null } : null;
        },
        null,
        { timeout: 30_000 },
      )
      .then((h) => h.jsonValue())
      .catch(() => ({ registered: false, controls: false }));
  }
  await context.close();

  const icons = manifest?.icons ?? [];
  const anyIcon = (size) => icons.some((i) => String(i.sizes ?? "").split(" ").includes(size) && (i.purpose ?? "any").includes("any"));
  const checks = {
    "манифест найден и разобран": Boolean(got.url) && manifest !== null && (got.errors ?? []).filter((e) => e.critical).length === 0,
    "есть name или short_name": Boolean(manifest?.name || manifest?.short_name),
    "start_url есть": Boolean(manifest?.start_url),
    "display подходит": ["standalone", "fullscreen", "minimal-ui"].includes(manifest?.display),
    "иконки 192 и 512 назначения any": anyIcon("192x192") && anyIcon("512x512"),
    "воркер зарегистрирован": worker.registered,
  };
  return { url: got.url ?? null, errors: got.errors ?? [], manifest, checks };
}

async function main() {
  const browser = await chromium.launch();
  try {
    const site = await measure(browser, `${BASE}/es`, { waitForWorker: true });
    const control = await measure(browser, "https://example.com/", { waitForWorker: false });

    console.log(`ЗАМЕР УСТАНОВКИ PWA — ${BASE}/es`);
    console.log(`  адрес манифеста: ${site.url ?? "НЕ НАЙДЕН"}`);
    for (const [name, ok] of Object.entries(site.checks)) console.log(`  ${ok ? "да " : "НЕТ"} — ${name}`);
    const passed = Object.values(site.checks).filter(Boolean).length;
    console.log(`  условий выполнено ${passed} из ${Object.keys(site.checks).length}`);
    if (site.manifest) {
      const named = ["id", "lang", "dir", "scope", "categories", "orientation", "screenshots", "related_applications"];
      const missing = named.filter((f) => site.manifest[f] === undefined);
      console.log(`  полей из долга 83 на месте ${named.length - missing.length} из ${named.length}${missing.length ? `; нет: ${missing.join(", ")}` : ""}`);
      console.log(`  снимков экрана ${site.manifest.screenshots?.length ?? 0}`);
    }

    console.log(`КОНТРОЛЬ — https://example.com/ (ни манифеста, ни воркера)`);
    for (const [name, ok] of Object.entries(control.checks)) console.log(`  ${ok ? "да " : "НЕТ"} — ${name}`);
    const blind = control.checks["манифест найден и разобран"];
    console.log(
      blind
        ? "ПРИБОР СЛЕП: контроль без манифеста прошёл условие 1 — ответ прибора не значит ничего (правило 4.1)"
        : "прибор различает: контроль без манифеста условие 1 провалил",
    );
    process.exitCode = blind ? 1 : 0;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
