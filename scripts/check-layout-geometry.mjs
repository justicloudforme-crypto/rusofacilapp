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
//
//   node scripts/check-layout-geometry.mjs
//   node scripts/check-layout-geometry.mjs --base=http://localhost:3123
//   node scripts/check-layout-geometry.mjs --control
//
// --control is mandatory before believing a clean run: it plants one
// over-wide element and one translucent header and requires both to be
// caught. See PROGRESS.md 4.1 — a zero without a control is not a result.
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = arg("base", "https://rusofacilapp.com").replace(/\/$/, "");
const RUN_CONTROL = argv.includes("--control");
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
 * The three screens the defect was reported on, plus one per remaining
 * rendering shape. Same principle as check-rendered-surface.mjs: shapes,
 * not rows — the footer is on every page, and the header is the layout.
 */
const ALL_PAGES = [
  { path: "/es" },
  { path: "/ru" },
  { path: "/es/courses" },
  { path: "/ru/courses" },
  { path: "/es/courses/a1/1" },
  { path: "/es/stories", contentOnly: true },
  { path: "/es/glossary", contentOnly: true },
  { path: "/es/word-games", contentOnly: true },
];
const PAGES = ALL_PAGES.filter((p) => !(CI_MODE && p.contentOnly)).map((p) => p.path);

/**
 * 320 is the narrowest phone still in use and the width the footer row
 * overhung worst. 610 is where the defect was reported from (an Android
 * device in portrait, below the sm breakpoint). 768 is the sm layout,
 * where the footer's OUTER row overflowed for a different reason than the
 * inner one — a single width would have found one of the two and called
 * the other fixed.
 */
const WIDTHS = [320, 375, 610, 768];

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

async function inspect(ctx, path, width, plant) {
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

  // Scroll a screenful down before measuring the bars: `position: sticky`
  // only pins once its container has scrolled, and a bar measured at
  // scrollY=0 can be sitting in normal flow with nothing underneath it.
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(200);

  const m = await page.evaluate(measure).catch((e) => {
    problems.push(`measure failed: ${String(e).slice(0, 90)}`);
    return null;
  });

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

async function main() {
  const browser = await chromium.launch();
  const results = [];
  let failures = 0;

  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: 800 },
      deviceScaleFactor: 1,
      isMobile: width < 768,
      hasTouch: width < 768,
    });
    console.log(`\n=== ${BASE} — ${width}px viewport ===`);
    for (const path of PAGES) {
      const { problems, measured } = await inspect(ctx, path, width);
      failures += problems.length ? 1 : 0;
      results.push({ width, path, problems, measured });
      console.log(
        `  ${problems.length ? "FAIL" : "ok  "}  ${path.padEnd(20)} scrollWidth ${measured?.scrollWidth ?? "?"} / viewport ${measured?.vw ?? "?"}`
      );
      problems.forEach((p) => console.log(`          → ${p}`));
    }
    await ctx.close();
  }

  if (RUN_CONTROL) {
    console.log(`\n=== positive control: the checker must FAIL on a planted defect ===`);
    const ctx = await browser.newContext({ viewport: { width: 320, height: 800 }, isMobile: true, hasTouch: true });
    const plants = [
      [
        "an element 900px wide in a 320px viewport",
        async (p) => {
          await p.addInitScript(() => {
            addEventListener("load", () =>
              setTimeout(() => {
                const d = document.createElement("div");
                d.style.cssText = "width:900px;height:20px";
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
    ];
    let caught = 0;
    for (const [label, plant, expected] of plants) {
      const { problems } = await inspect(ctx, "/es", 320, plant);
      const hit = problems.find((p) => expected.test(p));
      caught += hit ? 1 : 0;
      console.log(`  ${hit ? "caught " : "MISSED "} ${label}${hit ? ` → ${hit.slice(0, 110)}` : ""}`);
    }
    console.log(`  planted ${plants.length}, caught ${caught}`);
    if (caught !== plants.length) failures += 1;
    await ctx.close();
  } else {
    console.log("\n  (no --control: this run has NOT shown it can detect a layout defect — see PROGRESS.md 4.1)");
  }

  await browser.close();
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
