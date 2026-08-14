/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

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
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
