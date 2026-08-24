import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { levelSlugs } from "@/lib/courses";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return (
    <div className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-6 py-20 sm:py-28">
        <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-foreground/70 dark:border-white/15">
          {dict.home.badge}
        </span>
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {dict.home.heroTitle}
        </h1>
        <p className="max-w-xl text-lg leading-8 text-foreground/70">
          {dict.home.heroSubtitle}
        </p>
        <div className="flex flex-wrap gap-4 pt-2">
          <Link
            href={`/${lang}/courses`}
            className="tap rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
          >
            {dict.home.heroCta}
          </Link>
          <Link
            href="#features"
            className="tap rounded-full border border-black/10 px-6 py-3 text-sm font-medium transition-colors hover:bg-black/[.04] active:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
          >
            {dict.home.heroSecondaryCta}
          </Link>
        </div>
      </section>

      <section id="features" className="border-t border-black/10 dark:border-white/10">
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
