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

function isDisallowed(path: string, disallows: string[]): boolean {
  // robots.ts writes both the bare form and a "/*"-prefixed one for the
  // locale-prefixed URL; either counts.
  return disallows.some((d) => {
    const bare = d.replace(/^\/\*/, "").replace(/\/$/, "");
    return bare !== "" && (path === bare || path.startsWith(`${bare}/`));
  });
}

function declaresNoindex(path: string): boolean {
  const file = join(APP, "[lang]", ...path.split("/").filter(Boolean), "page.tsx");
  const src = readFileSync(file, "utf8");
  return /robots:\s*\{[^}]*index:\s*false/.test(src);
}

describe("every crawlable static route is accounted for", () => {
  const disallows = robotsDisallows();
  const inSitemap = new Set(sitemapStaticPaths());

  it("reads both source files rather than passing vacuously", () => {
    // Guard on the parsing itself: if either regex stops matching, every
    // assertion below would be comparing empty sets.
    expect(disallows.length).toBeGreaterThan(10);
    expect(inSitemap.size).toBeGreaterThan(10);
    expect(staticRoutes().length).toBeGreaterThan(20);
    expect(inSitemap.has("/pricing")).toBe(true);
    expect(disallows).toContain("/admin");
  });

  it("leaves no static route indexable, unlisted and unmanaged", () => {
    const orphans = staticRoutes().filter(
      (path) => !inSitemap.has(path) && !isDisallowed(path, disallows) && !declaresNoindex(path),
    );
    expect(orphans).toEqual([]);
  });

  it("positive control: an unlisted, allowed, indexable route is reported", () => {
    // Reproduces exactly the state /es/terms was in before 31.08.2026.
    const orphans = ["/terms-planted"].filter(
      (path) => !inSitemap.has(path) && !isDisallowed(path, disallows),
    );
    expect(orphans).toEqual(["/terms-planted"]);
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
    expect(isDisallowed("/admin/users", disallows)).toBe(true);
    expect(isDisallowed("/terms", disallows)).toBe(false);
  });
});
