// Check what a BROWSER sees on production, not what curl sees.
//
// Why this exists — incident №1, 29.08.2026. Every prod measurement in
// PROGRESS.md up to that day was an anonymous HTTP fetch with no JavaScript:
// 1908 URLs, all 200, every title and description accounted for. A signed-in
// user on mobile Chrome was meanwhile getting "Something went wrong" on
// /es/courses. Both were true at once. A status code and a byte count cannot
// see a render that fails after the 200, and no positive control planted in
// such a check would have helped: a control proves a check can find the kind
// of defect it looks for, and that check could not observe this kind at all.
//
// So this one runs a real Chromium, waits for hydration, and asserts that
// the content a page is *for* is actually in the DOM. Eight families, not
// all 1908 URLs — the point is coverage of rendering shapes, not of rows.
//
// Anonymous is not enough either: the incident was signed-in-only, and the
// signed-in surface differs (BottomNav exists only for a logged-in mobile
// user, and /es/courses is one of its five tabs — that tab is the only way
// a signed-in mobile user reaches the failing page by tapping). With
// --email/--password this runs every family a second time with a session and
// reports which families actually render differently.
//
//   node scripts/check-rendered-surface.mjs
//   node scripts/check-rendered-surface.mjs --base=http://localhost:3111
//   node scripts/check-rendered-surface.mjs --email=… --password=…
//   node scripts/check-rendered-surface.mjs --control   (see below)
//
// --control is mandatory before believing a clean run. It re-runs one family
// with the page's own markup broken in three different ways and requires the
// checker to fail on each. A green run with no control is not a result.
import { chromium, devices } from "@playwright/test";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "https://rusofacilapp.com").replace(/\/$/, "");
const EMAIL = arg("email", "");
const PASSWORD = arg("password", "");
const RUN_CONTROL = argv.includes("--control");

/**
 * One entry per rendering shape, not per URL. `expect` is what the page is
 * FOR — the thing whose absence means the page failed even though it
 * answered 200. Checked after hydration, in the DOM, so a client-side
 * failure is visible; `h1` alone is not enough, because the server shell can
 * carry an h1 that a later client error then blanks out.
 */
const FAMILIES = [
  { name: "home",      path: "/es",                                   expect: { h1: /\S/, min: 3, sel: 'a[href^="/es/"]' } },
  { name: "courses",   path: "/es/courses",                           expect: { h1: /Cursos/i, min: 4, sel: 'a[href^="/es/courses/"]' } },
  { name: "level",     path: "/es/courses/a1",                        expect: { h1: /A1/i, min: 20, sel: 'a[href^="/es/courses/a1/"]' } },
  { name: "lesson",    path: "/es/courses/a1/1",                      expect: { h1: /\S/, min: 1, sel: "h2, article, section" } },
  { name: "story",     path: "/es/stories",                           expect: { h1: /\S/, min: 5, sel: 'a[href^="/es/stories/"]' } },
  { name: "vocabulary",path: "/es/vocabulary",                        expect: { h1: /\S/, min: 5, sel: 'a[href^="/es/vocabulary/"]' } },
  { name: "glossary",  path: "/es/glossary",                          expect: { h1: /Glosario/i, min: 20, sel: 'a[href^="/es/glossary/"]' } },
  // The topic landings carry an h1 and no h2/h3 at all — checked against the
  // live markup, this is what the page is, not a fault. What it is FOR is
  // the puzzle links, so that is what must be present.
  { name: "landing",   path: "/es/sopa-de-letras-ruso-comida",        expect: { h1: /\S/, min: 3, sel: 'a[href^="/es/word-games/"]' } },
  { name: "puzzle",    path: "/es/word-games",                        expect: { h1: /\S/, min: 3, sel: 'a[href^="/es/word-games/"]' } },
];

/** The one string that means an error boundary rendered instead of a page.
 * Both spellings: global-error's and the localized boundaries'. */
const BOUNDARY_TEXT = /Something went wrong|Algo salió mal|Что-то пошло не так/;

async function inspect(ctx, family, breakIt) {
  const page = await ctx.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(`uncaught: ${String(e).slice(0, 120)}`));
  if (breakIt) await breakIt(page);

  const res = await page
    .goto(BASE + family.path, { waitUntil: "networkidle", timeout: 60_000 })
    .catch((e) => { problems.push(`navigation: ${e.message.slice(0, 100)}`); return null; });
  // Hydration and any effect-driven fetch need a beat to fail.
  await page.waitForTimeout(1200);

  const status = res?.status() ?? 0;
  if (status !== 200) problems.push(`http ${status}`);

  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (BOUNDARY_TEXT.test(bodyText)) problems.push("error boundary rendered");

  const h1 = (await page.locator("h1").first().textContent().catch(() => null))?.trim() ?? "";
  if (!family.expect.h1.test(h1)) problems.push(`h1 ${h1 ? `"${h1.slice(0, 40)}"` : "missing"} fails ${family.expect.h1}`);

  const found = await page.locator(family.expect.sel).count().catch(() => 0);
  if (found < family.expect.min) problems.push(`${found} of ≥${family.expect.min} "${family.expect.sel}"`);

  const fingerprint = { h1, found, chars: bodyText.length, bottomNav: await page.locator('nav a[href="/es/profile"]').count().catch(() => 0) };
  await page.close();
  return { problems, fingerprint };
}

async function signedInContext(browser) {
  const ctx = await browser.newContext({ ...devices["Pixel 5"] });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/es/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.all([page.waitForURL(/\/es\//, { timeout: 60_000 }), page.click('button[type="submit"]')]);
  const ok = (await ctx.cookies()).some((c) => c.name === "session");
  await page.close();
  if (!ok) throw new Error("could not sign in — no session cookie; check --email/--password");
  return ctx;
}

async function main() {
  const browser = await chromium.launch();
  let failures = 0;

  const anon = await browser.newContext({ ...devices["Pixel 5"] });
  console.log(`\n=== ${BASE} — anonymous, real browser, after hydration ===`);
  const anonPrints = {};
  for (const f of FAMILIES) {
    const { problems, fingerprint } = await inspect(anon, f);
    anonPrints[f.name] = fingerprint;
    failures += problems.length ? 1 : 0;
    console.log(`  ${problems.length ? "FAIL" : "ok  "}  ${f.name.padEnd(11)} ${f.path}`);
    problems.forEach((p) => console.log(`          → ${p}`));
  }

  if (EMAIL && PASSWORD) {
    const ctx = await signedInContext(browser);
    console.log(`\n=== ${BASE} — SIGNED IN, real browser, after hydration ===`);
    const differing = [];
    for (const f of FAMILIES) {
      const { problems, fingerprint } = await inspect(ctx, f);
      failures += problems.length ? 1 : 0;
      const before = anonPrints[f.name];
      // "Renders differently with a session" — the families that an
      // anonymous crawl cannot speak for at all.
      const changed = before.bottomNav !== fingerprint.bottomNav || Math.abs(before.chars - fingerprint.chars) > 40 || before.found !== fingerprint.found;
      if (changed) differing.push(f.name);
      console.log(`  ${problems.length ? "FAIL" : "ok  "}  ${f.name.padEnd(11)} ${f.path}${changed ? "   [renders differently with a session]" : ""}`);
      problems.forEach((p) => console.log(`          → ${p}`));
    }
    console.log(`\n  families an anonymous crawl cannot speak for: ${differing.length ? differing.join(", ") : "(none detected)"}`);
    await ctx.close();
  } else {
    console.log("\n  (no --email/--password: the signed-in surface was NOT checked — it is the surface incident №1 happened on)");
  }

  if (RUN_CONTROL) {
    console.log(`\n=== positive control: the checker must FAIL on a broken render ===`);
    const breakages = [
      ["content stripped after hydration", async (p) => { await p.addInitScript(() => { addEventListener("load", () => setTimeout(() => document.querySelectorAll("a").forEach((a) => a.remove()), 300)); }); }],
      ["h1 replaced", async (p) => { await p.addInitScript(() => { addEventListener("load", () => setTimeout(() => document.querySelectorAll("h1").forEach((h) => (h.textContent = "—")), 300)); }); }],
      ["error boundary text present", async (p) => { await p.addInitScript(() => { addEventListener("load", () => setTimeout(() => document.body.append("Something went wrong"), 300)); }); }],
    ];
    let caught = 0;
    for (const [label, breakIt] of breakages) {
      const { problems } = await inspect(anon, FAMILIES[1], breakIt);
      const ok = problems.length > 0;
      caught += ok ? 1 : 0;
      console.log(`  ${ok ? "caught " : "MISSED "} ${label}${ok ? ` → ${problems[0]}` : ""}`);
    }
    console.log(`  planted ${breakages.length}, caught ${caught}`);
    if (caught !== breakages.length) failures += 1;
  } else {
    console.log("\n  (no --control: this run has NOT shown it can detect a broken render — see PROGRESS.md 4.1)");
  }

  await anon.close();
  await browser.close();
  console.log(`\nfamilies with problems: ${failures}`);
  process.exitCode = failures ? 1 : 0;
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
