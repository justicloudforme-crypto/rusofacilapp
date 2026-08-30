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
const EXPECT_PROGRESS = argv.includes("--expect-progress");
/**
 * CI's database is created by `prisma db push` and holds no content — there
 * is no committed source of it in this repository. So the "how many links
 * does this page have" thresholds cannot be met there and would fail every
 * run for a reason that has nothing to do with a broken render.
 *
 * --ci keeps everything that identifies the FAILURE (HTTP 200, no error
 * boundary in the DOM, an h1 that is present and in the right script, no
 * uncaught page error) and drops only the content counts. That is enough:
 * incident №1's signature was an error boundary and a body of twenty
 * characters, neither of which needs a populated database to see — as long
 * as the glossary fixture is loaded, which is what
 * scripts/seed-ci-render-fixture.mjs is for.
 */
const CI_MODE = argv.includes("--ci");
const EXPECT_SUBSCRIPTION = argv.includes("--expect-subscription");

/**
 * Debt 17. 119 of the 120 lessons are paid, and so are the full story text
 * and the media library — only lesson 1 of each level is free. So a
 * signed-in run on a free account leaves most of the product unchecked.
 *
 * Measured locally (a granted subscription against a genuinely free,
 * non-staff account), production build, same URL:
 *
 *     /es/courses/a1/2   138 692 -> 178 049 bytes
 *     /es/courses/b1/12  147 797 -> 200 139 bytes
 *     /es/stories/<id>   125 263 -> 185 877 bytes
 *
 * That is a real data cut, not a CSS hide: the locked payload never
 * contains the exercises, vocabulary or slides at all. The discriminator
 * used here is the paywall call to action, which is in the DOM for a free
 * account and absent for a subscriber.
 *
 * The character counts from a mobile viewport are NOT usable for this: the
 * lesson page keeps its content behind tabs, so innerText differed by 56
 * characters between the two accounts while the payload differed by 40 kB.
 */
/**
 * The locked lesson renders a summary of what is behind the paywall —
 * "Este módulo incluye 15 ejercicios con corrección automática." A
 * subscriber's document never contains it; the only occurrences there are
 * the untranslated "{count}" templates that ship in the dictionary payload.
 * So the digit is the discriminator, and it must be looked for in the
 * DOCUMENT, not in innerText: the lesson keeps its content behind tabs, so
 * a mobile viewport shows neither the paywall nor the content, and an
 * innerText check passed happily for a free account (measured — the first
 * version of this assertion did exactly that).
 */
const LOCKED_MODULE_SUMMARY = /incluye\s+\d+\s+(?:palabras|ejercicios|diapositivas)/;
// Only the paid lesson: its URL is the same in every environment. The
// story reader is just as paywalled (125 kB -> 186 kB in the same
// measurement) but its URL carries a story id that differs between the
// local database and production, so it cannot be a fixed entry here. Left
// out deliberately rather than hard-coded to an id that 404s elsewhere.
const SUBSCRIBER_ONLY = new Set(["es/lesson-paid"]);

/**
 * Debt 13. The signed-in pass used to run on a throwaway account with an
 * empty history, which covers the anonymous-vs-signed-in difference (the
 * header, BottomNav) but not the difference PROGRESS makes.
 *
 * Measured locally against the root dev.db's 333 real users — a user with
 * 4 lesson attempts, 410 flashcard reviews, 34 stories and 5 badges, against
 * a signed-in user with nothing. All nine families differed, but most only
 * by about three characters: the display name in the header. Three differ
 * STRUCTURALLY, by rendering elements that do not exist for an empty
 * account at all:
 *
 *     level        progress markers  1 → 8    lesson status circles
 *     vocabulary   progress markers  2 → 28   per-card mastery state
 *     puzzle       progress markers  0 → 10   solved-puzzle marks
 *
 * Those three are what an empty account cannot speak for. With
 * --expect-progress the signed-in pass requires them to be present, so the
 * run fails if the account it was given has no history — the check refusing
 * to certify a surface it did not actually exercise.
 */
// Thresholds are set to what a NON-SUBSCRIBER test account can actually
// reach: only lesson 1 of each level is free (isFreeTrialLesson), so
// /es/courses/a1 can show exactly one status circle, not eight. Demanding
// more would make this permanently red for the only kind of account that can
// be created from outside. A subscriber account would exercise more, and
// that remains uncovered — recorded as debt 17 rather than asserted here.
const PROGRESS_DEPENDENT = {
  "es/level": { sel: "span.bg-emerald-500, span.bg-amber-500\\/15", min: 1, what: "lesson status circles" },
};

/**
 * One entry per rendering shape, not per URL. `expect` is what the page is
 * FOR — the thing whose absence means the page failed even though it
 * answered 200. Checked after hydration, in the DOM, so a client-side
 * failure is visible; `h1` alone is not enough, because the server shell can
 * carry an h1 that a later client error then blanks out.
 */
/**
 * Both locales, not just /es. The incident's regex was built from glossary
 * terms shared by both, and /ru/courses/a1/1 was just as dead as /es — a
 * check that only ever looked at Spanish would have called the site healthy
 * with half of it broken. `h1` expectations are per-locale where the two
 * differ, `/\S/` where only "not blank" is meaningful.
 *
 * The topic landings are Spanish-only by design (they target Spanish search
 * demand), so that family has no /ru twin.
 */
function familiesFor(lang) {
  const es = lang === "es";
  return [
    { name: "home",       path: `/${lang}`,                  expect: { h1: /\S/, min: 3, sel: `a[href^="/${lang}/"]` } },
    { name: "courses",    path: `/${lang}/courses`,          expect: { h1: es ? /Cursos/i : /курс/i, min: 4, sel: `a[href^="/${lang}/courses/"]` } },
    { name: "level",      path: `/${lang}/courses/a1`,       expect: { h1: /A1/i, min: 20, sel: `a[href^="/${lang}/courses/a1/"]` } },
    { name: "lesson",     path: `/${lang}/courses/a1/1`,     expect: { h1: /\S/, min: 1, sel: "h2, article, section" } },
    { name: "story",      path: `/${lang}/stories`,          expect: { h1: /\S/, min: 5, sel: `a[href^="/${lang}/stories/"]` } },
    // The 23 /vocabulary/[categoria] pages are Spanish-only by design — they
    // target Spanish search demand and the sitemap carries 23 of them for
    // /es and 0 for /ru (checked live). So /ru/vocabulary is the flashcard
    // app itself with no category links, and demanding them there was the
    // check being wrong, not the page.
    { name: "vocabulary", path: `/${lang}/vocabulary`,       expect: es
        ? { h1: /\S/, min: 5, sel: 'a[href^="/es/vocabulary/"]' }
        : { h1: /\S/, min: 1, sel: "main" } },
    // Cyrillic is asserted again for /ru now that debt 16 is closed: this
    // check is what found the Spanish h1 there in the first place, and the
    // loosened expectation was only ever a placeholder for the untranslated
    // glossary block (25 keys, not the 19 the debt claimed).
    { name: "glossary",   path: `/${lang}/glossary`,         expect: { h1: es ? /Glosario/i : /[а-яё]/i, min: 20, sel: `a[href^="/${lang}/glossary/"]` } },
    // The topic landings carry an h1 and no h2/h3 at all — checked against
    // the live markup, this is what the page is, not a fault. What it is FOR
    // is the puzzle links, so that is what must be present.
    // `contentOnly`: this URL does not exist unless the database holds word
    // -game puzzles — the topic landing is generated from them. CI's
    // database has none and cannot get any (there is no committed source of
    // puzzle content), so the page 404s there for a reason that has nothing
    // to do with rendering. Skipped under --ci rather than asserted and
    // permanently red; it is covered by the run against production.
    ...(es ? [{ name: "landing", contentOnly: true, path: "/es/sopa-de-letras-ruso-comida", expect: { h1: /\S/, min: 3, sel: 'a[href^="/es/word-games/"]' } }] : []),
    { name: "puzzle",     path: `/${lang}/word-games`,       expect: { h1: /\S/, min: 3, sel: `a[href^="/${lang}/word-games/"]` } },
    // Paid surface, only meaningful with --expect-subscription. Lesson 2 of
    // A1 rather than lesson 1: lesson 1 of every level is the free trial.
    ...(es && EXPECT_SUBSCRIPTION
      ? [{ name: "lesson-paid", contentOnly: true, path: "/es/courses/a1/2", expect: { h1: /\S/, min: 1, sel: "h2, article, section" } }]
      : []),
  ].map((f) => ({ ...f, name: `${lang}/${f.name}` }));
}

const FAMILIES = [...familiesFor("es"), ...familiesFor("ru")].filter((f) => !(CI_MODE && f.contentOnly));

/** The one string that means an error boundary rendered instead of a page.
 * Both spellings: global-error's and the localized boundaries'. */
const BOUNDARY_TEXT = /Something went wrong|Algo salió mal|Что-то пошло не так/;

async function inspect(ctx, family, breakIt, signedIn = false) {
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

  // A Russian page whose heading is in Spanish is the shape of debt 16, and
  // it took a human noticing to find it the first time. Asserted for every
  // /ru family at once rather than per-family, because the next occurrence
  // will be in whichever block nobody is looking at. Cyrillic is required
  // rather than "no Spanish orthography": the brand name RusoFacilapp
  // carries an accent and appears inside correct Russian headings.
  if (family.path.startsWith("/ru") && h1 && !/[\u0430-\u044f\u0451\u0410-\u042f\u0401]/.test(h1)) {
    problems.push(`h1 on a /ru page has no Cyrillic at all: "${h1.slice(0, 50)}"`);
  }

  const found = await page.locator(family.expect.sel).count().catch(() => 0);
  if (!CI_MODE && found < family.expect.min) problems.push(`${found} of ≥${family.expect.min} "${family.expect.sel}"`);

  // Only on the signed-in pass: an anonymous visitor is SUPPOSED to see the
  // locked lesson, so asserting entitlement there would fail correctly-
  // behaving code. The first version of this check ran it on both passes and
  // reported the anonymous run as broken.
  if (signedIn && EXPECT_SUBSCRIPTION && SUBSCRIBER_ONLY.has(family.name)) {
    const html = await page
      .evaluate(() => fetch(location.href, { cache: "no-store" }).then((r) => r.text()))
      .catch(() => "");
    if (!html) problems.push("could not re-fetch the document to check entitlement");
    else if (LOCKED_MODULE_SUMMARY.test(html)) {
      problems.push("the lesson is still locked — this account is NOT a subscriber, so the paid surface is unchecked");
    }
  }

  if (signedIn && EXPECT_PROGRESS && PROGRESS_DEPENDENT[family.name]) {
    const { sel, min, what } = PROGRESS_DEPENDENT[family.name];
    const marks = await page.locator(sel).count().catch(() => 0);
    if (marks < min) problems.push(`${marks} of >=${min} ${what} — this account has no progress, so this family is NOT covered`);
  }

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
    console.log(`  ${problems.length ? "FAIL" : "ok  "}  ${f.name.padEnd(16)} ${f.path}`);
    problems.forEach((p) => console.log(`          → ${p}`));
  }

  if (EMAIL && PASSWORD) {
    const ctx = await signedInContext(browser);
    console.log(`\n=== ${BASE} — SIGNED IN, real browser, after hydration ===`);
    const differing = [];
    for (const f of FAMILIES) {
      const { problems, fingerprint } = await inspect(ctx, f, undefined, true);
      failures += problems.length ? 1 : 0;
      const before = anonPrints[f.name];
      // "Renders differently with a session" — the families that an
      // anonymous crawl cannot speak for at all.
      const changed = before.bottomNav !== fingerprint.bottomNav || Math.abs(before.chars - fingerprint.chars) > 40 || before.found !== fingerprint.found;
      if (changed) differing.push(f.name);
      console.log(`  ${problems.length ? "FAIL" : "ok  "}  ${f.name.padEnd(16)} ${f.path}${changed ? "   [renders differently with a session]" : ""}`);
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
      // Detected by the content-count assertion, which --ci switches off —
      // so in CI this control would MISS and fail the run for the wrong
      // reason. Dropped there rather than kept as a decorative pass: a
      // control that cannot fire is not a control.
      ...(CI_MODE ? [] : [["content stripped after hydration", async (p) => { await p.addInitScript(() => { addEventListener("load", () => setTimeout(() => document.querySelectorAll("a").forEach((a) => a.remove()), 300)); }); }]]),
      ["h1 replaced", async (p) => { await p.addInitScript(() => { addEventListener("load", () => setTimeout(() => document.querySelectorAll("h1").forEach((h) => (h.textContent = "—")), 300)); }); }],
      ["error boundary text present", async (p) => { await p.addInitScript(() => { addEventListener("load", () => setTimeout(() => document.body.append("Something went wrong"), 300)); }); }],
    ];
    let caught = 0;
    for (const [label, breakIt] of breakages) {
      const { problems } = await inspect(anon, FAMILIES.find((f) => f.name === "es/courses"), breakIt);
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
