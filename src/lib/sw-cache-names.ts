/**
 * Build-scoped names for the service worker's page and RSC caches.
 *
 * Debt 14, confirmed by experiment on 29.08.2026 and not by reading the
 * config. Two production builds were served on the same origin in turn, with
 * one persistent Chromium profile playing a returning visitor. Primed on
 * build A, then build B "deployed", then the server stopped so the visitor's
 * network genuinely failed:
 *
 *     returning visitor, server unreachable, after the deploy:
 *        status=200  build served=A
 *        control (same-origin, never-seen URL): failed — server unreachable
 *
 * The visitor got the PRE-DEPLOY page, at HTTP 200, out of the service
 * worker's cache. @serwist/next's defaultCache names those caches "pages",
 * "pages-rsc" and "pages-rsc-prefetch" — fixed strings with a 24-hour
 * expiry and a NetworkFirst handler. NetworkFirst reaches its cache only
 * when the fetch fails, so this is exactly and only the flaky-network case;
 * but in that case a fix that shipped an hour ago is invisible for up to a
 * day, which is what the incident made worth caring about.
 *
 * The fix is to put the build into the cache name, so a new deploy simply
 * cannot read the previous build's entries. It cannot make an offline
 * visitor worse off than the offline fallback (`offline.html`, precached),
 * and it means "the version you are looking at" is always a version this
 * build produced.
 *
 * There is no build id available inside the worker — Next does not expose
 * one to it — but there is something better: `self.__SW_MANIFEST`, the
 * precache manifest, which lists every static asset with its revision hash
 * and therefore differs whenever the build's output differs. Fingerprinting
 * it gives a value that is stable across restarts of the same build and
 * different across builds, which is the entire requirement.
 */

/** Entries as Serwist hands them over: either a bare URL or {url, revision}. */
export type PrecacheEntryLike = string | { url: string; revision?: string | null };

/**
 * FNV-1a over the manifest. Not a security hash — it only has to change when
 * the build changes and stay put when it does not, and it has to run in a
 * service worker with no dependencies and no async crypto call at startup.
 */
export function buildFingerprint(entries: readonly PrecacheEntryLike[]): string {
  let hash = 0x811c9dc5;
  const feed = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
  };
  // Sorted, so a reordered-but-identical manifest is the same build. Webpack
  // does not promise manifest order, and a name that flipped between two
  // values on the same build would throw away the cache on every other load.
  const parts = entries
    .map((entry) => (typeof entry === "string" ? entry : `${entry.url}|${entry.revision ?? ""}`))
    .sort();
  feed(String(parts.length));
  for (const part of parts) feed(part);
  return (hash >>> 0).toString(36);
}

/** The prefix every build-scoped cache shares, so old ones can be found and
 * deleted on activate without touching Serwist's own precache. */
export const PAGE_CACHE_PREFIX = "rf-pages";

/**
 * Note which four these are, and especially the fourth.
 *
 * The obvious three are @serwist/next's "pages", "pages-rsc" and
 * "pages-rsc-prefetch". But the experiment showed the stale HTML document
 * coming out of a cache called **"others"**, and inspecting the caches of a
 * primed profile showed `pages` did not exist at all:
 *
 *     caches: { serwist-precache-v2-…: 353, others: 1, apis: 3,
 *               pages-rsc-prefetch: 10 }
 *     others: /es/courses/a1/1
 *
 * The reason is in defaultCache's own matcher: the "pages" route requires
 * `request.headers.get("Content-Type")?.includes("text/html")` — a
 * *request* Content-Type, which a navigation never sends (that header
 * describes a body, and GET navigations have none). So the "pages" route is
 * effectively unreachable and every navigation document falls through to the
 * catch-all "others" route. Scoping only the three obviously-named caches
 * would have left the measured defect exactly where it was, while looking
 * like a fix.
 */
export function pageCacheNames(fingerprint: string) {
  return {
    html: `${PAGE_CACHE_PREFIX}-${fingerprint}`,
    rsc: `${PAGE_CACHE_PREFIX}-rsc-${fingerprint}`,
    rscPrefetch: `${PAGE_CACHE_PREFIX}-rsc-prefetch-${fingerprint}`,
    others: `${PAGE_CACHE_PREFIX}-others-${fingerprint}`,
  };
}

/**
 * Caches to delete on activate: everything this app named, from any build
 * that is not the current one, plus the three fixed-name caches
 * @serwist/next used before this change (a returning visitor still has
 * those, holding pre-fix pages, and nothing else would ever remove them).
 */
export function staleCacheNames(existing: readonly string[], fingerprint: string): string[] {
  const keep = new Set(Object.values(pageCacheNames(fingerprint)));
  const legacy = new Set(["pages", "pages-rsc", "pages-rsc-prefetch", "others"]);
  return existing.filter((name) => legacy.has(name) || (name.startsWith(PAGE_CACHE_PREFIX) && !keep.has(name)));
}
