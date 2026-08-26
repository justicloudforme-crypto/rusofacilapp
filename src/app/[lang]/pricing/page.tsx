import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { PlanId } from "@/lib/plans";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

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
  // All 3 CTAs are bg-primary now (Button variant="primary") — the old
  // 3-way graphite/blue/amber split was AUDIT.md's headline visual-chaos
  // finding. premium=true still gets its own gold card border/badge (a
  // non-clickable value marker, via Card tone="premium" + PremiumBadge) but
  // the button ITSELF converges on primary like every other CTA, per the
  // "Кремль" direction: primary handles every interactive action including
  // the Lifetime plan; gold never does (see CLAUDE.md, guarded by
  // `npm run check:tokens`'s premium-on-clickable check).
  return (
    <Card
      tone={highlighted ? "primary" : premium ? "premium" : "neutral"}
      padding="lg"
      shadow={highlighted || premium}
      className={`relative flex h-full flex-col ${highlighted ? "sm:scale-[1.03]" : ""}`}
    >
      {(highlighted || premium) && badge && (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm ${
            premium ? "bg-premium-500" : "bg-folk-red"
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
        <span className="whitespace-nowrap text-3xl font-semibold tracking-tight">{price}</span>
        <span className="text-sm text-foreground/60">{period}</span>
      </p>
      {valueNote && <p className="mt-1.5 text-xs text-premium-700 dark:text-premium-300">{valueNote}</p>}

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

      <form action="/api/checkout" method="POST" className="mt-auto pt-8">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="plan" value={planId} />
        {next && <input type="hidden" name="next" value={next} />}
        <Button type="submit" name="method" value="card" variant="primary" fullWidth haptic={false}>
          {cta}
        </Button>
        {oxxoPrice && oxxoCta && (
          <Button type="submit" name="method" value="oxxo" variant="outline" fullWidth haptic={false} className="mt-3">
            {oxxoCta} — {oxxoPrice}
          </Button>
        )}
        {oxxoNote && <p className="mt-2 text-xs text-foreground/50">{oxxoNote}</p>}
      </form>
    </Card>
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

      <div className="mt-14 grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
