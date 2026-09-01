// Check the SHAPE of the page, not its contents.
//
// Why this exists — 29.08.2026. `check:rendered` opens a real browser and
// asserts that what a page is FOR is in the DOM after hydration. It found
// incident №1 within the hour. But it looks at counts and text, so it is
// blind to everything about how the page is laid out: the owner found two
// defects on production that it reported as `ok` on the same day.
//
//   1. The sticky header was bg-background/95 with no backdrop-blur. Five
//      per cent of a large bold section heading scrolling underneath is
//      plainly legible: on a 610px Android viewport "¿Por qué estudiar con
//      nosotros?" sat readable right under the logo, and the same on
//      /es/courses and the "Refuerza con práctica" block.
//   2. The footer's six-link row was a non-wrapping flex, 428px of
//      intrinsic width. Centred in a 320px column it hung 54px off each
//      side — clipped on the left, sticking out on the right, and the
//      whole document scrolled sideways.
//
// Both are geometry. Neither changes what is in the DOM, so no amount of
// content assertions could have seen them.
//
// **Both were found by a person holding a phone, and this check ran in a
// desktop browser** — which is the gap closed on 30.08.2026. The run now
// has two halves:
//
//   - the WIDTH SWEEP: Chromium at 320/375/610/768, the original shape of
//     this check, kept because it is what caught the two defects and
//     because 610 (the width the report came from) matches no real device
//     profile;
//   - the DEVICE SWEEP: real Playwright device profiles, in BOTH engines —
//     WebKit for the iPhones, Chromium for the Androids — with the touch,
//     device-pixel-ratio and user-agent each profile carries. A phone is
//     not a narrow desktop window: `hover` does not exist, the DPR is 2–3,
//     and WebKit's layout is not Chromium's.
//
// This is deliberately NOT screenshot comparison. A stored baseline image
// fails on every wording change and teaches people to re-bless it, which
// is how a check stops being read. These are two measurements with no
// baseline at all:
//
//   A. document width  — documentElement.scrollWidth must not exceed its
//      clientWidth. Horizontal page scroll is never intentional here.
//   B. the pinned bar  — anything position:sticky/fixed that content
//      scrolls underneath must actually HIDE it: an opaque background, or
//      a backdrop-filter (which is what the app's other ten pinned bars
//      use, and why only the header was affected).
//   C. the empty container — the mirror of A, added 02.09.2026 for the
//      tablet band: a row of content covering under 70% of a container
//      wider than 700px. See scripts/layout-fill.mjs for the rule and for
//      what it was measured on. A and C cannot both fire on one box, which
//      is why one check can carry both.
//
//   node scripts/check-layout-geometry.mjs
//   node scripts/check-layout-geometry.mjs --base=http://localhost:3123
//   node scripts/check-layout-geometry.mjs --control
//   node scripts/check-layout-geometry.mjs --widths-only   (skip devices)
//
// --control is mandatory before believing a clean run: it plants one
// over-wide element and one translucent header and requires both to be
// caught, in each engine that ran. See PROGRESS.md 4.1 — a zero without a
// control is not a result.
import { chromium, devices, webkit } from "@playwright/test";
import { pathToFileURL } from "node:url";
import {
  FILL_THRESHOLD,
  MIN_CONTAINER_WIDTH,
  findUnderfilledRows,
  formatUnderfilled,
} from "./layout-fill.mjs";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "https://rusofacilapp.com").replace(/\/$/, "");
const RUN_CONTROL = argv.includes("--control");
/** Escape hatch for a quick local loop, not for CI: it drops the half of
 * the run that exists because the defects were found on a phone. */
const WIDTHS_ONLY = argv.includes("--widths-only");
/**
 * CI's database is created by `prisma db push` and holds no content, so the
 * glossary, the stories index and the word games 404 there for a reason
 * that has nothing to do with layout. --ci keeps only the pages that render
 * without content — which is enough for this check, because the two things
 * it measures (the sticky header and the footer) are on every page of the
 * site. Both positive controls still run: they need no content either.
 */
const CI_MODE = argv.includes("--ci");

/**
 * Shapes, not rows — the footer is on every page and the header is the
 * layout, so this list only has to cover the ways a page can be built.
 *
 * `tab` opens one of the lesson page's tabs before measuring. That is the
 * practice block: "Refuerza con práctica" was one of the three screens the
 * owner reported, and the pronunciation practice inside the Ejercicios tab
 * is not in the DOM at all until the tab is opened (see LessonView's
 * `exercisesEverOpened`) — so a run that never clicks it has never
 * measured it, however many widths it used.
 */
const ALL_PAGES = [
  { path: "/es" },
  { path: "/ru" },
  { path: "/es/courses" },
  { path: "/ru/courses" },
  { path: "/es/courses/a1/1" },
  { path: "/ru/courses/a1/1" },
  { path: "/es/courses/a1/1", tab: "Ejercicios", label: "/es/courses/a1/1 [práctica]" },
  { path: "/es/stories", contentOnly: true },
  { path: "/es/glossary", contentOnly: true },
  { path: "/es/word-games", contentOnly: true },
  /**
   * The game landing pages, added 30.08.2026 — the shape this check had
   * never looked at, and the one that was broken on production the whole
   * time it was reporting `ok`. They embed a real puzzle board, so their
   * width is decided by DATA (the puzzle's column count) rather than by
   * the template: 16-column puzzles overflowed and 12-column ones did not,
   * on the same page component. `-comida` is the failing one measured on
   * 30.08.2026; `-familia` is kept beside it deliberately, as the page
   * that fit — so a regression that widens every board is told apart from
   * one that only widens the big ones.
   *
   * contentOnly: both need a WordGamePuzzle row, which CI's empty database
   * has not got.
   */
  { path: "/es/sopa-de-letras-ruso-comida", contentOnly: true },
  { path: "/es/sopa-de-letras-ruso-familia", contentOnly: true },
  { path: "/es/crucigramas-ruso-principiantes", contentOnly: true },
];
const PAGES = ALL_PAGES.filter((p) => !(CI_MODE && p.contentOnly));

/**
 * 320 is the narrowest phone still in use and the width the footer row
 * overhung worst. 610 is where the defect was reported from (an Android
 * device in portrait, below the sm breakpoint) and matches no device
 * profile, which is why this sweep is kept alongside the device one. 768
 * is the sm layout, where the footer's OUTER row overflowed for a
 * different reason than the inner one — a single width would have found
 * one of the two and called the other fixed.
 */
const WIDTHS = [320, 375, 610, 768, 820, 1024];

/**
 * Real phones, and the engine each one actually runs. Chosen to cover the
 * two breakpoints the defects straddled (below `sm` and at `sm`) in both
 * engines, not to enumerate the market:
 *
 *   iPhone SE      320  WebKit    the narrowest, where the footer was worst
 *   iPhone 13      390  WebKit    the ordinary modern iPhone
 *   iPad Mini      768  WebKit    exactly the sm breakpoint, outer footer row
 *   Galaxy S9+     320  Chromium  the same 320 in the other engine
 *   Pixel 5        393  Chromium  the ordinary modern Android
 *
 * The owner's report came from a 610px Android viewport, which no profile
 * matches — that width lives in the sweep above.
 */
const DEVICES = ["iPhone SE", "iPhone 13", "iPad Mini", "Galaxy S9+", "Pixel 5"];

/**
 * Runs in the page. Returns both measurements plus, when the document is
 * too wide, the element to blame.
 *
 * Attributing the overflow is the fiddly half. A carousel deliberately
 * scrolls sideways INSIDE its own box (the homepage word deck, the lesson
 * tab strip), and its children stick out of the viewport by design — so an
 * element only counts if nothing between it and <body> is itself
 * horizontally scrollable. Without that filter the first run blamed the
 * word deck on every page and the real cause never surfaced.
 */
function measure() {
  const de = document.documentElement;
  const vw = de.clientWidth;

  const scrollsHorizontally = (el) => {
    const o = getComputedStyle(el).overflowX;
    return o === "auto" || o === "scroll";
  };
  const insideAScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (scrollsHorizontally(p)) return true;
    }
    return false;
  };

  let widest = null;
  for (const el of document.querySelectorAll("body *")) {
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) continue;
    // How far this box escapes the viewport, on either side.
    const over = Math.round(Math.max(b.right - vw, -b.left));
    if (over <= 1) continue;
    if (insideAScroller(el)) continue;
    if (!widest || over > widest.over) {
      widest = {
        over,
        width: Math.round(b.width),
        left: Math.round(b.left),
        right: Math.round(b.right),
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 70),
        text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50),
      };
    }
  }

  // Every bar that content scrolls underneath. A bar is only honest if it
  // hides what passes below: opaque, or blurred on purpose.
  const bars = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "sticky" && cs.position !== "fixed") continue;
    const b = el.getBoundingClientRect();
    if (b.width < vw * 0.5 || b.height === 0) continue; // not a full-width bar
    const bg = cs.backgroundColor;
    const alpha = (() => {
      const m = bg.match(/^rgba?\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(/[\s,/]+/).filter(Boolean);
        return parts.length >= 4 ? Number(parts[3]) : 1;
      }
      // oklab()/oklch()/color() — the alpha is whatever follows the slash.
      const slash = bg.match(/\/\s*([\d.]+%?)\s*\)/);
      if (slash) return slash[1].endsWith("%") ? Number(slash[1].slice(0, -1)) / 100 : Number(slash[1]);
      if (bg === "transparent" || bg === "rgba(0, 0, 0, 0)") return 0;
      return 1;
    })();
    const blur = cs.backdropFilter && cs.backdropFilter !== "none";
    bars.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || "").slice(0, 60),
      position: cs.position,
      bg,
      alpha,
      blur,
      height: Math.round(b.height),
    });
  }

  return { vw, scrollWidth: de.scrollWidth, widest, bars };
}

/**
 * Measurement C, run in the page as its own evaluate: the shared rule is a
 * separate module, and Playwright serialises a function's SOURCE, so it
 * cannot be called from inside `measure` above — it would arrive at the
 * browser as an undefined free variable. Two evaluates on the same settled
 * page is the honest way to do it.
 */
async function measureFill(page) {
  return page
    .evaluate(findUnderfilledRows, { threshold: FILL_THRESHOLD, minContainer: MIN_CONTAINER_WIDTH })
    .catch(() => []);
}

async function inspect(ctx, page_, plant) {
  const path = typeof page_ === "string" ? page_ : page_.path;
  const tab = typeof page_ === "string" ? null : page_.tab;
  const page = await ctx.newPage();
  if (plant) await plant(page);
  const problems = [];
  const res = await page
    .goto(BASE + path, { waitUntil: "networkidle", timeout: 60_000 })
    .catch((e) => {
      problems.push(`navigation: ${e.message.slice(0, 90)}`);
      return null;
    });
  await page.waitForTimeout(600);
  const status = res?.status() ?? 0;
  if (status !== 200) problems.push(`http ${status}`);

  if (tab) {
    // The practice block does not exist until its tab is opened. A miss
    // here is reported, not swallowed: silently measuring the page without
    // the block would look exactly like measuring it with the block.
    const opened = await page
      .getByRole("tab", { name: tab, exact: true })
      .click({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (!opened) problems.push(`could not open the "${tab}" tab — this page's practice block was NOT measured`);
    await page.waitForTimeout(700);
  }

  // Scroll a screenful down before measuring the bars: `position: sticky`
  // only pins once its container has scrolled, and a bar measured at
  // scrollY=0 can be sitting in normal flow with nothing underneath it.
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(200);

  const m = await page.evaluate(measure).catch((e) => {
    problems.push(`measure failed: ${String(e).slice(0, 90)}`);
    return null;
  });
  const underfilled = await measureFill(page);
  if (m) m.underfilled = underfilled;

  if (m) {
    if (m.scrollWidth > m.vw + 1) {
      const w = m.widest;
      problems.push(
        `document is ${m.scrollWidth}px wide in a ${m.vw}px viewport` +
          (w
            ? ` — widest offender <${w.tag} class="${w.cls}"> ${w.width}px at [${w.left}, ${w.right}] "${w.text}"`
            : " — no single element to blame; check a parent's min-width")
      );
    }
    for (const row of m.underfilled) {
      problems.push(formatUnderfilled(row));
    }
    for (const bar of m.bars) {
      if (bar.alpha < 0.99 && !bar.blur) {
        problems.push(
          `pinned <${bar.tag} class="${bar.cls}"> is see-through (${bar.bg}, alpha ${bar.alpha}) ` +
            `with no backdrop-filter — content scrolling under it stays legible`
        );
      }
      if (bar.alpha === 0) {
        problems.push(`pinned <${bar.tag} class="${bar.cls}"> has no background at all`);
      }
    }
  }

  await page.close();
  return { problems, measured: m };
}

async function runControl(browser, engineName, contextOptions) {
  /**
   * The two planted defects, and the message each one must produce.
   * Declared inside the function, not at module scope: an `await` at the
   * top level of a script is what src/lib/entry-point.test.ts calls an
   * import side effect, and these plants are arrow functions that contain
   * one.
   */
  const PLANTS = [
    [
      "an element 400px wider than the viewport",
      // Sized off the viewport rather than at a literal 900px: the control
      // context moved to 1024 on 02.09.2026 so that measurement C has a
      // container in scope, and a fixed 900px stopped overflowing there —
      // it would have turned MISSED for a reason that says nothing about
      // whether the checker works.
      async (p) => {
        await p.addInitScript(() => {
          addEventListener("load", () =>
            setTimeout(() => {
              const d = document.createElement("div");
              d.style.cssText = `width:${window.innerWidth + 400}px;height:20px`;
              d.textContent = "planted overflow";
              document.body.append(d);
            }, 300)
          );
        });
      },
      /document is \d+px wide/,
    ],
    [
      "a header at 90% opacity (the defect as it shipped)",
      // addInitScript, not addStyleTag. The first version of this control
      // called addStyleTag BEFORE the navigation, so the style went to the
      // about:blank page and was gone by the time the real one loaded — it
      // planted nothing, and it still reported "caught" for the whole time
      // the header really was 0.95. The moment the header was fixed, the
      // control turned MISSED and gave itself away. That is the reason the
      // rule exists (PROGRESS.md 4.1): the plant has to survive to the page
      // under measurement, or the control is measuring the old defect.
      async (p) => {
        await p.addInitScript(() => {
          addEventListener("load", () =>
            setTimeout(() => {
              const style = document.createElement("style");
              style.textContent =
                "header { background-color: rgba(246,239,220,0.9) !important; backdrop-filter: none !important; }";
              document.head.append(style);
            }, 300)
          );
        });
      },
      /see-through/,
    ],
    [
      "a 300px block alone inside a 1000px container (measurement C)",
      // A container the page does not otherwise have, so the control
      // cannot pass by finding a defect that is already there — the exact
      // trap the header control fell into (see the note above it). 300 of
      // 1000 is 30%, well under the 70% the rule draws the line at, and
      // 1000 is over the 700px floor: both halves of the rule have to hold
      // for this to be caught, so a control that fires proves both.
      async (p) => {
        await p.addInitScript(() => {
          addEventListener("load", () =>
            setTimeout(() => {
              const outer = document.createElement("div");
              outer.style.cssText = "width:1000px;max-width:100%";
              const inner = document.createElement("div");
              inner.style.cssText = "width:300px;height:80px";
              // A CHILD, not just text: the rule ignores a lone member with
              // no parts, because one link or one paragraph sized to itself
              // is right at any width. A plant that the rule is entitled to
              // ignore proves nothing.
              const part = document.createElement("p");
              part.textContent = "planted hole";
              inner.append(part);
              outer.append(inner);
              document.body.append(outer);
            }, 300)
          );
        });
      },
      // Matches the plant's own TEXT, not just the shape of the message.
      // The first run of this control reported "caught" while pointing at a
      // real finding on the page it happened to load — passing by finding
      // somebody else's defect is the exact failure PROGRESS.md 4.1 was
      // written about, and it is only visible if the pattern names the
      // plant.
      /content fills .*planted hole/,
    ],
    [
      "a 2-track grid whose TRACKS are too narrow, both filled (measurement C keeps this)",
      // The frame/content line, from the frame side. Two items in a
      // two-track grid — every track filled, so nothing is missing — but
      // the tracks are 200px inside 1000px. That is the grid being built
      // wrong, and the rule that stopped reporting under-filled grids on
      // 02.09.2026 must not have stopped reporting this one too.
      async (p) => {
        await p.addInitScript(() => {
          addEventListener("load", () =>
            setTimeout(() => {
              const outer = document.createElement("div");
              outer.style.cssText =
                "width:1000px;max-width:100%;display:grid;grid-template-columns:200px 200px;gap:8px";
              for (const n of [1, 2]) {
                const cell = document.createElement("div");
                cell.style.cssText = "height:80px";
                const part = document.createElement("p");
                part.textContent = `narrow track ${n}`;
                cell.append(part);
                outer.append(cell);
              }
              document.body.append(outer);
            }, 300)
          );
        });
      },
      /content fills .*narrow track/,
    ],
  ];

  /**
   * The other half of the same question, and it has to be checked in the
   * same breath: a grid with FEWER items than tracks must NOT be reported.
   * A control that only ever proves the checker can go red proves nothing
   * about whether it goes red on the right things — and the twelve CI
   * failures of 02.09.2026 were all this shape.
   */
  const MUST_NOT_FIRE = [
    [
      "a 2-track grid holding one item (the /es hero with an empty card bank)",
      async (p) => {
        await p.addInitScript(() => {
          addEventListener("load", () =>
            setTimeout(() => {
              const outer = document.createElement("div");
              outer.style.cssText =
                "width:1000px;max-width:100%;display:grid;grid-template-columns:1fr 1fr;gap:8px";
              const cell = document.createElement("div");
              cell.style.cssText = "height:80px";
              const part = document.createElement("p");
              part.textContent = "lonely grid item";
              cell.append(part);
              outer.append(cell);
              document.body.append(outer);
            }, 300)
          );
        });
      },
      /content fills .*lonely grid item/,
    ],
  ];
  console.log(`\n=== positive control (${engineName}): the checker must FAIL on a planted defect ===`);
  const ctx = await browser.newContext(contextOptions);
  let caught = 0;
  for (const [label, plant, expected] of PLANTS) {
    const { problems } = await inspect(ctx, "/es", plant);
    const hit = problems.find((p) => expected.test(p));
    caught += hit ? 1 : 0;
    console.log(`  ${hit ? "caught " : "MISSED "} ${label}${hit ? ` → ${hit.slice(0, 110)}` : ""}`);
  }
  console.log(`  planted ${PLANTS.length}, caught ${caught}`);

  console.log(`  --- and must NOT fire on these ---`);
  let quiet = 0;
  for (const [label, plant, forbidden] of MUST_NOT_FIRE) {
    const { problems } = await inspect(ctx, "/es", plant);
    const hit = problems.find((p) => forbidden.test(p));
    quiet += hit ? 0 : 1;
    console.log(`  ${hit ? "WRONGLY REPORTED " : "quiet            "} ${label}${hit ? ` → ${hit.slice(0, 110)}` : ""}`);
  }
  console.log(`  checked ${MUST_NOT_FIRE.length}, quiet ${quiet}`);
  await ctx.close();
  return caught === PLANTS.length && quiet === MUST_NOT_FIRE.length;
}

async function main() {
  let failures = 0;
  const covered = [];
  const chrome = await chromium.launch();

  // --- Half one: the original width sweep, Chromium. ---
  for (const width of WIDTHS) {
    const ctx = await chrome.newContext({
      viewport: { width, height: 800 },
      deviceScaleFactor: 1,
      isMobile: width < 768,
      hasTouch: width < 768,
    });
    console.log(`\n=== ${BASE} — chromium, ${width}px viewport ===`);
    for (const page of PAGES) {
      const { problems, measured } = await inspect(ctx, page);
      failures += problems.length ? 1 : 0;
      const name = page.label ?? page.path;
      console.log(
        `  ${problems.length ? "FAIL" : "ok  "}  ${name.padEnd(28)} scrollWidth ${measured?.scrollWidth ?? "?"} / viewport ${measured?.vw ?? "?"}`
      );
      problems.forEach((p) => console.log(`          → ${p}`));
    }
    await ctx.close();
  }

  // --- Half two: real phone profiles, in the engine each one runs. ---
  let kit = null;
  if (!WIDTHS_ONLY) {
    for (const name of DEVICES) {
      const profile = devices[name];
      if (!profile) {
        console.log(`\n  device profile "${name}" is not in this Playwright build — SKIPPED`);
        failures += 1;
        continue;
      }
      const wantsWebkit = profile.defaultBrowserType === "webkit";
      if (wantsWebkit && !kit) kit = await webkit.launch();
      const browser = wantsWebkit ? kit : chrome;
      const ctx = await browser.newContext({ ...profile });
      console.log(
        `\n=== ${BASE} — ${name} (${profile.defaultBrowserType}, ${profile.viewport.width}×${profile.viewport.height}, dpr ${profile.deviceScaleFactor}) ===`
      );
      covered.push(`${name} / ${profile.defaultBrowserType}`);
      for (const page of PAGES) {
        const { problems, measured } = await inspect(ctx, page);
        failures += problems.length ? 1 : 0;
        const label = page.label ?? page.path;
        console.log(
          `  ${problems.length ? "FAIL" : "ok  "}  ${label.padEnd(28)} scrollWidth ${measured?.scrollWidth ?? "?"} / viewport ${measured?.vw ?? "?"}`
        );
        problems.forEach((p) => console.log(`          → ${p}`));
      }
      await ctx.close();
    }
    console.log(`\n  device profiles covered: ${covered.join(", ") || "(none)"}`);
  } else {
    console.log("\n  --widths-only: NO device profile was measured this run");
  }

  if (RUN_CONTROL) {
    // One control per engine that ran. A control proved in Chromium says
    // nothing about whether the same measurement works in WebKit, where
    // computed styles and lazy layout differ — and half this run is now
    // WebKit.
    // 1024, not 320. Measurement C needs a container over 700px to be in
    // scope at all, so at 320 its control would report MISSED for a reason
    // that says nothing about whether the checker works. The overflow
    // plant is sized off the viewport (see PLANTS) so it still overflows
    // here, and the header plant never depended on width.
    const okChrome = await runControl(chrome, "chromium", {
      viewport: { width: 1024, height: 800 },
      deviceScaleFactor: 1,
    });
    if (!okChrome) failures += 1;
    if (kit) {
      const okKit = await runControl(kit, "webkit", { ...devices["iPad Mini"] });
      if (!okKit) failures += 1;
    }
  } else {
    console.log("\n  (no --control: this run has NOT shown it can detect a layout defect — see PROGRESS.md 4.1)");
  }

  await chrome.close();
  if (kit) await kit.close();
  console.log(`\npages with problems: ${failures}`);
  process.exitCode = failures ? 1 : 0;
}

// Only when this file is the process entry point — see src/lib/entry-point.ts.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
