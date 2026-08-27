// Canonical production origin, used for absolute URLs in robots.ts,
// sitemap.ts, and any future canonical/hreflang metadata. No env var for
// this existed anywhere in the codebase before — other pages that needed
// an absolute URL read the `Host` header instead (see groups/[groupId] and
// profile pages), which doesn't apply here since robots.txt/sitemap.xml
// must list one fixed, stable origin regardless of the request that
// happens to build them.
export const SITE_URL = "https://rusofacilapp.com";
