import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The lesson of 30-31.08.2026, as a test: **a sitemap crawl is not a site
 * crawl**. Auditing every URL in sitemap.xml gave a clean bill of health
 * while six pages that robots.txt allows, the footer links to from every
 * page, and Google can therefore index — /es|ru/terms, /privacy, /download —
 * were serving the home page's title, because the audit never looked at
 * them.
 *
 * A page reachable by a crawler has to be in exactly one of three states,
 * and this file is what keeps that true:
 *   1. listed in sitemap.xml, or
 *   2. disallowed in robots.txt, or
 *   3. explicitly noindex.
 * Anything else is a page that can be indexed but that nobody is looking
 * after.
 */

const APP = join(process.cwd(), "src", "app");

function pageFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) pageFiles(path, acc);
    else if (entry.name === "page.tsx") acc.push(path);
  }
  return acc;
}

/** Static routes only — the dynamic ones are enumerated in sitemap.ts from
 * the database and cannot be read off the filesystem. */
function staticRoutes(): string[] {
  const out: string[] = [];
  for (const file of pageFiles(APP)) {
    const route = file.slice(APP.length + 1).replace(/\/page\.tsx$/, "");
    const segs = route.split("/").filter(Boolean);
    if (segs[0] !== "[lang]") continue;
    const rest = segs.slice(1);
    if (rest.some((s) => s.startsWith("["))) continue;
    out.push(rest.length ? `/${rest.join("/")}` : "");
  }
  return out.sort();
}

const sitemapSource = readFileSync(join(APP, "sitemap.ts"), "utf8");
const robotsSource = readFileSync(join(APP, "robots.ts"), "utf8");

/** Path literals inside the two arrays sitemap.ts builds its static list
 * from. Read as text on purpose: importing sitemap.ts pulls in the database
 * client, and this check must run in the unit suite with no Turso. */
function sitemapStaticPaths(): string[] {
  const out: string[] = [];
  for (const name of ["staticPaths", "esOnlyPaths"]) {
    const block = sitemapSource.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n  \\];`));
    if (!block) throw new Error(`could not find ${name} in sitemap.ts`);
    for (const m of block[1].matchAll(/"([^"]*)"/g)) out.push(m[1]);
  }
  return out;
}

function robotsDisallows(): string[] {
  const block = robotsSource.match(/disallow: \[([\s\S]*?)\n {8}\],/);
  if (!block) throw new Error("could not find the disallow list in robots.ts");
  return [...block[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]);
}

/** The literal `Allow:` entries. The 80 free puzzles are generated from
 * constants rather than written out, so only the literals are readable as
 * text — which is exactly why the precedence rule below has to be modelled
 * instead of assumed: a hand-written Allow line CAN appear here later. */
function robotsAllows(): string[] {
  const block = robotsSource.match(/allow: \[([\s\S]*?)\],\n/);
  if (!block) throw new Error("could not find the allow list in robots.ts");
  return [...block[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]);
}

/** robots.txt path pattern -> matcher. `*` is any run of characters, a
 * trailing `$` anchors the end, everything else is a prefix match. */
function matches(path: string, pattern: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source =
    "^" +
    body
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&"))
      .join(".*") +
    (anchored ? "$" : "");
  return new RegExp(source).test(path);
}

/**
 * True if a crawler obeying robots.txt is kept off `path`.
 *
 * Allow and Disallow have to be weighed against each other, not checked in
 * isolation: Google resolves a conflict by the LENGTH of the path pattern,
 * longest wins, and Allow wins an exact tie. `Allow: "/"` is length 1 and
 * therefore overrides nothing.
 *
 * Modelled rather than approximated because the approximation was wrong in
 * a way that fails silently. An audit script here treated every `Allow:` as
 * absent and so counted all 160 free puzzle URLs — pages robots.txt opens
 * on purpose — as blocked. In this test the same shortcut is worse than a
 * wrong number: a route covered by a blanket Disallow AND re-opened by a
 * narrower Allow would be filed under "disallowed, nothing to check" and
 * would then be free to sit outside the sitemap with nobody watching it,
 * which is the precise failure this file exists to prevent.
 */
function isDisallowed(path: string, disallows: string[], allows: string[] = []): boolean {
  const candidates = [
    ...disallows.map((pattern) => ({ pattern, allow: false })),
    ...allows.map((pattern) => ({ pattern, allow: true })),
  ].filter(({ pattern }) => pattern !== "" && matches(path, pattern));

  let best: { pattern: string; allow: boolean } | null = null;
  for (const rule of candidates) {
    if (
      best === null ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow && !best.allow)
    ) {
      best = rule;
    }
  }
  return best !== null && !best.allow;
}

function declaresNoindex(path: string): boolean {
  const file = join(APP, "[lang]", ...path.split("/").filter(Boolean), "page.tsx");
  const src = readFileSync(file, "utf8");
  return /robots:\s*\{[^}]*index:\s*false/.test(src);
}

describe("every crawlable static route is accounted for", () => {
  const disallows = robotsDisallows();
  const allows = robotsAllows();
  const inSitemap = new Set(sitemapStaticPaths());

  it("reads both source files rather than passing vacuously", () => {
    // Guard on the parsing itself: if either regex stops matching, every
    // assertion below would be comparing empty sets.
    expect(disallows.length).toBeGreaterThan(10);
    expect(inSitemap.size).toBeGreaterThan(10);
    expect(staticRoutes().length).toBeGreaterThan(20);
    expect(inSitemap.has("/pricing")).toBe(true);
    expect(disallows).toContain("/admin");
    expect(allows).toContain("/");
  });

  it("leaves no static route indexable, unlisted and unmanaged", () => {
    const orphans = staticRoutes().filter(
      (path) => !inSitemap.has(path) && !isDisallowed(path, disallows, allows) && !declaresNoindex(path),
    );
    expect(orphans).toEqual([]);
  });

  it("positive control: an unlisted, allowed, indexable route is reported", () => {
    // Reproduces exactly the state /es/terms was in before 31.08.2026.
    const orphans = ["/terms-planted"].filter(
      (path) => !inSitemap.has(path) && !isDisallowed(path, disallows, allows),
    );
    expect(orphans).toEqual(["/terms-planted"]);
  });

  it("weighs Allow against Disallow by pattern length, not by presence", () => {
    // The blanket `Allow: "/"` must not open anything: it is the shortest
    // possible pattern and loses every conflict.
    expect(isDisallowed("/admin/users", disallows, allows)).toBe(true);
    expect(isDisallowed("/login", disallows, allows)).toBe(true);

    // A narrower Allow must beat a broader Disallow — this is the case the
    // shortcut got wrong, and the one that would hide a route from the
    // orphan check above.
    const narrower = ["/*/word-games/WORD_SEARCH/A1/1$"];
    const broader = ["/*/word-games/"];
    expect(isDisallowed("/es/word-games/WORD_SEARCH/A1/1", broader, narrower)).toBe(false);
    // …but only where it actually matches: `$` anchors the end, so
    // sequence 10 is still covered by the broad Disallow.
    expect(isDisallowed("/es/word-games/WORD_SEARCH/A1/10", broader, narrower)).toBe(true);
    // An Allow that is shorter than the Disallow does not win.
    expect(isDisallowed("/es/word-games/WORD_SEARCH/A1/1", broader, ["/es/"])).toBe(true);
    // Exact tie goes to Allow.
    expect(isDisallowed("/groups", ["/groups"], ["/groups"])).toBe(false);
  });

  it("positive control: ignoring Allow gives a different, wrong answer", () => {
    // Without this the test above could be passing for the wrong reason —
    // it has to be shown that the old presence-only logic and the new
    // length-weighted logic actually disagree on a real robots.txt path.
    const path = "/es/word-games/CROSSWORD/B2/10";
    const ignoringAllow = isDisallowed(path, ["/*/word-games/"], []);
    const weighingAllow = isDisallowed(path, ["/*/word-games/"], ["/*/word-games/CROSSWORD/B2/10$"]);
    expect(ignoringAllow).toBe(true);
    expect(weighingAllow).toBe(false);
  });

  it("keeps the three resolutions distinguishable", () => {
    // /terms and /privacy are listed; /download is noindex; /admin is
    // disallowed. If any of the three mechanisms stops being detected, the
    // main assertion turns into a weaker one without failing.
    expect(inSitemap.has("/terms")).toBe(true);
    expect(inSitemap.has("/privacy")).toBe(true);
    expect(inSitemap.has("/download")).toBe(false);
    expect(declaresNoindex("/download")).toBe(true);
    expect(declaresNoindex("/terms")).toBe(false);
    expect(isDisallowed("/admin/users", disallows, allows)).toBe(true);
    expect(isDisallowed("/terms", disallows, allows)).toBe(false);
  });
});
