import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOPIC_LANDING_PATHS } from "./word-games/topic-landings";
import { isDisallowed, isDisallowedIgnoringAllow } from "./robots-matcher";

/**
 * The lesson of 30-31.08.2026, as a test: **a sitemap crawl is not a site
 * crawl**. Auditing every URL in sitemap.xml gave a clean bill of health
 * while six pages that robots.txt allows, the footer links to from every
 * page, and Google can therefore index — /es|ru/terms, /privacy, /download —
 * were serving the home page's title, because the audit never looked at
 * them.
 *
 * A page reachable by a crawler has to be in at least one of three states,
 * and this file is what keeps that true:
 *   1. listed in sitemap.xml, or
 *   2. disallowed in robots.txt, or
 *   3. explicitly noindex.
 * A page in none of them can be indexed and nobody is looking after it.
 *
 * "At least one", not "exactly one" — being in two is belt and braces, not
 * a fault: /es|ru/styleguide is both disallowed in robots and noindex. The
 * assertion below has always been an orphan check (in NO state), so this
 * comment used to say something stricter than the code it introduces, and
 * stricter than the data. PROGRESS.md's prose said the same and has been
 * corrected with it (debt 7.12 №11).
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
  // The six themed landings are spread in from a table rather than typed
  // as literals, so reading the file as text cannot see them — this test
  // caught them as orphans the moment they were added, which is the check
  // working, not failing. The same constant is imported here so the two
  // sides cannot disagree; that sitemap.ts really spreads it is asserted
  // separately below, so deleting the spread still fails this file.
  out.push(...TOPIC_LANDING_PATHS);
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

/* The robots.txt matcher used to be defined here. It moved to
 * src/lib/robots-matcher.ts on 29.08.2026 so audit scripts can import the
 * same code instead of rewriting it from PROGRESS.md's description — one
 * such rewrite dropped Allow precedence and silently counted 160 open
 * pages as blocked. Its own behaviour is pinned in robots-matcher.test.ts;
 * what this file still asserts is that the three-state rule holds when
 * that matcher is applied to the real robots.ts. */

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
    // The table-driven paths are only in the sitemap because of this
    // spread; without asserting it, importing the constant above would
    // make the orphan check pass on a sitemap that never lists them.
    expect(sitemapSource).toContain("...TOPIC_LANDING_PATHS");
    expect(TOPIC_LANDING_PATHS.length).toBe(6);
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
    const ignoringAllow = isDisallowedIgnoringAllow(path, ["/*/word-games/"]);
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

  it("every database read in sitemap.ts degrades instead of taking the file down", () => {
    // On 29.08.2026 a single missing column made /sitemap.xml return HTTP
    // 500 in production — a sitemap that 500s is invisible to every
    // crawler, so one absent column silently switched off the whole
    // recrawl mechanism. The fix was to let a failed read cost only the
    // URLs it would have produced. That only holds while EVERY read is
    // wrapped: the post-compact audit found the puzzle read protected and
    // the story and glossary reads not, so this counts them rather than
    // trusting that whoever adds the next one remembers.
    const reads = [...sitemapSource.matchAll(/await db\.(\w+)\./g)].map((m) => m[1]);
    expect(reads.length).toBeGreaterThanOrEqual(3);

    const unprotected = reads.filter((model) => {
      // the read must sit inside a try { ... } catch that logs
      const re = new RegExp(`try\\s*\\{[^}]*await db\\.${model}\\.[\\s\\S]*?\\}\\s*catch`);
      return !re.test(sitemapSource);
    });
    expect(unprotected).toEqual([]);

    // and each catch must log rather than swallow — a sitemap quietly
    // serving 650 fewer URLs for weeks is its own kind of outage
    const catches = [...sitemapSource.matchAll(/catch \(error\) \{\s*console\.error\(/g)];
    expect(catches.length).toBe(reads.length);
  });

  it("positive control: an unwrapped read is reported", () => {
    // Without this, the check above could be passing because the regex
    // matches nothing rather than because every read is wrapped.
    const withBareRead = sitemapSource + "\n// const x = await db.exam.findMany();\nawait db.exam.findMany();\n";
    const reads = [...withBareRead.matchAll(/await db\.(\w+)\./g)].map((m) => m[1]);
    const unprotected = reads.filter((model) => {
      const re = new RegExp(`try\\s*\\{[^}]*await db\\.${model}\\.[\\s\\S]*?\\}\\s*catch`);
      return !re.test(withBareRead);
    });
    expect(unprotected).toContain("exam");
  });
});
