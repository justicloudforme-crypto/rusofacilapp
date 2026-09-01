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

/**
 * canonical + hreflang for one route, built from that route's OWN params.
 *
 * This replaced a request-header lookup (`getRequestPathname()` reading the
 * `x-pathname` header that proxy.ts used to set) on 28.08.2026. The header
 * version let `[lang]/layout.tsx` produce canonical for all ~1892 URLs from
 * a single place, at the cost of calling `headers()` inside the layout's
 * generateMetadata — which opts the entire route tree out of static
 * rendering. It was one of three such dependencies in that layout; the
 * other two (`getThemePreference()` and `getCurrentUser()`, both cookie
 * reads) are genuine product features and stay. Removing this one alone
 * does NOT make the site static — see PROGRESS.md's dynamic-render
 * diagnosis — it just removes the one dependency that had a clean
 * alternative, so less stands in the way later.
 *
 * `path` is the part after the locale prefix, with a leading slash and no
 * trailing one: "/vocabulary/comida", "/stories/abc123", "" for the home
 * page. Dynamic segments must be passed through `encodeURIComponent` by
 * the caller, because the header this replaces carried the raw (encoded)
 * request path while route params arrive decoded — for an ASCII slug the
 * two are identical, for a handle with an accent they are not.
 *
 * Output is byte-for-byte what buildAlternates() produced for the same URL;
 * `site.test.ts` asserts that over every path shape in the sitemap.
 */
export function routeAlternates(lang: string, path: string): Metadata["alternates"] | undefined {
  return buildAlternates(`/${lang}${path}`);
}

// Builds { canonical, languages } for the given locale-prefixed pathname
// (e.g. "/es/stories/abc" or just "/es" for the homepage) — canonical
// strips nothing else (the caller passes a query-free path), and every
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
 * Google truncates a SERP title on pixel width, not characters; ~70 is the
 * safe ceiling for Spanish and Russian alike. The fixed " | RusoFácilapp"
 * suffix spends 15 of them.
 *
 * Measured across the whole live sitemap on 29.08.2026: 739 of 1892 URLs
 * had a title over this, median 110 characters on the media pages and 159
 * at the worst. Those titles were being cut mid-phrase in the result
 * snippet — often mid-parenthesis, sometimes before the level ever
 * appeared.
 */
export const TITLE_MAX = 70;

/** Cuts a title down to `max` while keeping it readable.
 *
 * Two steps, in order. First drop a trailing parenthetical the budget
 * cannot hold: these titles are written as "Name (what it is)", so the part
 * before the bracket is a complete phrase on its own and cutting there
 * reads like a title rather than like an accident. Only then fall back to a
 * word-boundary cut with an ellipsis.
 *
 * Deliberately NOT cutting at the first ":" or "—": measured on the real
 * media titles, that collapses "Verbos de movimiento con prefijos: salir"
 * and "…: repaso" into the same string, and two pages with one title is
 * the problem this whole change is fixing. */
export function shortenTitle(title: string, max = TITLE_MAX): string {
  if (title.length <= max) return title;
  const paren = title.indexOf(" (");
  if (paren > 0 && paren <= max) return title.slice(0, paren);
  const cut = title.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:—-]+$/, "") + "…";
}

/**
 * Builds "<base> — <qualifier> | RusoFácilapp" and gives up the least
 * valuable part first when it doesn't fit: the brand suffix, then the long
 * qualifier for a short one, then the qualifier entirely, then (only then)
 * length from the base itself.
 *
 * The order encodes what each part is worth in a search result. The base is
 * the thing someone searched for — a song title, a story title, a lesson
 * name. The qualifier ("cuento en ruso (A1)") says what kind of page it is.
 * The brand is the same 15 characters on all 1892 pages.
 *
 * `shortQualifier` was added on 30.08.2026 after the live crawl caught a
 * collision this function had CREATED: /es/courses/a2/23 and
 * /es/media/video-pronombres-indefinidos-to have the same base ("Pronombres
 * indefinidos: кто-то, что-то, какой-то"), both overflowed with their long
 * qualifier, both fell through to "base | brand", and two different pages
 * ended up announcing themselves identically. The grammar videos mirror the
 * lesson topics by design, so that overlap is systematic, not a one-off —
 * which makes the qualifier the one part that must survive. Measured over
 * every non-frozen title in both locales: 0 collisions afterwards, and only
 * 69 titles change, each of them gaining the level it had lost.
 */
export function fitTitle(
  base: string,
  qualifier: string,
  shortQualifier?: string,
  max = TITLE_MAX,
): string {
  const brand = " | RusoFácilapp";
  // Second pass runs on the base with its trailing parenthetical dropped —
  // shortening the base can free enough room to put the qualifier back,
  // which is worth more than the bracketed aside it replaces.
  for (const candidate of [base, shortenTitle(base, max)]) {
    const full = `${candidate} — ${qualifier}${brand}`;
    if (full.length <= max) return full;
    const noBrand = `${candidate} — ${qualifier}`;
    if (noBrand.length <= max) return noBrand;
    if (shortQualifier) {
      const short = `${candidate} — ${shortQualifier}`;
      if (short.length <= max) return short;
    }
    const noQualifier = `${candidate}${brand}`;
    if (noQualifier.length <= max) return noQualifier;
    if (candidate.length <= max) return candidate;
  }
  return shortenTitle(shortenTitle(base, max), max);
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
  es: "RusoFácilapp es una plataforma web para aprender ruso pensada para hispanohablantes: un curso estructurado de los niveles A1 a B2, y vocabulario, cuentos y juegos de palabras que llegan hasta el nivel C1, además de una biblioteca de audio y vídeo.",
  ru: "RusoFácilapp — веб-платформа для изучения русского языка, созданная для испаноговорящих: структурированный курс уровней A1–B2, а словарь, рассказы и игры со словами — до уровня C1, плюс библиотека аудио и видео.",
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
