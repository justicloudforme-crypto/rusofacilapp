import { describe, expect, it } from "vitest";
import { SITE_URL, buildAlternates, routeAlternates } from "./site";

// Every distinct path SHAPE the sitemap contains, plus the two hubs and the
// home page. Canonical for all 1892 live URLs is one of these shapes with a
// different slug substituted in, so covering the shapes covers the site.
const SHAPES = [
  "",
  "/courses",
  "/courses/a1",
  "/courses/a1/1",
  "/courses/a1/exam/hito-1",
  "/stories",
  "/stories/cme1abcd0000xyz",
  "/media",
  "/media/kalinka",
  "/glossary",
  "/glossary/sustantivo",
  "/vocabulary",
  "/vocabulary/comida",
  "/word-games",
  "/word-games/WORD_SEARCH/A1/1",
  "/gramatica",
  "/gramatica/alfabeto-ruso",
  "/pricing",
  "/sobre-nosotros",
  "/juegos-para-aprender-ruso",
  "/sopa-de-letras-ruso",
  "/crucigramas-ruso-principiantes",
  "/sopa-de-letras-alfabeto-cirilico",
];

describe("routeAlternates", () => {
  it("produces exactly what the request-header version produced", () => {
    // The guarantee that made this change safe to ship: canonical and
    // hreflang for every live URL must come out byte-identical to what
    // buildAlternates(x-pathname) returned before 28.08.2026, because the
    // canonical of an indexed page changing is an SEO event, not a
    // refactor. buildAlternates itself is untouched — this asserts the new
    // caller feeds it the same string the header used to carry.
    for (const lang of ["es", "ru"]) {
      for (const shape of SHAPES) {
        expect(routeAlternates(lang, shape), `${lang}${shape}`).toEqual(
          buildAlternates(`/${lang}${shape}`),
        );
      }
    }
  });

  it("builds a self-referential canonical plus both locales and x-default", () => {
    expect(routeAlternates("es", "/vocabulary/comida")).toEqual({
      canonical: `${SITE_URL}/es/vocabulary/comida`,
      languages: {
        es: `${SITE_URL}/es/vocabulary/comida`,
        ru: `${SITE_URL}/ru/vocabulary/comida`,
        "x-default": `${SITE_URL}/es/vocabulary/comida`,
      },
    });
  });

  it("canonicalises the home page to the bare locale root", () => {
    expect(routeAlternates("es", "")).toEqual({
      canonical: `${SITE_URL}/es`,
      languages: {
        es: `${SITE_URL}/es`,
        ru: `${SITE_URL}/ru`,
        "x-default": `${SITE_URL}/es`,
      },
    });
  });

  it("returns nothing for a locale that isn't ours", () => {
    // Matches the old behaviour: a path that doesn't start with a known
    // locale produced no alternates at all rather than a wrong one.
    expect(routeAlternates("de", "/courses")).toBeUndefined();
    expect(routeAlternates("", "/courses")).toBeUndefined();
  });

  it("keeps a pre-encoded dynamic segment encoded", () => {
    // The header this replaced carried the raw request path, so a handle
    // with a non-ASCII character arrived percent-encoded; route params
    // arrive decoded. Callers re-encode (see each page), and the result has
    // to match what the header would have produced for the same request.
    const handle = "señor";
    expect(routeAlternates("es", `/u/${encodeURIComponent(handle)}`)).toEqual(
      buildAlternates(`/es/u/${encodeURIComponent(handle)}`),
    );
    const alternates = routeAlternates("es", `/u/${encodeURIComponent(handle)}`) as {
      canonical: string;
    };
    expect(alternates.canonical).toBe(`${SITE_URL}/es/u/se%C3%B1or`);
  });
});
