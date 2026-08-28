import { headers } from "next/headers";
import type { Metadata } from "next";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

// Canonical production origin, used for absolute URLs in robots.ts,
// sitemap.ts, canonical/hreflang metadata, and JSON-LD. No env var for this
// existed anywhere in the codebase before — other pages that needed an
// absolute URL read the `Host` header instead (see groups/[groupId] and
// profile pages), which doesn't apply here since robots.txt/sitemap.xml/
// canonical/JSON-LD must all agree on one fixed, stable origin regardless
// of the request that happens to build them.
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

/** Meta descriptions cap out around 155-160 chars in Google's SERP display
 * — cut at the last word boundary before that so it never ends mid-word,
 * same convention as trimming a card excerpt anywhere else on the web.
 * Shared by every page that builds its own description from a longer
 * body of text (glossary term definitions, lesson grammar intros) rather
 * than a hand-written summary field. */
export function truncateForMeta(text: string, maxLen = 155): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/**
 * `isAccessibleForFree` + `hasPart` fields (schema.org's documented paywall
 * markup: https://developers.google.com/search/docs/appearance/structured-
 * data/paywalled-content) to merge into a page's own JSON-LD object.
 *
 * Every paywalled page on this site (stories, media, non-intro lessons)
 * server-truncates the actual restricted content rather than sending it to
 * the browser and hiding it with CSS (see each page's own comment on why —
 * paragraph 2+ of a locked story, the vocabulary/exercises of a locked
 * lesson, etc. are simply never in the HTML at all for a non-entitled
 * visitor). That means there is no DOM node representing the restricted
 * content itself to point `hasPart.cssSelector` at — Google's own example
 * assumes the opposite (a real region of the page that's visually hidden).
 * The next best, still-accurate anchor is the paywall/upsell block that
 * DOES render in its place — it's the one element on the page that
 * genuinely marks "the paid part starts here" from the reader's
 * perspective, so `lockSelector` should be the CSS class already on that
 * block's wrapper element, e.g. ".paywall-lock".
 */
export function paywallJsonLd(isFullyOpen: boolean, lockSelector: string) {
  if (isFullyOpen) return { isAccessibleForFree: true };
  return {
    isAccessibleForFree: false,
    hasPart: {
      "@type": "WebPageElement",
      isAccessibleForFree: false,
      cssSelector: lockSelector,
    },
  };
}

/** Organization JSON-LD `description` per locale. Unlike `name` (a brand
 * name, never translated — same convention as WhyLearnRussianBlurb.tsx
 * staying Spanish-only for its own reason), this is ordinary descriptive
 * text: a /ru page showing a Spanish sentence here would be the same kind
 * of locale mismatch Google's own structured-data guidance warns against
 * (markup should reflect the page's actual content/language, not a
 * different one) — so it's keyed by locale like ABOUT_CONTENT rather than
 * fixed to one language regardless of where it renders. */
const ORGANIZATION_DESCRIPTION: Record<Locale, string> = {
  es: "RusoFácilapp es una plataforma web para aprender ruso pensada para hispanohablantes, con lecciones estructuradas de los niveles A1 a B2, historias de lectura, vocabulario, juegos de palabras y una biblioteca de audio y video.",
  ru: "RusoFácilapp — веб-платформа для изучения русского языка, созданная для испаноговорящих: структурированные уроки уровней A1–B2, рассказы для чтения, словарь, игры со словами и библиотека аудио и видео.",
};

/** Organization JSON-LD — the fix for AI Overviews/knowledge panels
 * describing a different, unrelated app under this same search term (see
 * PROGRESS.md's brand-identity entry). No `sameAs` field: the only
 * existing external link is a private Telegram group invite (not a
 * public brand profile), and neither app store listing is live yet (see
 * src/app/[lang]/download/page.tsx's own comment) — adding either would
 * assert an identity link that doesn't genuinely exist yet. Add `sameAs`
 * here once a real public profile (app store listing, public social
 * account) exists. */
export function organizationJsonLd(lang: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "RusoFácilapp",
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
    description: ORGANIZATION_DESCRIPTION[lang],
  };
}

/** WebSite JSON-LD, paired with organizationJsonLd() via `publisher`. No
 * `potentialAction: SearchAction` — the only search UI on the site
 * (GlobalSearch.tsx) is a client-side filter over a hardcoded list of nav
 * destinations, not a real query-param route Google could link to (see
 * that component's own comment on what a real content search would
 * need). Claiming a SearchAction against a URL that doesn't actually
 * search anything would be the same kind of dishonest markup this
 * project has avoided elsewhere (see paywallJsonLd's own reasoning). */
export function websiteJsonLd(lang: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "RusoFácilapp",
    url: SITE_URL,
    publisher: organizationJsonLd(lang),
  };
}
