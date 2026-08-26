import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { levelSlugs } from "@/lib/courses";
import { getHomepageStats, getHomepageWordSample } from "@/lib/home-stats";
import HeroWordDeck from "@/components/home/HeroWordDeck";
import TrustStrip from "@/components/home/TrustStrip";
import CyrillicWatermark from "@/components/home/CyrillicWatermark";
import Button from "@/components/ui/Button";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const [stats, words] = await Promise.all([getHomepageStats(), getHomepageWordSample()]);

  return (
    <div className="flex flex-1 flex-col">
      {/* min-h on mobile targets "fits in one screen up to the buttons"
          (100dvh minus the h-16 sticky header) — the word-deck wrapper right
          below is deliberately short (h-10, overflow-hidden) so only each
          card's top edge peeks into view as a "there's something below,
          scroll" cue, per the redesign brief. sm:+ drops both constraints
          and shows the full deck beside the text instead of under it. */}
      <section className="relative overflow-hidden border-b border-black/10 dark:border-white/10">
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
              <Button href="#features" variant="ghost" size="lg">
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
            <div className="h-10 overflow-hidden sm:h-auto sm:overflow-visible">
              <HeroWordDeck
                words={words}
                dict={{ flipHint: dict.home.heroFlipHint, listenLabel: dict.home.heroListenLabel }}
              />
            </div>
          )}
        </div>
      </section>

      {/* scroll-mt-20 clears the sticky header (h-16 = 64px + a small
          buffer) when this is reached via the #features anchor link above
          — otherwise the header covers the section title on landing
          (AUDIT.md's confirmed sticky-header-covers-anchor bug). The
          header is a constant single-row height now, so a fixed value is
          safe here (it used to be able to wrap to 2 lines). */}
      <section id="features" className="scroll-mt-20 border-t border-black/10 dark:border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            {dict.home.featuresTitle}
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {dict.home.features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-black/10 p-6 dark:border-white/10"
              >
                <h3 className="font-medium">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-foreground/70">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-black/10 dark:border-white/10">
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
                  className="tap group flex flex-col justify-between rounded-2xl border border-black/10 p-6 transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/10"
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
    </div>
  );
}
