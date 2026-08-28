import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { flashcardLevels } from "@/lib/flashcards/types";
import { FREE_TRIAL_LIMITS } from "@/lib/entitlement";

// Next.js Metadata Route convention — served automatically at /robots.txt,
// same pattern as manifest.ts. Lives outside `[lang]` so it isn't subject to
// locale-prefix redirecting (see proxy.ts's matcher, which excludes this
// path by extension).
// The 80 free-trial word-game puzzles (2 types x every level except C1 x
// FREE_TRIAL_LIMITS.wordGamePuzzlesPerLevel — see isFreeWordGamePuzzle in
// src/lib/entitlement.ts, raised from 10 to 80 on 2026-08-28) are real,
// fully playable pages, same class of exception as the 2 free stories/7
// free media items — worth keeping crawlable even though the remaining
// ~2920 puzzles below are disallowed. Derived from the same constants
// isFreeWordGamePuzzle itself reads, rather than a separately maintained
// URL list, so this can't drift out of sync with the actual free-tier
// rule. `$` anchors the end of the path so e.g. "/A1/1$" matches only
// sequence 1, not 10/15/etc.
const FREE_WORD_GAME_ALLOW = flashcardLevels
  .filter((level) => level !== "C1")
  .flatMap((level) =>
    ["WORD_SEARCH", "CROSSWORD"].flatMap((type) =>
      Array.from({ length: FREE_TRIAL_LIMITS.wordGamePuzzlesPerLevel }, (_, i) => `/*/word-games/${type}/${level}/${i + 1}$`)
    )
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
          // anonymous visitor (and Googlebot) to /pricing except the 80
          // free puzzles allowed above — no SEO value in letting a
          // crawler spend budget discovering the remaining ~2920 redirect
          // responses (see PROGRESS.md's crawl-budget audit, 2026-08-28).
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
