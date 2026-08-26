import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { PlanId } from "@/lib/plans";

function PlanCard({
  lang,
  planId,
  next,
  name,
  price,
  period,
  cta,
  badge,
  features,
  featuresTitle,
  highlighted,
  premium,
  valueNote,
  oxxoPrice,
  oxxoCta,
  oxxoNote,
}: {
  lang: string;
  planId: PlanId;
  /** Page to return to after a successful card checkout — see
   * /api/checkout's `next` handling. Undefined falls back to /profile. */
  next?: string;
  name: string;
  price: string;
  period: string;
  cta: string;
  badge?: string;
  features: string[];
  featuresTitle: string;
  highlighted?: boolean;
  /** The lifetime plan's own accent (amber/crown), distinct from
   * `highlighted` (the brand accent used to steer most visitors toward
   * annual) — the two are mutually exclusive in practice since only one
   * card is ever the "best value for most people" vs. "the one-time,
   * everything-forever plan". */
  premium?: boolean;
  /** Short cost-comparison line shown under the price — only the lifetime
   * plan has one (see dict.pricing.lifetime.valueNote). */
  valueNote?: string;
  // Undefined for the lifetime plan: it's card-only, no OXXO one-time-cash
  // option (see plans.ts) — the button is simply not rendered for it.
  oxxoPrice?: string;
  oxxoCta?: string;
  oxxoNote?: string;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 ${
        highlighted
          ? "border-primary bg-primary/5 shadow-lg shadow-primary/10 sm:scale-[1.03]"
          : premium
            ? "border-amber-500/40 bg-amber-500/5 shadow-lg shadow-amber-500/10"
            : "border-black/10 dark:border-white/10"
      }`}
    >
      {(highlighted || premium) && badge && (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm ${
            premium ? "bg-amber-500" : "bg-folk-red"
          }`}
        >
          {premium && <span aria-hidden>👑 </span>}
          {badge}
        </span>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{name}</h2>
        {!highlighted && !premium && badge && (
          <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-medium">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight">{price}</span>
        <span className="text-sm text-foreground/60">{period}</span>
      </p>
      {valueNote && (
        <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">{valueNote}</p>
      )}

      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-foreground/50">
        {featuresTitle}
      </p>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-foreground/70">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span aria-hidden>✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <form action="/api/checkout" method="POST" className="mt-8">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="plan" value={planId} />
        {next && <input type="hidden" name="next" value={next} />}
        <button
          type="submit"
          name="method"
          value="card"
          className={`tap w-full rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
            highlighted
              ? "bg-primary text-white hover:bg-primary-400 active:bg-primary-400"
              : premium
                ? "bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-600"
                : "bg-foreground text-background hover:bg-foreground/85 active:bg-foreground/85"
          }`}
        >
          {cta}
        </button>
        {oxxoPrice && oxxoCta && (
          <button
            type="submit"
            name="method"
            value="oxxo"
            className="tap mt-3 w-full rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 active:bg-foreground/5 dark:border-white/10"
          >
            {oxxoCta} — {oxxoPrice}
          </button>
        )}
        {oxxoNote && <p className="mt-2 text-xs text-foreground/50">{oxxoNote}</p>}
      </form>
    </div>
  );
}

export default async function PricingPage({ params, searchParams }: PageProps<"/[lang]/pricing">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const { next: nextRaw } = await searchParams;
  const next = typeof nextRaw === "string" && nextRaw.startsWith(`/${lang}/`) ? nextRaw : undefined;

  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {dict.pricing.title}
      </h1>
      <p className="mt-3 max-w-xl text-foreground/70">{dict.pricing.subtitle}</p>

      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:items-start lg:grid-cols-3">
        <PlanCard
          lang={lang}
          planId="monthly"
          next={next}
          name={dict.pricing.monthly.name}
          price={dict.pricing.monthly.price}
          period={dict.pricing.monthly.period}
          cta={dict.pricing.monthly.cta}
          features={dict.pricing.features}
          featuresTitle={dict.pricing.featuresTitle}
          oxxoPrice={dict.pricing.monthly.oxxoPrice}
          oxxoCta={dict.pricing.oxxoCta}
          oxxoNote={dict.pricing.oxxoNote}
        />
        <PlanCard
          lang={lang}
          planId="annual"
          next={next}
          name={dict.pricing.annual.name}
          price={dict.pricing.annual.price}
          period={dict.pricing.annual.period}
          cta={dict.pricing.annual.cta}
          badge={dict.pricing.annual.badge}
          features={dict.pricing.features}
          featuresTitle={dict.pricing.featuresTitle}
          highlighted
          oxxoPrice={dict.pricing.annual.oxxoPrice}
          oxxoCta={dict.pricing.oxxoCta}
          oxxoNote={dict.pricing.oxxoNote}
        />
        <PlanCard
          lang={lang}
          planId="lifetime"
          next={next}
          name={dict.pricing.lifetime.name}
          price={dict.pricing.lifetime.price}
          period={dict.pricing.lifetime.period}
          cta={dict.pricing.lifetime.cta}
          badge={dict.pricing.lifetime.badge}
          features={dict.pricing.featuresPremium}
          featuresTitle={dict.pricing.featuresPremiumTitle}
          premium
          valueNote={dict.pricing.lifetime.valueNote}
        />
      </div>
    </div>
  );
}
