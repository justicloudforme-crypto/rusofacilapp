import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { levelSlugs } from "@/lib/courses";
import { db } from "@/lib/db";
import { getAllMedia } from "@/lib/media/data";
import { SITE_URL } from "@/lib/site";

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
// indexable pages), all media items (same free/gated split), and the
// course level listings. Individual lesson pages are gated behind a
// subscription except the single free-trial lesson (A1/1, see
// isFreeTrialLesson in lib/courses.ts) — every other lesson would just
// redirect an anonymous crawler to /pricing, so only that one is listed.
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
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const path of staticPaths) {
    for (const lang of locales) {
      entries.push({ url: `${SITE_URL}/${lang}${path}`, changeFrequency: "weekly" });
    }
  }

  for (const level of levelSlugs) {
    for (const lang of locales) {
      entries.push({ url: `${SITE_URL}/${lang}/courses/${level}`, changeFrequency: "monthly" });
    }
  }

  for (const lang of locales) {
    entries.push({ url: `${SITE_URL}/${lang}/courses/a1/1`, changeFrequency: "monthly" });
  }

  const stories = await db.story.findMany({ select: { id: true } });
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

  return entries;
}
