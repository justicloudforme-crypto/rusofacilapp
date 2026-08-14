import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { PlanId } from "@/lib/plans";

function PlanCard({
  lang,
  planId,
  name,
  price,
  period,
  cta,
  badge,
  features,
  featuresTitle,
  highlighted,
}: {
  lang: string;
  planId: PlanId;
  name: string;
  price: string;
  period: string;
  cta: string;
  badge?: string;
  features: string[];
  featuresTitle: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-8 ${
        highlighted
          ? "border-foreground/60"
          : "border-black/10 dark:border-white/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{name}</h2>
        {badge && (
          <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-medium">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight">{price}</span>
        <span className="text-sm text-foreground/60">{period}</span>
      </p>

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
        <button
          type="submit"
          className="w-full rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
        >
          {cta}
        </button>
      </form>
    </div>
  );
}

export default async function PricingPage({ params }: PageProps<"/[lang]/pricing">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {dict.pricing.title}
      </h1>
      <p className="mt-3 max-w-xl text-foreground/70">{dict.pricing.subtitle}</p>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <PlanCard
          lang={lang}
          planId="monthly"
          name={dict.pricing.monthly.name}
          price={dict.pricing.monthly.price}
          period={dict.pricing.monthly.period}
          cta={dict.pricing.monthly.cta}
          features={dict.pricing.features}
          featuresTitle={dict.pricing.featuresTitle}
        />
        <PlanCard
          lang={lang}
          planId="annual"
          name={dict.pricing.annual.name}
          price={dict.pricing.annual.price}
          period={dict.pricing.annual.period}
          cta={dict.pricing.annual.cta}
          badge={dict.pricing.annual.badge}
          features={dict.pricing.features}
          featuresTitle={dict.pricing.featuresTitle}
          highlighted
        />
      </div>
    </div>
  );
}
