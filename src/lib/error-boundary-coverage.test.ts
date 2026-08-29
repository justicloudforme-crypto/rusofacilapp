import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every page route must have an error boundary between it and
 * src/app/global-error.tsx.
 *
 * The incident (№1, 29.08.2026): a signed-in user on mobile Chrome got
 * "Something went wrong" on /es/courses — a bare English <h1> with no
 * header, no locale and no way back. That string exists in exactly one
 * file, src/app/global-error.tsx, which App Router uses only after an error
 * has escalated past every boundary in between. There were none: five
 * subtrees had an error.tsx (media, profile, stories, vocabulary,
 * word-games) and the other 55 of 64 page routes had nothing, /courses —
 * the core product surface — among them.
 *
 * Measured on a local production build before the fix, with a failure
 * planted under /courses and reached by a client-side navigation: the
 * document was 200, the page said "Something went wrong", the header was
 * gone and there was no retry. That is the reported symptom exactly. With
 * [lang]/error.tsx in place, the same failure renders the bilingual panel
 * with the header intact and a working Reintentar. See PROGRESS.md 7.31.
 *
 * Note what this test does NOT claim: it does not say the site cannot
 * throw. It says a throw can no longer cost the user the whole document.
 */

const APP = join(process.cwd(), "src", "app");

/** Route segment directories, relative to src/app, that contain a page. */
function routesWithPages(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (!statSync(full).isDirectory()) continue;
      // Not a route: colocated component/util folders never hold a page.
      walk(full);
    }
    if (readdirSync(dir).includes("page.tsx")) out.push(relative(APP, dir));
  };
  walk(APP);
  return out.sort();
}

/**
 * Whether some segment at or above `route` declares an error.tsx.
 *
 * Walks the segment chain rather than doing a string prefix match: "/courses"
 * must not be treated as covered by a boundary at "/coursesXYZ", and a prefix
 * test on raw paths would say it is.
 */
function boundaryFor(route: string, boundaries: Set<string>): string | null {
  const parts = route === "" ? [] : route.split(sep);
  for (let i = parts.length; i >= 0; i--) {
    const candidate = parts.slice(0, i).join(sep);
    if (boundaries.has(candidate)) return candidate || "(app root)";
  }
  return null;
}

function boundarySegments(): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
    }
    if (readdirSync(dir).includes("error.tsx")) out.add(relative(APP, dir));
  };
  walk(APP);
  return out;
}

describe("error boundary coverage", () => {
  const routes = routesWithPages();
  const boundaries = boundarySegments();

  it("finds the routes and the boundaries at all", () => {
    // Without this, an empty scan would make every assertion below pass —
    // the failure mode PROGRESS.md 4.1 exists to prevent.
    expect(routes.length).toBeGreaterThan(50);
    expect(routes).toContain(join("[lang]", "courses"));
    expect(boundaries.has("[lang]")).toBe(true);
  });

  it("every page route has a boundary above it", () => {
    const uncovered = routes.filter((r) => boundaryFor(r, boundaries) === null);
    expect(uncovered).toEqual([]);
  });

  it("positive control: a route with no boundary above it is reported", () => {
    // The state this repo was actually in until 29.08.2026 — only the five
    // leaf subtrees guarded, nothing at [lang].
    const asItWas = new Set([
      join("[lang]", "media"),
      join("[lang]", "profile"),
      join("[lang]", "stories"),
      join("[lang]", "vocabulary"),
      join("[lang]", "word-games"),
    ]);
    const uncovered = routes.filter((r) => boundaryFor(r, asItWas) === null);
    expect(uncovered).toContain(join("[lang]", "courses"));
    expect(uncovered.length).toBeGreaterThan(50);
  });

  it("positive control: a sibling with a shared name prefix does not count as cover", () => {
    // A plain `startsWith` on paths would call this covered. It is not:
    // /coursesXYZ is a different segment, not an ancestor of /courses.
    expect(boundaryFor(join("[lang]", "courses"), new Set([join("[lang]", "coursesXYZ")]))).toBe(null);
    expect(boundaryFor(join("[lang]", "courses"), new Set([join("[lang]", "courses")]))).not.toBe(null);
  });

  it("the boundaries offer a way out, not just a message", () => {
    // A boundary that renders text and nothing else leaves the user exactly
    // as stuck as global-error did — the point of the fix was recovery.
    for (const segment of boundaries) {
      const source = readFileSync(join(APP, segment, "error.tsx"), "utf8");
      expect(source, `${segment}/error.tsx must call reset()`).toMatch(/reset\(\)/);
      expect(source, `${segment}/error.tsx must report to Sentry`).toMatch(/captureException/);
    }
  });

  it("global-error is still reachable only as a last resort, and is no longer a dead end", () => {
    const source = readFileSync(join(APP, "global-error.tsx"), "utf8");
    expect(source).toMatch(/reset\(\)/);
    expect(source).toMatch(/captureException/);
    // It renders outside [lang]/layout.tsx, which is what imports
    // globals.css — Tailwind classes are inert here, so the styling has to
    // be inline. A future edit that "tidies" this into className would
    // silently return the page to an unstyled wall of text.
    expect(source).toMatch(/style=\{\{/);
    // The English-only wall of text that the incident reported.
    expect(source).not.toMatch(/<h1>Something went wrong<\/h1>/);
  });
});
