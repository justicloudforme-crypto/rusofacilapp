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
    // Not dict.pricing.subtitle: that is the VISIBLE subtitle on the page,
    // 60-63 characters, which is too thin for a snippet — and lengthening
    // it would change what a reader sees. Measured 30.08.2026, these were
    // the only two descriptions on the whole site under 70 characters.
    description:
      lang === "ru"
        ? "Тарифы RusoFácilapp: месячный, годовой и пожизненный доступ к курсу A1–B2, а со словарём, рассказами и играми — до уровня C1. Карта или наличные в OXXO."
        : "Planes de RusoFácilapp: mensual, anual o de por vida. Curso de A1 a B2; con Premium, vocabulario, cuentos y juegos hasta el C1. Tarjeta o efectivo OXXO.",
    // Canonical is the query-free /pricing even when the visitor arrived at
    // /pricing?next=…&highlight=premium — same as the header-based version
    // it replaces, which read a pathname that never carried a query string.
    alternates: routeAlternates(lang, "/pricing"),
  };
}

export default async function PricingPage({ params, searchParams }: PageProps<"/[lang]/pricing">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const { next: nextRaw, highlight, checkout } = await searchParams;
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

      {/* /api/checkout sends people back here when it cannot open a payment
          — the rate limiter, or (on a deployment) a Stripe configuration
          that would otherwise have granted the plan for free. Both used to
          redirect to this page silently, so the button simply appeared not
          to work. Saying "you were not charged" is the part that matters:
          the alternative is somebody paying twice out of doubt. */}
      {(checkout === "unavailable" || checkout === "rate_limited") && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
        >
          {checkout === "rate_limited" ? p.checkoutRateLimited : p.checkoutUnavailable}
        </p>
      )}

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
          featuresNote={p.featuresPremiumNote}
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
