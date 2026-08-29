/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { NetworkFirst, Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig, SerwistPlugin } from "serwist";
import { buildFingerprint, pageCacheNames, staleCacheNames } from "@/lib/sw-cache-names";

// The `/// <reference lib="webworker" />` above scopes this file's ambient
// `self` type to ServiceWorkerGlobalScope without touching the project-wide
// tsconfig `lib` (which needs "dom", used everywhere else) — the standard
// pattern for a single service-worker file living inside an otherwise
// browser-DOM TypeScript project.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// defaultCache (from @serwist/next/worker) already implements the
// NetworkFirst-for-pages / CacheFirst-for-static-assets split from the
// mobile-architecture plan — reusing it instead of hand-rolling route
// matchers, since content now lives in the DB (see FlashcardCard/Idiom/
// Story models) and can change between admin edits, so pages/API routes
// must not go stale behind an aggressive cache.
const precacheEntries = self.__SW_MANIFEST ?? [];

// Debt 14, confirmed by experiment: a returning visitor whose network fails
// after a deploy was served the PRE-DEPLOY page at HTTP 200, out of
// defaultCache's fixed-name "pages" / "pages-rsc" / "pages-rsc-prefetch"
// caches (24h expiry, NetworkFirst). Scoping those three names to the build
// means a new deploy cannot read the old build's entries at all. See
// src/lib/sw-cache-names.ts for the measurement and the reasoning.
//
// Only these three are re-scoped. Everything else in defaultCache is keyed
// by content-hashed URLs (/_next/static/...) or is genuinely
// build-independent (fonts, images, audio), so scoping those would throw
// away a working cache on every deploy for no benefit.
const FINGERPRINT = buildFingerprint(precacheEntries as Array<string | { url: string; revision?: string | null }>);
const CACHES = pageCacheNames(FINGERPRINT);

const REBUILT: Record<string, string> = {
  "pages-rsc-prefetch": CACHES.rscPrefetch,
  "pages-rsc": CACHES.rsc,
  pages: CACHES.html,
  // "others" is the one that actually held the stale document — see
  // pageCacheNames() for why defaultCache's "pages" route never matches a
  // navigation and everything falls through to this catch-all.
  others: CACHES.others,
};

const runtimeCaching = defaultCache.map((route) => {
  const current = (route.handler as { cacheName?: string } | undefined)?.cacheName;
  const renamed = current ? REBUILT[current] : undefined;
  if (!renamed) return route;
  // Rebuilt rather than mutated: a Strategy reads its own cacheName in
  // several places and Serwist gives no supported way to change it after
  // construction. The options mirror @serwist/next's own (NetworkFirst, and
  // the plugins the strategy was built with) so behaviour is unchanged apart
  // from where the entries live.
  return {
    matcher: route.matcher,
    handler: new NetworkFirst({
      cacheName: renamed,
      plugins: (route.handler as { plugins?: SerwistPlugin[] }).plugins,
    }),
  };
});

// Whatever the previous build (or the pre-fix, fixed-name config) left
// behind is dead weight the moment this worker activates.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const existing = await caches.keys();
      await Promise.all(staleCacheNames(existing, FINGERPRINT).map((name) => caches.delete(name)));
    })()
  );
});

const serwist = new Serwist({
  // `precacheEntries`, not `self.__SW_MANIFEST` again: Serwist's webpack
  // plugin substitutes the manifest at the literal occurrence of that
  // identifier and refuses to build if it appears more than once
  // ("Multiple instances of self.__SW_MANIFEST were found in your SW
  // source"). The single read is at the top of this file.
  precacheEntries,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  // When a page navigation isn't in the cache and the network fetch fails
  // (offline, DNS down, etc.), serve the precached offline.html instead of
  // letting the browser show its own generic error screen. Only matches
  // document (HTML page) requests — a failed API/asset fetch still just
  // fails normally, since offline.html has no useful fallback data for
  // those. Deliberately a static public/ file, not a Next page — see
  // public/offline.html's own comment for why a real app route broke here.
  fallbacks: {
    entries: [{ url: "/offline.html", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();
