import { headers } from "next/headers";
import type { Metadata } from "next";
import { defaultLocale, locales } from "@/i18n/config";

// Canonical production origin, used for absolute URLs in robots.ts,
// sitemap.ts, and canonical/hreflang metadata. No env var for this existed
// anywhere in the codebase before — other pages that needed an absolute URL
// read the `Host` header instead (see groups/[groupId] and profile pages),
// which doesn't apply here since robots.txt/sitemap.xml/canonical must all
// agree on one fixed, stable origin regardless of the request that happens
// to build them.
export const SITE_URL = "https://rusofacilapp.com";

// Set by proxy.ts on every request that reaches a page (see its own
// comment) so canonical/hreflang can be computed from the real request path
// without every route needing its own generateMetadata. Absent outside a
// request (e.g. a build-time-only call) — callers must handle null.
export async function getRequestPathname(): Promise<string | null> {
  const h = await headers();
  return h.get("x-pathname");
}

// Builds { canonical, languages } for the given locale-prefixed pathname
// (as reported by proxy.ts's x-pathname header, e.g. "/es/stories/abc" or
// just "/es" for the homepage) — canonical strips nothing else (the
// pathname already excludes the query string, see proxy.ts), and every
// locale gets an alternate link plus x-default pointing at defaultLocale,
// per Google's hreflang requirements. Returns undefined when the pathname
// isn't available (falls back to no alternates rather than a wrong one).
export function buildAlternates(pathname: string | null): Metadata["alternates"] | undefined {
  if (!pathname) return undefined;
  const matchedLocale = locales.find((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
  if (!matchedLocale) return undefined;
  const path = pathname.slice(`/${matchedLocale}`.length);

  const languages: Record<string, string> = {};
  for (const locale of locales) languages[locale] = `${SITE_URL}/${locale}${path}`;
  languages["x-default"] = `${SITE_URL}/${defaultLocale}${path}`;

  return {
    canonical: `${SITE_URL}/${matchedLocale}${path}`,
    languages,
  };
}
