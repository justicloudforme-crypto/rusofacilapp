import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAGE_CACHE_PREFIX, buildFingerprint, pageCacheNames, staleCacheNames } from "./sw-cache-names";

/**
 * The service worker's page and RSC caches must be scoped to the build.
 *
 * Debt 14, confirmed by experiment (see sw-cache-names.ts for the run): with
 * @serwist/next's fixed cache names, a returning visitor whose network failed
 * after a deploy was served the PRE-DEPLOY page at HTTP 200 out of the
 * service worker's cache — for up to the 24-hour expiry. After incident №1
 * that is the difference between "the fix shipped" and "the fix reached the
 * people who were hit".
 */

describe("buildFingerprint", () => {
  const manifestA = [{ url: "/_next/static/a.js", revision: "111" }, "/offline.html"];
  const manifestB = [{ url: "/_next/static/a.js", revision: "222" }, "/offline.html"];

  it("is stable for the same build", () => {
    expect(buildFingerprint(manifestA)).toBe(buildFingerprint(manifestA));
    // Order must not matter: webpack does not promise manifest order, and a
    // name that flipped between two values on one build would discard the
    // cache on every other page load — worse than the bug being fixed.
    expect(buildFingerprint([...manifestA].reverse())).toBe(buildFingerprint(manifestA));
  });

  it("changes when the build changes", () => {
    // A revision bump is what a real deploy produces.
    expect(buildFingerprint(manifestB)).not.toBe(buildFingerprint(manifestA));
    // …and so is an added or removed asset.
    expect(buildFingerprint([...manifestA, "/new.js"])).not.toBe(buildFingerprint(manifestA));
    // A same-length manifest with different content must also differ, or a
    // length-only fingerprint would pass every test above.
    expect(buildFingerprint(["/a.js", "/b.js"])).not.toBe(buildFingerprint(["/a.js", "/c.js"]));
  });

  it("survives an empty manifest instead of throwing", () => {
    // __SW_MANIFEST is typed as possibly undefined; a worker that throws at
    // startup registers nothing at all.
    expect(typeof buildFingerprint([])).toBe("string");
    expect(buildFingerprint([]).length).toBeGreaterThan(0);
  });
});

describe("cache names", () => {
  it("carry the fingerprint, so two builds cannot share entries", () => {
    const a = pageCacheNames("aaa");
    const b = pageCacheNames("bbb");
    expect(new Set([...Object.values(a), ...Object.values(b)]).size).toBe(8);
    for (const name of Object.values(a)) expect(name).toContain("aaa");
  });

  it("positive control: the names this replaces are NOT build-scoped", () => {
    // @serwist/next's own defaults, verified against the installed package.
    const worker = readFileSync(
      join(process.cwd(), "node_modules", "@serwist", "next", "dist", "index.worker.mjs"),
      "utf8"
    );
    expect(worker).toContain('rscPrefetch: "pages-rsc-prefetch"');
    expect(worker).toContain('rsc: "pages-rsc"');
    expect(worker).toContain('html: "pages"');
    // And the catch-all that actually receives navigations — the cache the
    // experiment caught serving a pre-deploy document.
    expect(worker).toContain('cacheName: "others"');
    // The "pages" route is unreachable for navigations: it keys off a
    // REQUEST Content-Type, which a GET navigation never sends.
    expect(worker).toMatch(/request\.headers\.get\("Content-Type"\)/);
    // Those three are constants: identical across every build, which is the
    // whole defect. Our names for the same three are not.
    for (const name of Object.values(pageCacheNames("x"))) {
      expect(["pages", "pages-rsc", "pages-rsc-prefetch", "others"]).not.toContain(name);
    }
  });
});

describe("staleCacheNames", () => {
  const current = "now";

  it("deletes the previous build's caches and keeps this build's", () => {
    const existing = [...Object.values(pageCacheNames("old")), ...Object.values(pageCacheNames(current))];
    const doomed = staleCacheNames(existing, current);
    expect(doomed.sort()).toEqual(Object.values(pageCacheNames("old")).sort());
  });

  it("also deletes the fixed-name caches a returning visitor already has", () => {
    // Someone who visited before this change still holds "pages" etc., full
    // of pre-fix documents. Nothing else would ever remove them, so a fix
    // that only renamed the caches would leave the old ones untouched
    // forever — and NetworkFirst would no longer refresh them either.
    expect(staleCacheNames(["pages", "pages-rsc", "pages-rsc-prefetch", "others"], current).sort()).toEqual(
      ["others", "pages", "pages-rsc", "pages-rsc-prefetch"]
    );
  });

  it("never touches caches this app did not name", () => {
    // Deleting Serwist's own precache would re-download every asset on each
    // activate, and deleting the shared ones would undo the point of them.
    const others = ["serwist-precache-v2-https://rusofacilapp.com/", "apis", "next-static-js-assets", "static-image-assets"];
    expect(staleCacheNames(others, current)).toEqual([]);
  });

  it("positive control: given only current-build caches it deletes nothing", () => {
    // …so the assertions above are not just 'this function returns []'.
    expect(staleCacheNames(Object.values(pageCacheNames(current)), current)).toEqual([]);
    expect(staleCacheNames([`${PAGE_CACHE_PREFIX}-somethingelse`], current)).toEqual([`${PAGE_CACHE_PREFIX}-somethingelse`]);
  });
});

describe("the worker actually uses this", () => {
  const sw = readFileSync(join(process.cwd(), "src", "app", "sw.ts"), "utf8");

  it("scopes the three page caches and cleans up on activate", () => {
    // Without this the module above could be perfect and unreferenced.
    expect(sw).toContain("pageCacheNames");
    expect(sw).toContain("buildFingerprint");
    expect(sw).toContain("staleCacheNames");
    expect(sw).toMatch(/addEventListener\("activate"/);
    // The rebuilt routes must replace defaultCache, not sit beside it.
    expect(sw).toContain("runtimeCaching,");
    expect(sw).not.toMatch(/runtimeCaching:\s*defaultCache/);
  });
});
