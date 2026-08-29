import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { db } from "@/lib/db";
import {
  earliestRelatedLevel,
  isGlossaryCategory,
  parseExamplesJson,
  parseRelatedLessonSlug,
  parseRelatedLessonsJson,
} from "@/lib/glossary";
import { attachGlossaryAudio } from "@/lib/glossary-audio";
import RelatedLessonsList from "@/components/glossary/RelatedLessonsList";
import SpeakButton from "@/components/lesson/SpeakButton";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList, truncateForMeta, routeAlternates } from "@/lib/site";

// Content changes rarely (admin edits, occasional seed batch — see
// GlossaryTerm.reviewedAt's own comment) and generateStaticParams below
// only covers the terms that exist at build time, so a term added through
// /admin after the last deploy needs dynamicParams to render instead of
// 404ing until the next deploy, and a short revalidate so an edit to an
// EXISTING term's text shows up without a redeploy either.
export const dynamicParams = true;
export const revalidate = 3600;

async function getTermBySlug(slug: string) {
  const row = await db.glossaryTerm.findUnique({ where: { slug } });
  if (!row) return null;
  const category = isGlossaryCategory(row.category) ? row.category : ("otros" as const);
  const parsed = {
    ...row,
    category,
    relatedLessons: parseRelatedLessonsJson(row.relatedLessons),
    examples: parseExamplesJson(row.examples),
  };
  const [withAudio] = await attachGlossaryAudio([parsed]);
  return withAudio;
}

// Runs at BUILD time, not request time — force-dynamic (the fix used for
// sitemap.ts's identical symptom) doesn't apply here, since this function
// IS the build-time mechanism that decides which paths to pre-render.
// TURSO_DATABASE_URL/TURSO_AUTH_TOKEN are scoped to the Production
// environment only (confirmed via `vercel env ls`) — a Preview build (any
// open PR) has neither, so db.glossaryTerm.findMany() falls through to
// src/lib/db.ts's local-file fallback, which doesn't exist on Vercel's
// build container: a real deploy failure (PR #34, 2026-08-27), not a
// hypothetical one. Falling back to an empty array here is safe precisely
// because dynamicParams/revalidate above already handle "this slug wasn't
// pre-rendered" — every page still renders correctly on first real
// request in an environment that DOES have Turso (i.e. Production).
export async function generateStaticParams() {
  try {
    const rows = await db.glossaryTerm.findMany({ select: { slug: true } });
    return locales.flatMap((lang) => rows.map((row) => ({ lang, slug: row.slug })));
  } catch (error) {
    console.log(
      "[glossary/[slug]] generateStaticParams: DB unreachable at build time (expected on Preview, which has no Turso credentials) — falling back to on-demand rendering for every slug.",
      error
    );
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/glossary/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const term = await getTermBySlug(slug);
  if (!term) return {};

  const dict = await getDictionary(lang);
  const categoryLabel = dict.glossary.categoryLabels[term.category];

  // Every definition in the DB is >=83 chars today (checked against the
  // live data before writing this), so the "pad a short definition" branch
  // below is a defensive fallback for a future short entry, not something
  // that fires right now — but it means a term that DOES end up with thin
  // content never ships an empty-feeling snippet.
  const rawDescription =
    term.definition.length < 70
      ? `${term.definition} — ${term.russianEquivalent} (${categoryLabel}).`
      : term.definition;
  const description = truncateForMeta(rawDescription);

  const titleBase = lang === "ru" ? `${term.term} — glosario de gramática rusa` : `${term.term} en ruso — glosario de gramática`;
  const titleWithSuffix = `${titleBase} | RusoFácilapp`;
  // Term text varies a lot in length (5–52 chars) — for a long term, the
  // brand suffix is what has to give so the actual search term stays
  // intact and visible, per the "term matters more than brand" call.
  const title = titleWithSuffix.length > 60 ? titleBase : titleWithSuffix;

  return { title, description, alternates: routeAlternates(lang, `/glossary/${encodeURIComponent(slug)}`) };
}

export default async function GlossaryTermPage({
  params,
}: PageProps<"/[lang]/glossary/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();

  const term = await getTermBySlug(slug);
  if (!term) notFound();

  const dict = await getDictionary(lang);
  const glossaryDict = dict.glossary;
  const earliestLevel = earliestRelatedLevel(term.relatedLessons);
  const relatedLessonRefs = term.relatedLessons.map(parseRelatedLessonSlug).filter((ref) => ref !== null);

  const relatedTerms = await db.glossaryTerm.findMany({
    where: { category: term.category, slug: { not: term.slug } },
    orderBy: { term: "asc" },
    take: 3,
    select: { slug: true, term: true },
  });

  const termUrl = `${SITE_URL}/${lang}/glossary/${term.slug}`;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "DefinedTerm",
          name: term.term,
          description: term.definition,
          inDefinedTermSet: {
            "@type": "DefinedTermSet",
            name: "Glosario de gramática rusa — RusoFácilapp",
            url: `${SITE_URL}/${lang}/glossary`,
          },
          url: termUrl,
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/${lang}` },
          { name: dict.nav.glossary, url: `${SITE_URL}/${lang}/glossary` },
          { name: term.term, url: termUrl },
        ])}
      />

      <Link
        href={`/${lang}/glossary`}
        className="tap text-sm font-medium text-foreground/60 hover:text-foreground active:text-foreground"
      >
        ← {glossaryDict.backToGlossaryLabel}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/${lang}/glossary?category=${term.category}`}
          className="tap rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-foreground/70 hover:text-foreground active:text-foreground dark:border-white/15"
        >
          {glossaryDict.categoryLabels[term.category]}
        </Link>
        {earliestLevel && (
          <span className="rounded-full border border-black/10 px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-foreground/50 dark:border-white/15">
            {glossaryDict.introducedAtLabel} {earliestLevel}
          </span>
        )}
      </div>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{term.term}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-foreground/70">
        {glossaryDict.russianEquivalentLabel}:{" "}
        <span className="font-medium text-foreground">{term.russianEquivalent}</span>
        {term.transcription ? <span className="text-foreground/50">[{term.transcription}]</span> : null}
        <SpeakButton text={term.russianEquivalent} label={glossaryDict.listenLabel} audioUrl={term.audioUrl} />
      </p>

      <p className="mt-6 leading-7 text-foreground/80">{term.definition}</p>

      {term.russianComparison && (
        <p className="mt-4 rounded-xl bg-primary/[0.05] px-4 py-3 leading-7 text-foreground/80 dark:bg-primary-400/[0.08]">
          <span className="font-medium text-primary-text dark:text-primary-400">{glossaryDict.russianComparisonLabel}: </span>
          {term.russianComparison}
        </p>
      )}

      {term.examples.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2.5">
          {term.examples.map((example) => (
            <li key={example.ru} className="flex items-start gap-2 leading-6 text-foreground/70">
              <SpeakButton text={example.ru} label={glossaryDict.listenLabel} audioUrl={example.audioUrl} />
              <span>
                <span className="font-medium text-foreground/50">{glossaryDict.exampleLabel}: </span>
                {example.ru}
                <span className="text-foreground/50"> — {example.es}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {relatedLessonRefs.length > 0 && (
        <RelatedLessonsList
          lessons={term.relatedLessons}
          lang={lang}
          label={glossaryDict.relatedLessonsLabel}
          className="mt-6 block leading-6 text-foreground/70"
        />
      )}

      {relatedTerms.length > 0 && (
        <div className="mt-10 border-t border-black/10 pt-6 dark:border-white/15">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
            {glossaryDict.relatedTermsLabel}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {relatedTerms.map((related) => (
              <li key={related.slug}>
                <Link
                  href={`/${lang}/glossary/${related.slug}`}
                  className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
                >
                  {related.term}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
