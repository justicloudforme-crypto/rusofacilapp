import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { levelSlugs } from "@/lib/courses";
import { getHomepageStats, getHomepagePreviewData, getHomepageWordSample } from "@/lib/home-stats";
import HeroWordDeck from "@/components/home/HeroWordDeck";
import TrustStrip from "@/components/home/TrustStrip";
import CyrillicWatermark from "@/components/home/CyrillicWatermark";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LevelBadge from "@/components/LevelBadge";
import SpeakButton from "@/components/lesson/SpeakButton";
import PricingFaq from "@/components/pricing/PricingFaq";
import JsonLd from "@/components/seo/JsonLd";
import { organizationJsonLd, websiteJsonLd } from "@/lib/site";
import {
  GlobeIcon,
  DictionaryIcon,
  ChartIcon,
  HeadphonesIcon,
  GraduationCapIcon,
  ChecklistIcon,
  BookIcon,
} from "@/components/profile/ProfileIcons";

// Icon per features[i] — same 4 items/order as dict.home.features, just
// giving each a visual anchor instead of a bare text list. Index-matched
// on purpose rather than a keyed lookup: the dictionary array has no stable
// id field, and this list only ever has these 4 fixed entries.
const FEATURE_ICONS = [GlobeIcon, DictionaryIcon, ChartIcon, HeadphonesIcon];
const HOW_IT_WORKS_ICONS = [GraduationCapIcon, ChecklistIcon, BookIcon];

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const [stats, words, preview] = await Promise.all([
    getHomepageStats(),
    getHomepageWordSample(),
    getHomepagePreviewData(),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      {/* Organization + WebSite JSON-LD — establishes RusoFácilapp's own
          identity for Google (name/url/logo/description), fixing AI
          Overviews describing an unrelated app under the same search
          term (no Organization markup existed anywhere on the site
          before this). Homepage only, not every page — same "one per
          entity" placement Google recommends. */}
      <JsonLd data={organizationJsonLd(lang)} />
      <JsonLd data={websiteJsonLd(lang)} />
      {/* Text here must stay word-for-word identical to dict.home.faq below
          (rendered visibly via PricingFaq further down this page) — Google
          can flag/ignore FAQPage markup that doesn't match the page's own
          visible content. A separate FAQPage already exists on /pricing
          (different questions, different URL) — one per page is the norm,
          not a conflict. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: dict.home.faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />
      {/* min-h on mobile targets "fits in one screen up to the buttons"
          (100dvh minus the h-16 sticky header) — the word-deck cards render
          at full height below (owner-reported bug: an earlier h-10
          overflow-hidden wrapper clipped every card down to its top border,
          leaving only an unreadable sliver). sm:+ shows the full deck beside
          the text instead of under it. */}
      <section className="relative overflow-hidden border-b border-black/10 dark:border-white/30">
        <CyrillicWatermark letter="Я" className="-right-10 -top-16 -z-10" />
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:min-h-0 sm:grid sm:grid-cols-2 sm:items-center sm:gap-10 sm:px-6 sm:py-24">
          <div className="flex flex-1 flex-col justify-center gap-5 sm:flex-none">
            <span className="w-fit rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-foreground/70 dark:border-white/15">
              {dict.home.badge}
            </span>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {dict.home.heroTitle}
            </h1>
            <p className="max-w-xl text-lg leading-8 text-foreground/70">{dict.home.heroSubtitle}</p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Button href={`/${lang}/courses`} size="lg">
                {dict.home.heroCta}
              </Button>
              <Button href="#how-it-works" variant="ghost" size="lg">
                {dict.home.heroSecondaryCta}
              </Button>
            </div>
            <div className="pt-6">
              <TrustStrip
                items={[
                  { value: String(stats.storyCount), label: dict.home.trustStories },
                  { value: String(stats.wordCount), label: dict.home.trustWords },
                  {
                    value: `${levelSlugs[0].toUpperCase()}–${levelSlugs[levelSlugs.length - 1].toUpperCase()}`,
                    label: dict.home.trustLevelsLabel,
                  },
                  { value: "OXXO", label: dict.home.trustOxxoLabel },
                ]}
              />
            </div>
          </div>

          {words.length > 0 && (
            <HeroWordDeck
              words={words}
              dict={{ flipHint: dict.home.heroFlipHint, listenLabel: dict.home.heroListenLabel }}
            />
          )}
        </div>
      </section>

      <section className="border-t border-black/10 dark:border-white/30">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            {dict.home.featuresTitle}
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {dict.home.features.map((feature, index) => {
              const Icon = FEATURE_ICONS[index];
              return (
                <Card key={feature.title} padding="lg">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary-text">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-medium">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-foreground/70">
                    {feature.description}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* scroll-mt-20 clears the sticky header (h-16 = 64px + a small
          buffer) when this is reached via the hero's ghost-CTA anchor link
          — otherwise the header covers the section title on landing
          (AUDIT.md's confirmed sticky-header-covers-anchor bug). */}
      <section id="how-it-works" className="relative scroll-mt-20 overflow-hidden border-t border-black/10 dark:border-white/30">
        <CyrillicWatermark letter="П" className="-left-14 top-0 -z-10" />
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">{dict.home.howItWorksTitle}</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {dict.home.howItWorksSteps.map((step, index) => {
              const Icon = HOW_IT_WORKS_ICONS[index];
              return (
                <div key={step.title} className="flex flex-col gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary-text">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="text-sm leading-6 text-foreground/70">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-black/10 dark:border-white/30">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            {dict.home.levelsTitle}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-foreground/70">
            {dict.home.levelsSubtitle}
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {levelSlugs.map((slug) => {
              const level = dict.courses.levels[slug];
              return (
                <Link
                  key={slug}
                  href={`/${lang}/courses/${slug}`}
                  className="tap group flex flex-col justify-between rounded-2xl border border-black/10 p-6 transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/30"
                >
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                      {slug}
                    </span>
                    <h3 className="mt-1 font-medium">{level.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-foreground/70">
                      {level.subtitle}
                    </p>
                  </div>
                  <span className="mt-4 text-sm font-medium text-foreground/80 group-hover:text-foreground group-active:text-foreground">
                    {dict.home.viewLevel} →
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Real content previews, not mockups: an actual A1 flashcard (a
          different category than the hero deck, which already uses
          "greetings"), an actual free story, and real A1 words as static
          tiles standing in for a crossword — deliberately NOT wired to the
          real word-game engine (buildCrossword etc.), per the redesign
          brief: a taste of the game, not a playable one on the homepage. */}
      <section className="border-t border-black/10 dark:border-white/30">
        <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
          {preview.previewWord && (
            <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{dict.home.previewFlashcardTitle}</h2>
                <Link
                  href={`/${lang}/vocabulary`}
                  className="tap mt-2 flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-primary-text"
                >
                  {dict.home.previewFlashcardCta} →
                </Link>
              </div>
              <Card className="flex items-center gap-4">
                <span className="text-4xl" aria-hidden>
                  {preview.previewWord.emoji}
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-lg font-semibold">{preview.previewWord.russian}</span>
                  <span className="text-sm text-foreground/50">{preview.previewWord.transcription}</span>
                  <span className="mt-1 text-sm text-foreground/70">{preview.previewWord.translationEs}</span>
                </div>
                <SpeakButton
                  text={preview.previewWord.russian}
                  label={dict.home.heroListenLabel}
                  audioUrl={preview.previewWord.audioUrl ?? undefined}
                  size="md"
                />
              </Card>
            </div>
          )}

          {preview.previewStory && (
            <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-2">
              <Card className="order-2 flex flex-col gap-2 sm:order-1">
                <div className="flex items-center gap-2">
                  <LevelBadge level={preview.previewStory.level} />
                  <span className="text-xs text-foreground/50">{preview.previewStory.author}</span>
                </div>
                <h3 className="mt-1 font-medium">{preview.previewStory.title}</h3>
                {preview.previewStory.description && (
                  <p className="text-sm leading-6 text-foreground/70">{preview.previewStory.description}</p>
                )}
              </Card>
              <div className="order-1 flex flex-col gap-2 sm:order-2">
                <h2 className="text-xl font-semibold tracking-tight">{dict.home.previewStoryTitle}</h2>
                <Link
                  href={`/${lang}/stories`}
                  className="tap mt-2 flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-primary-text"
                >
                  {dict.home.previewStoryCta} →
                </Link>
              </div>
            </div>
          )}

          {preview.previewGameWords.length > 0 && (
            <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{dict.home.previewGameTitle}</h2>
                <Link
                  href={`/${lang}/word-games`}
                  className="tap mt-2 flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-primary-text"
                >
                  {dict.home.previewGameCta} →
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {preview.previewGameWords.map((word) => (
                  <span
                    key={word}
                    className="rounded-xl border border-black/10 bg-background px-3 py-2 text-sm font-medium uppercase tracking-wide dark:border-white/30"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-black/10 dark:border-white/30">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">{dict.home.pricingStripTitle}</h2>
          <p className="mt-2 max-w-xl text-sm text-foreground/70">{dict.home.pricingStripSubtitle}</p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card tone="neutral" padding="lg">
              <h3 className="font-medium">{dict.pricing.freeHeading}</h3>
              <p className="mt-2 text-2xl font-semibold">$0</p>
            </Card>
            <Card tone="neutral" padding="lg">
              <h3 className="font-medium">{dict.pricing.monthly.name}</h3>
              <p className="mt-2 text-2xl font-semibold">{dict.pricing.monthly.price}</p>
            </Card>
            <Card tone="primary" padding="lg" className="relative">
              {dict.pricing.annual.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-folk-red px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  {dict.pricing.annual.badge}
                </span>
              )}
              <h3 className="font-medium">{dict.pricing.annual.name}</h3>
              <p className="mt-2 text-2xl font-semibold">{dict.pricing.annual.price}</p>
              {dict.pricing.annual.perMonthNote && (
                <p className="mt-1 text-xs text-foreground/60">{dict.pricing.annual.perMonthNote}</p>
              )}
            </Card>
            <Card tone="premium" padding="lg">
              <h3 className="font-medium text-premium-700 dark:text-premium-300">{dict.pricing.lifetime.name}</h3>
              <p className="mt-2 text-2xl font-semibold">{dict.pricing.lifetime.price}</p>
            </Card>
          </div>
          <Link
            href={`/${lang}/pricing`}
            className="tap mt-8 flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-primary-text"
          >
            {dict.home.pricingStripCta} →
          </Link>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-black/10 dark:border-white/30">
        <CyrillicWatermark letter="Р" className="-bottom-16 -right-10 -z-10" />
        <div className="mx-auto max-w-5xl px-6 py-16">
          <PricingFaq heading={dict.home.faqTitle} items={dict.home.faq} />
        </div>
      </section>

      <section className="border-t border-black/10 dark:border-white/30">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">{dict.home.finalCtaTitle}</h2>
          <p className="max-w-md text-sm text-foreground/70">{dict.home.finalCtaSubtitle}</p>
          <Button href={`/${lang}/register`} size="lg">
            {dict.home.finalCtaButton}
          </Button>
        </div>
      </section>
    </div>
  );
}
