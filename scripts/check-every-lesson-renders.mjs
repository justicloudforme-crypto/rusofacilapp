// Every lesson page, in a real browser, after hydration.
//
// check-rendered-surface.mjs covers ONE lesson as a representative of the
// shape. That was enough to find incident №1 but is not enough to declare it
// fixed: the failing pattern was built from glossary terms, and which terms
// appear depends on the lesson's own text. A sample of three proves three
// pages work.
//
// So this walks all 240 lessons (4 levels x 60) in both locales, 480 URLs,
// and requires each to carry actual lesson content in the DOM — not merely
// answer 200, which all 480 did throughout the outage.
//
//   node scripts/check-every-lesson-renders.mjs --control
//   node scripts/check-every-lesson-renders.mjs --base=http://localhost:3111
//   node scripts/check-every-lesson-renders.mjs --levels=a1 --control
import { chromium, devices } from "@playwright/test";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "https://rusofacilapp.com").replace(/\/$/, "");
const LEVELS = arg("levels", "a1,a2,b1,b2").split(",");
const LOCALES = arg("locales", "es,ru").split(",");
const CONCURRENCY = Number(arg("concurrency", "6"));
const RUN_CONTROL = argv.includes("--control");

const BOUNDARY_TEXT = /Something went wrong|Algo salió mal|Что-то пошло не так/;

/**
 * What "the lesson rendered" means, in the DOM, after hydration.
 *
 * Deliberately not "has an h1": the server shell carries a correct h1 and
 * kept carrying it for the whole outage, while the body underneath was
 * replaced by six words of error text. The discriminator that actually
 * separated a working lesson from a dead one, measured on production on
 * 29.08.2026, was the body text length — a dead lesson's entire body was
 * "Something went wrong", about 20 characters; a live one runs to thousands.
 */
const MIN_BODY_CHARS = 400;

async function checkOne(ctx, path, breakIt) {
  const page = await ctx.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(`uncaught: ${String(e).slice(0, 100)}`));
  if (breakIt) await breakIt(page);
  const res = await page
    .goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60_000 })
    .catch((e) => { problems.push(`navigation: ${e.message.slice(0, 80)}`); return null; });
  // Hydration is what fails in this class, so it has to be waited for.
  await page.waitForTimeout(1500);

  const status = res?.status() ?? 0;
  if (status !== 200) problems.push(`http ${status}`);
  const body = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  if (BOUNDARY_TEXT.test(body)) problems.push("error boundary rendered");
  if (body.length < MIN_BODY_CHARS) problems.push(`body only ${body.length} chars`);
  const h1 = (await page.locator("h1").first().textContent().catch(() => null))?.trim() ?? "";
  if (!h1) problems.push("no h1");

  await page.close();
  return { path, problems, chars: body.length };
}

async function runAll(ctx, paths, breakIt) {
  const results = [];
  const queue = [...paths];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
        results.push(await checkOne(ctx, next, breakIt));
      }
    })
  );
  return results;
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["Pixel 5"] });

  // Lesson count per level is read off the live level page, not taken from a
  // constant here, so this cannot quietly check 40 pages and call it 60.
  //
  // Only the numeric children count. `a[href^="/es/courses/a1/"]` also
  // matches the three milestone-exam links (/exam/a1-exam-1 …), which is how
  // the first run of this script "found" 12 broken lessons at numbers 31–33
  // that simply do not exist: 33 links, 30 lessons. 30 per level x 4 levels
  // = 120 lessons, and 240 URLs across the two locales.
  const perLevel = {};
  for (const level of LEVELS) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/es/courses/${level}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const hrefs = await page.locator(`a[href^="/es/courses/${level}/"]`).evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    const numbers = hrefs
      .map((h) => new RegExp(`^/es/courses/${level}/(\\d+)$`).exec(h ?? "")?.[1])
      .filter(Boolean)
      .map(Number);
    perLevel[level] = numbers.length ? Math.max(...numbers) : 0;
    await page.close();
  }
  const paths = [];
  for (const lang of LOCALES) {
    for (const level of LEVELS) {
      for (let n = 1; n <= perLevel[level]; n++) paths.push(`/${lang}/courses/${level}/${n}`);
    }
  }
  console.log(`lessons per level (read off the live level pages): ${LEVELS.map((l) => `${l}=${perLevel[l]}`).join(", ")}`);
  console.log(`locales: ${LOCALES.join(", ")} → ${paths.length} URLs\n`);
  if (paths.length === 0) {
    console.log("FAIL — no lesson URLs found; an empty run would report zero problems");
    process.exitCode = 1;
    return;
  }

  const started = Date.now();
  const results = await runAll(ctx, paths);
  const broken = results.filter((r) => r.problems.length);
  const chars = results.map((r) => r.chars).sort((a, b) => a - b);

  console.log(`--- ${BASE} — all lesson pages, after hydration ---`);
  console.log(`  checked      : ${results.length} of ${paths.length}`);
  console.log(`  broken       : ${broken.length}`);
  for (const b of broken.slice(0, 20)) console.log(`      ${b.path} → ${b.problems.join("; ")}`);
  if (broken.length > 20) console.log(`      …and ${broken.length - 20} more`);
  console.log(`  body chars   : min ${chars[0]}, median ${chars[chars.length >> 1]}, max ${chars[chars.length - 1]}`);
  console.log(`  elapsed      : ${Math.round((Date.now() - started) / 1000)}s`);

  let controlOk = true;
  if (RUN_CONTROL) {
    console.log(`\n--- positive control: the same walk must FAIL on a broken lesson ---`);
    // Reproduces exactly what the outage looked like: the document arrives
    // fine and the body is replaced after hydration.
    const breakIt = async (p) => {
      await p.addInitScript(() => {
        addEventListener("load", () => setTimeout(() => { document.body.innerHTML = "<h1>x</h1>Something went wrong"; }, 300));
      });
    };
    const sample = paths.slice(0, 3);
    const controlled = await runAll(ctx, sample, breakIt);
    const caught = controlled.filter((r) => r.problems.length).length;
    controlled.forEach((r) => console.log(`  ${r.problems.length ? "caught " : "MISSED "} ${r.path} → ${r.problems.join("; ") || "reported healthy"}`));
    console.log(`  planted ${sample.length}, caught ${caught}`);
    controlOk = caught === sample.length;
  } else {
    console.log("\n  (no --control: this run has NOT shown it can detect a dead lesson)");
    controlOk = false;
  }

  await browser.close();
  const ok = broken.length === 0 && controlOk;
  console.log(ok ? "\nPASS" : "\nFAIL");
  process.exitCode = ok ? 0 : 1;
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
