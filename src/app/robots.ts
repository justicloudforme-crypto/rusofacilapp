import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { flashcardLevels } from "@/lib/flashcards/types";
import { freeSequencesFor } from "@/lib/word-games/free-tier";

// Next.js Metadata Route convention — served automatically at /robots.txt,
// same pattern as manifest.ts. Lives outside `[lang]` so it isn't subject to
// locale-prefix redirecting (see proxy.ts's matcher, which excludes this
// path by extension).
// The free-trial word-game puzzles are real, fully playable pages, same
// class of exception as the 2 free stories/7 free media items — worth
// keeping crawlable even though the remaining ~2920 puzzles below are
// disallowed. `$` anchors the end of the path so e.g. "/A1/1$" matches
// only sequence 1, not 10/15/etc.
//
// 05.09.2026: раньше здесь стояло `Array.from({ length: LIMIT })` и
// отдельный отсев старшего уровня — то есть правило бесплатности,
// пересказанное своими словами рядом с функцией, которая его знает.
// Теперь номера спрашиваются у самого правила (freeSequencesFor), и
// старший уровень отваливается сам: бесплатных номеров у него нет.
const FREE_WORD_GAME_ALLOW = flashcardLevels.flatMap((level) =>
  ["WORD_SEARCH", "CROSSWORD"].flatMap((type) =>
    freeSequencesFor(type, level).map((sequence) => `/*/word-games/${type}/${level}/${sequence}$`),
  ),
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
