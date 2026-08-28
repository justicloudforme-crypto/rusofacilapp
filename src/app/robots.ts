import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Next.js Metadata Route convention — served automatically at /robots.txt,
// same pattern as manifest.ts. Lives outside `[lang]` so it isn't subject to
// locale-prefix redirecting (see proxy.ts's matcher, which excludes this
// path by extension).
// The 10 free-trial word-game puzzles (5 WORD_SEARCH + 5 CROSSWORD, level
// A1, sequence 1-5 — see FREE_TRIAL_LIMITS.wordGamePuzzlesPerLevel and
// isFreeWordGamePuzzle in src/lib/entitlement.ts) are real, fully playable
// pages, same class of exception as the 2 free stories/7 free media items
// — worth keeping crawlable even though the other 2990 puzzles below are
// disallowed. `$` anchors the end of the path so "/A1/1$" matches only
// sequence 1, not 10/15/etc.
const FREE_WORD_GAME_ALLOW = ["WORD_SEARCH", "CROSSWORD"].flatMap((type) =>
  Array.from({ length: 5 }, (_, i) => `/*/word-games/${type}/A1/${i + 1}$`)
);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", ...FREE_WORD_GAME_ALLOW],
        disallow: [
          "/admin",
          "/*/admin",
          "/account",
          "/*/account",
          "/profile",
          "/*/profile",
          "/login",
          "/*/login",
          "/register",
          "/*/register",
          "/forgot-password",
          "/*/forgot-password",
          "/reset-password",
          "/*/reset-password",
          "/confirm-delete-account",
          "/*/confirm-delete-account",
          "/groups",
          "/*/groups",
          "/styleguide",
          "/*/styleguide",
          "/video-lesson-demo",
          "/*/video-lesson-demo",
          "/api/",
          // Word-game puzzles and milestone exams all redirect an
          // anonymous visitor (and Googlebot) to /pricing except the 10
          // free puzzles allowed above — no SEO value in letting a
          // crawler spend budget discovering ~6000 redirect responses
          // (see PROGRESS.md's crawl-budget audit, 2026-08-28).
          "/word-games/",
          "/*/word-games/",
          "/courses/*/exam/",
          "/*/courses/*/exam/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
