import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import FreeTierCard from "@/components/pricing/FreeTierCard";
import SubscriptionCard from "@/components/pricing/SubscriptionCard";
import PremiumCard from "@/components/pricing/PremiumCard";
import PaymentMethodLogos from "@/components/pricing/PaymentMethodLogos";
import PricingFaq from "@/components/pricing/PricingFaq";

export default async function PricingPage({ params, searchParams }: PageProps<"/[lang]/pricing">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const { next: nextRaw, highlight } = await searchParams;
  const next = typeof nextRaw === "string" && nextRaw.startsWith(`/${lang}/`) ? nextRaw : undefined;
  // Only "premium" is a real target today (the profile page's per-plan
  // upsell link for annual subscribers) — anything else is ignored rather
  // than silently highlighting the wrong card.
  const highlightPremium = highlight === "premium";

  const dict = await getDictionary(lang);
  const p = dict.pricing;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{p.title}</h1>
      <p className="mt-3 max-w-xl text-foreground/70">{p.subtitle}</p>
      <p className="mt-4 inline-block rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        {p.guaranteeNote}
      </p>

      {/* Recommended (Subscription) tile is visually first on mobile and
          center + elevated on desktop — order-first/lg:order-none swaps it
          without duplicating markup. */}
      <div className="mt-10 grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="order-2 lg:order-1">
          <FreeTierCard
            heading={p.freeHeading}
            description={p.freeDescription}
            features={p.freeFeatures}
            featuresTitle={p.featuresTitle}
            cta={p.freeCta}
            href={`/${lang}/register${next ? `?redirectTo=${encodeURIComponent(next)}` : ""}`}
          />
        </div>

        <div className="order-1 lg:order-2">
          <SubscriptionCard
            lang={lang}
            next={next}
            periodLabel={p.billingPeriodLabel}
            methodLabel={p.paymentMethodLabel}
            monthLabel={p.monthLabel}
            yearLabel={p.yearLabel}
            cardLabel={p.cardLabel}
            cashLabel={p.cashLabel}
            monthly={p.monthly}
            annual={p.annual}
            featuresTitle={p.featuresTitle}
            features={p.features}
            oxxoDetailsSummary={p.oxxoDetailsSummary}
            oxxoNote={p.oxxoNote}
          />
        </div>

        <div className="order-3">
          <PremiumCard
            lang={lang}
            methodLabel={p.paymentMethodLabel}
            cardLabel={p.cardLabel}
            cashLabel={p.cashLabel}
            name={p.lifetime.name}
            price={p.lifetime.price}
            period={p.lifetime.period}
            badge={p.lifetime.badge}
            valueNote={p.lifetime.valueNote}
            mxnApprox={p.lifetime.mxnApprox}
            cardCta={p.lifetime.cardCta}
            cashCta={p.lifetime.cashCta}
            featuresTitle={p.featuresPremiumTitle}
            features={p.featuresPremium}
            oxxoDetailsSummary={p.oxxoDetailsSummary}
            oxxoNote={p.oxxoNote}
            highlighted={highlightPremium}
          />
        </div>
      </div>

      <div className="mt-16">
        <PaymentMethodLogos note={p.paymentMethodsNote} />
      </div>

      <div className="mt-16">
        <PricingFaq heading={p.faqHeading} items={p.faq} />
      </div>
    </div>
  );
}
