import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { levelSlugs, lessonSlugsFor } from "@/lib/courses";
import { flashcardLevels } from "@/lib/flashcards/types";
import { freeSequencesFor, freeWordGameWhere } from "@/lib/word-games/free-tier";
import { db } from "@/lib/db";
import { getAllMedia } from "@/lib/media/data";
import { SITE_URL } from "@/lib/site";
import { VOCABULARY_CATEGORY_PAGES } from "@/lib/vocabulary-categories";
import { TOPIC_LANDING_PATHS } from "@/lib/word-games/topic-landings";

// Next.js Metadata Route convention — served automatically at /sitemap.xml,
// same pattern as manifest.ts/robots.ts. Lives outside `[lang]` so it isn't
// subject to locale-prefix redirecting (see proxy.ts's matcher).
//
// Forced dynamic (rendered per-request, never at build time): without this,
// Next.js treats sitemap.ts as static-by-default (no Request-time API used
// inside it) and tries to pre-render /sitemap.xml during `next build` —
// which runs with no TURSO_DATABASE_URL on Vercel (see
// prisma/ensure-schema-sync.ts's own build-time skip for the same reason),
// so db.story.findMany() below hit a real prod deploy failure: "no such
// table: main.Story" against the empty local build-time SQLite fallback.
// The production database is only ever reachable at request time, not
// build time, in this project's setup.
export const dynamic = "force-dynamic";
//
// Also: only lists routes a signed-out visitor (and so a crawler) can actually
// read: static public pages, all stories (non-premium ones show the full
// text, premium ones show a snippet + paywall — both are legitimate
// indexable pages), all media items (same free/gated split), the course
// level listings, and — since 2026-08-28 — every individual lesson page:
// each one now shows its real grammar explanation to every visitor
// regardless of subscription (only vocabulary/exercises/slides are
// locked, see [lesson]/page.tsx), so all 120 are genuine, indexable pages
// now, not just each level's lesson 1. Milestone exams are NOT listed —
// those still redirect an anonymous visitor to /pricing with no
// free-content exception worth indexing.
//
// The free word-game puzzles (see freeSequencesFor in word-games/free-tier.ts,
// which is the same rule the paywall applies) ARE listed, also since
// 2026-08-28 — they don't redirect, but the
// /word-games picker only server-renders links for whichever (type, level)
// tab is selected by default (a client-side "use client" picker — see its
// own comment), so 7 of the 8 (type, level) combinations among the free
// puzzles have no other discoverable path at all without this.
//
// The 3 game landing pages (/sopa-de-letras-ruso, etc. — see their own
// page.tsx files) are Spanish-search-intent pages with no Russian
// equivalent query behavior, so they're only listed for "es", not looped
// over `locales` like everything else here.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    "",
    "/pricing",
    "/stories",
    "/media",
    "/courses",
    "/word-games",
    "/glossary",
    "/vocabulary",
    "/sobre-nosotros",
    // Added 31.08.2026. These were the inconsistency a link crawl found
    // that a sitemap crawl could not: robots.txt allows them, the footer
    // links to them from every page, they render real content and carry
    // their own title and description — but they were absent here, so the
    // sitemap disagreed with the site about what is public. Legal pages
    // are also a standard trust signal for a site that takes payments, so
    // the resolution is to list them rather than to disallow them.
    //
    // /download is deliberately NOT here: it is noindex until the app is
    // actually in a store (see its own generateMetadata).
    "/terms",
    "/privacy",
  ];

  // Spanish-search-intent landing pages — no Russian-language equivalent
  // query behavior expected, so "es" only (see [lang]!=="es" -> notFound()
  // in each page.tsx).
  const esOnlyPaths = [
    "/sopa-de-letras-ruso",
    "/crucigramas-ruso-principiantes",
    "/sopa-de-letras-alfabeto-cirilico",
    "/juegos-para-aprender-ruso",
    // Grammar guides + their index. Same ES-only reasoning as above:
    // these explain Russian grammar BY comparing it to Spanish, so a
    // Russian-interface copy would be the same Spanish text twice.
    "/gramatica",
    "/gramatica/alfabeto-ruso",
    "/gramatica/genero-sustantivos-ruso",
    "/gramatica/plural-sustantivos-ruso",
    "/gramatica/verbos-reflexivos-ruso",
    // The six themed sopa-de-letras landings (02.09.2026). Taken from the
    // table rather than retyped, so adding a seventh cannot leave it out
    // of the map — the crawlable-surface test enumerates the same routes
    // from the filesystem and would fail if the two ever disagreed.
    ...TOPIC_LANDING_PATHS,
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const path of staticPaths) {
    for (const lang of locales) {
      entries.push({ url: `${SITE_URL}/${lang}${path}`, changeFrequency: "weekly" });
    }
  }

  for (const path of esOnlyPaths) {
    entries.push({ url: `${SITE_URL}/es${path}`, changeFrequency: "monthly" });
  }

  // The 23 per-theme vocabulary pages, ES-only for the same reason as the
  // grammar guides above. Taken from the list rather than hardcoded as a
  // count, so adding a category can't leave its page out of the map. They
  // publish A1-B2 cards only; C1 stays paywalled in full, which is a
  // property of the page, not of this listing.
  for (const page of VOCABULARY_CATEGORY_PAGES) {
    entries.push({ url: `${SITE_URL}/es/vocabulary/${page.slug}`, changeFrequency: "weekly" });
  }

  // `lastModified` on the puzzle URLs, and only where it is a REAL date.
  //
  // Why this matters here more than anywhere else: on 02.09.2026 the 80
  // free puzzles were regenerated and 138 of their URLs changed title and
  // content. Search Console's manual "request indexing" is capped at ~10
  // URLs a day, so a 138-URL queue is not a mechanism. The sitemap is —
  // but only if it says when each URL actually changed. Before this
  // change the file emitted no lastmod at all, so nothing told a crawler
  // that anything had moved.
  //
  // The date comes from the row's own `updatedAt`, which Prisma stamps on
  // every write (see schema.prisma). Rows written before that column
  // existed have no date and are emitted WITHOUT lastmod rather than with
  // a fallback: a made-up date on an unchanged URL is worse than silence,
  // because a sitemap whose lastmod is not trustworthy gets its lastmod
  // ignored wholesale.
  // Wrapped, and deliberately so. On 29.08.2026 this exact select brought
  // the WHOLE sitemap down with a 500 in production: `updatedAt` was in
  // schema.prisma but not in the database, because ensure-schema-sync.ts
  // could not see the field (its model parser stopped at the first "}" in
  // a comment — fixed, with a test, in prisma/ensure-schema-sync.ts).
  //
  // A sitemap that 500s is invisible to every crawler, which is a far
  // worse outcome than a sitemap without lastmod. So a failure to read the
  // dates degrades this file to the state it was in before lastmod existed
  // instead of taking it off the air. The error is logged rather than
  // swallowed, because silently serving a sitemap with no dates for weeks
  // is its own kind of failure.
  let puzzleUpdatedAt = new Map<string, Date | null>();
  try {
    const puzzleRows = await db.wordGamePuzzle.findMany({
      // Заведомо надмножество бесплатных: точный ответ даёт
      // freeSequencesFor ниже, а не этот запрос (free-tier.ts).
      where: freeWordGameWhere(),
      select: { type: true, level: true, sequence: true, updatedAt: true },
    });
    puzzleUpdatedAt = new Map(
      puzzleRows.map((r) => [`${r.type}/${r.level}/${r.sequence}`, r.updatedAt ?? null]),
    );
  } catch (error) {
    console.error("[sitemap] could not read WordGamePuzzle.updatedAt; serving without lastmod", error);
  }

  // Уровни НЕ фильтруются по C1, и номера не считаются от 1 до предела:
  // и то и другое — пересказ правила бесплатности своими словами, а
  // правило живёт в free-tier.ts и умеет отвечать за себя само. C1 даёт
  // пустой список, и цикл по нему просто ничего не кладёт.
  for (const level of flashcardLevels) {
    for (const type of ["WORD_SEARCH", "CROSSWORD"] as const) {
      for (const sequence of freeSequencesFor(type, level)) {
        const updatedAt = puzzleUpdatedAt.get(`${type}/${level}/${sequence}`) ?? null;
        for (const lang of locales) {
          entries.push({
            url: `${SITE_URL}/${lang}/word-games/${type}/${level}/${sequence}`,
            changeFrequency: "yearly",
            ...(updatedAt ? { lastModified: updatedAt } : {}),
          });
        }
      }
    }
  }

  for (const level of levelSlugs) {
    for (const lang of locales) {
      entries.push({ url: `${SITE_URL}/${lang}/courses/${level}`, changeFrequency: "monthly" });
    }
  }

  for (const level of levelSlugs) {
    for (const lessonSlug of lessonSlugsFor(level)) {
      for (const lang of locales) {
        entries.push({ url: `${SITE_URL}/${lang}/courses/${level}/${lessonSlug}`, changeFrequency: "monthly" });
      }
    }
  }

  // Stories deliberately get NO lastmod until 25.09.2026.
  //
  // Story has carried a real `updatedAt` all along and the sitemap could
  // use it — but 65 stories are the frozen half of a live experiment (see
  // PROGRESS.md section 6), and lastmod is a recrawl signal. Handing all
  // of them a fresh one mid-experiment changes how often the measured
  // pages are fetched, which is exactly the kind of side effect "do not
  // touch the frozen pages with anything" exists to prevent. It would hit
  // pilot and control alike, so it probably would not bias the result —
  // "probably" is not a good enough reason to perturb a measurement that
  // has three weeks left to run. Revisit when the freeze lifts.
  // Wrapped for the same reason as the puzzle read above, and added
  // 29.08.2026 after the post-compact audit found that only ONE of this
  // file's three database reads was protected. A failure here used to take
  // the whole sitemap off the air; now it costs this family's URLs and
  // leaves the other ~1250 in the file. Losing 650 entries is bad; losing
  // 1902 because of 650 is worse.
  let stories: { id: string }[] = [];
  try {
    stories = await db.story.findMany({ select: { id: true } });
  } catch (error) {
    console.error("[sitemap] could not read Story; serving without story URLs", error);
  }
  for (const story of stories) {
    for (const lang of locales) {
      entries.push({ url: `${SITE_URL}/${lang}/stories/${story.id}`, changeFrequency: "monthly" });
    }
  }

  const media = await getAllMedia();
  for (const item of media) {
    for (const lang of locales) {
      entries.push({ url: `${SITE_URL}/${lang}/media/${item.id}`, changeFrequency: "monthly" });
    }
  }

  // Same query shape as glossary/[slug]/page.tsx's generateStaticParams —
  // deliberately not a hardcoded count, so this always matches whatever's
  // actually in the DB (which is also what generateStaticParams pre-renders
  // from at build time) rather than drifting from it.
  // Glossary terms are not part of the experiment, carry a real
  // `updatedAt`, and are edited one at a time — so their dates differ per
  // row and are a genuine signal rather than one batch timestamp.
  //
  // Wrapped too, 29.08.2026 — and this one was the sharpest remaining edge:
  // it selects `updatedAt`, exactly the kind of column whose absence
  // produced the outage in the first place, and it was the last unprotected
  // read in the file.
  let glossaryTerms: { slug: string; updatedAt: Date }[] = [];
  try {
    glossaryTerms = await db.glossaryTerm.findMany({ select: { slug: true, updatedAt: true } });
  } catch (error) {
    console.error("[sitemap] could not read GlossaryTerm; serving without glossary URLs", error);
  }
  for (const term of glossaryTerms) {
    for (const lang of locales) {
      entries.push({
        url: `${SITE_URL}/${lang}/glossary/${term.slug}`,
        changeFrequency: "yearly",
        lastModified: term.updatedAt,
      });
    }
  }

  return entries;
}
