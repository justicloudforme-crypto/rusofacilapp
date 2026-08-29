import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The safety net for canonical after 28.08.2026.
 *
 * Until then `[lang]/layout.tsx` produced canonical/hreflang for every route
 * from the request path, so a new page inherited a correct one for free. It
 * did that by calling headers() inside a layout's generateMetadata, which
 * forces the whole route tree to render dynamically — so it was removed and
 * each route now derives canonical from its own params.
 *
 * The cost of that trade is exactly this: there is no fallback any more. A
 * page added without a generateMetadata ships with NO canonical, which is
 * silent — nothing fails, nothing warns, and it only shows up as duplicate
 * URLs in Search Console weeks later. This test is what makes it loud.
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

/** The path routeAlternates must be called with for a given page file:
 * everything after the [lang] segment, dynamic segments re-encoded. Mirrors
 * how the URL is actually built, so a page moved to a new folder without
 * updating its metadata fails here instead of shipping a stale canonical. */
function expectedCall(file: string): string {
  const route = file.slice(APP.length + 1).replace(/\/page\.tsx$/, "");
  const rest = route.split("/").filter(Boolean).slice(1);
  if (rest.length === 0) return 'routeAlternates(lang, "")';
  if (!rest.some((s) => s.startsWith("["))) {
    return `routeAlternates(lang, "/${rest.join("/")}")`;
  }
  const expr = rest
    .map((s) => (s.startsWith("[") ? `/\${encodeURIComponent(${s.slice(1, -1)})}` : `/${s}`))
    .join("");
  return `routeAlternates(lang, \`${expr}\`)`;
}

const files = pageFiles(APP).sort();

describe("every page route declares its own canonical", () => {
  it("finds the app router pages at all", () => {
    // Guards the walker itself: if the layout of src/app ever changes and
    // this returns nothing, the rest of the file would pass vacuously.
    expect(files.length).toBeGreaterThan(50);
  });

  it("exports generateMetadata and sets alternates on every page", () => {
    const missing = files
      .filter((f) => {
        const src = readFileSync(f, "utf8");
        return !/function generateMetadata/.test(src) || !/alternates/.test(src);
      })
      .map((f) => f.slice(APP.length + 1));
    expect(missing).toEqual([]);
  });

  it("passes each route its own path, matching its folder", () => {
    const wrong: string[] = [];
    for (const file of files) {
      // Whitespace and a trailing comma are stripped on both sides: what
      // has to match is the path expression, not how the call happens to be
      // wrapped across lines. Matching raw text made this fail on
      // 29.08.2026 for a call that was correct and had only been split over
      // three lines by an added argument. Nothing meaningful is lost —
      // neither the expected call nor a route path contains a space.
      const normalise = (s: string) => s.replace(/\s/g, "").replace(/,\)/g, ")");
      const src = normalise(readFileSync(file, "utf8"));
      if (!src.includes("routeAlternates(")) continue; // hand-written, checked below
      const expected = normalise(expectedCall(file));
      if (!src.includes(expected)) wrong.push(`${file.slice(APP.length + 1)} — expected ${expected}`);
    }
    expect(wrong).toEqual([]);
  });

  it("lets a page write its canonical by hand only if it writes a real URL", () => {
    // The ES-only landing pages (the grammar guides, the game pages, the
    // vocabulary category pages) build canonical from SITE_URL themselves
    // because they deliberately publish no /ru alternate. That is allowed —
    // what is not allowed is an `alternates` block with no canonical in it.
    const handwritten = files.filter((f) => !readFileSync(f, "utf8").includes("routeAlternates("));
    expect(handwritten.length).toBeGreaterThan(0);
    for (const file of handwritten) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toMatch(/canonical/);
      expect(src, file).toMatch(/SITE_URL/);
    }
  });

  it("has no route left reading the request path for its canonical", () => {
    // The whole point of the change. getRequestPathname and the x-pathname
    // header it read are both gone; this fails if either comes back.
    for (const file of [...files, join(process.cwd(), "src", "proxy.ts"),
      join(APP, "[lang]", "layout.tsx")]) {
      const src = readFileSync(file, "utf8");
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(code, file).not.toMatch(/getRequestPathname/);
      expect(code, file).not.toMatch(/"x-pathname"/);
    }
  });
});
