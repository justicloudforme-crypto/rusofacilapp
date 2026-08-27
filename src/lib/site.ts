// Canonical production origin, used for absolute URLs in robots.ts,
// sitemap.ts, and JSON-LD. No env var for this existed anywhere in the
// codebase before — other pages that needed an absolute URL read the
// `Host` header instead (see groups/[groupId] and profile pages), which
// doesn't apply here since these all need one fixed, stable origin
// regardless of the request that happens to build them.
export const SITE_URL = "https://rusofacilapp.com";

// BreadcrumbList JSON-LD builder (schema.org) — shared by every page that
// renders a JsonLd breadcrumb block, so the "position" numbering and shape
// stay consistent site-wide. `items` is root-to-leaf order; each `url` must
// be an absolute URL (build with SITE_URL).
export function breadcrumbList(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
