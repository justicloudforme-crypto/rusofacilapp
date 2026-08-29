import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import FreeTierCard from "@/components/pricing/FreeTierCard";
import SubscriptionCard from "@/components/pricing/SubscriptionCard";
import PremiumCard from "@/components/pricing/PremiumCard";
import PaymentMethodLogos from "@/components/pricing/PaymentMethodLogos";
import PricingFaq from "@/components/pricing/PricingFaq";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList, routeAlternates } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/pricing">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: `${dict.pricing.title} | RusoFácilapp`,
    description: dict.pricing.subtitle,
    // Canonical is the query-free /pricing even when the visitor arrived at
    // /pricing?next=…&highlight=premium — same as the header-based version
    // it replaces, which read a pathname that never carried a query string.
    alternates: routeAlternates(lang, "/pricing"),
  };
}

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
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: p.faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/${lang}` },
          { name: dict.nav.pricing, url: `${SITE_URL}/${lang}/pricing` },
        ])}
      />
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{p.title}</h1>
      <p className="mt-3 max-w-xl text-foreground/70">{p.subtitle}</p>
      <p className="mt-4 inline-block rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        {p.guaranteeNote}
      </p>

      {/* Four independent columns in ascending price order: Free, Monthly,
          Yearly, Premium. Annual carries the "recommended" tile treatment
          (primary tone, shadow, scale-up) via its −50% badge, same visual
          weight the old toggle card gave it — the plans no longer share one
          switchable card, so each needs its own checkout form. */}
      <div className="mt-10 grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <FreeTierCard
          heading={p.freeHeading}
          description={p.freeDescription}
          features={p.freeFeatures}
          featuresTitle={p.featuresTitle}
          cta={p.freeCta}
          href={`/${lang}/register${next ? `?redirectTo=${encodeURIComponent(next)}` : ""}`}
        />

        <SubscriptionCard
          lang={lang}
          next={next}
          plan="monthly"
          methodLabel={p.paymentMethodLabel}
          cardLabel={p.cardLabel}
          cashLabel={p.cashLabel}
          option={p.monthly}
          featuresTitle={p.featuresTitle}
          features={p.features}
          oxxoDict={p}
        />

        <SubscriptionCard
          lang={lang}
          next={next}
          plan="annual"
          methodLabel={p.paymentMethodLabel}
          cardLabel={p.cardLabel}
          cashLabel={p.cashLabel}
          option={p.annual}
          featuresTitle={p.featuresTitle}
          features={p.features}
          oxxoDict={p}
          recommended
        />

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
          oxxoDict={p}
          highlighted={highlightPremium}
        />
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
