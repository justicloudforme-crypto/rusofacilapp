import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import FreeTierCard from "@/components/pricing/FreeTierCard";
import SubscriptionCard, { type BillingOption } from "@/components/pricing/SubscriptionCard";
import PremiumCard from "@/components/pricing/PremiumCard";
import PaymentMethodLogos from "@/components/pricing/PaymentMethodLogos";
import PricingFaq from "@/components/pricing/PricingFaq";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList, routeAlternates } from "@/lib/site";
import { getLocalPriceContext, isCashAvailableForRequest } from "@/lib/country-server";
import { basePricesText, marked, priceCopy, withBasePrices, withPrice } from "@/lib/pricing-display";

export async function generateMetadata({ params }: PageProps<"/[lang]/pricing">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: `${dict.pricing.title} | RusoFácilapp`,
    // "Tarjeta o efectivo OXXO." until 08.09.2026 (debt 43): the snippet
    // promised a Mexican corner shop to every reader of every search
    // result, months after the page itself stopped offering one outside
    // Mexico (PROGRESS.md 7.117). generateMetadata cannot be made
    // country-aware the way the body is — a description is written once
    // per locale and cached by the search engine, not per visitor — so the
    // fix is a sentence that is TRUE everywhere rather than one that is
    // true in one country: card everywhere, cash where cash exists.
    // Not dict.pricing.subtitle: that is the VISIBLE subtitle on the page,
    // 60-63 characters, which is too thin for a snippet — and lengthening
    // it would change what a reader sees. Measured 30.08.2026, these were
    // the only two descriptions on the whole site under 70 characters.
    description:
      lang === "ru"
        ? "Тарифы RusoFácilapp: месячный, годовой и пожизненный доступ к курсу A1–B2, а со словарём, рассказами и играми — до уровня C1. Оплата картой; в Мексике — ещё и наличными в OXXO."
        : "Planes de RusoFácilapp: mensual, anual o de por vida. Curso de A1 a B2; con Premium, vocabulario, cuentos y juegos hasta el C1. Pago con tarjeta; en México, también en efectivo OXXO.",
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

  // Cash means OXXO, and OXXO means a shop in Mexico. Outside it the tab,
  // the "how to pay in cash" steps, the caption under the price table and
  // the OXXO question in the FAQ are all promises this page cannot keep —
  // so none of them are rendered. See src/lib/country.ts and PROGRESS.md
  // 7.117; /api/checkout refuses the same request on the same rule, so a
  // page that offered cash here would be offering a button that 303s back.
  const cashAvailable = await isCashAvailableForRequest();

  // ONE figure per card, in the visitor's own money, with "≈" on it — the
  // peso base price lives in a single footnote at the bottom of the page
  // (PROGRESS.md 7.120). In Mexico, in a country outside the allowlist, in
  // an unknown one, and whenever the rate feed did not answer, `converted`
  // is false and every figure here is the peso string from the dictionary,
  // exactly as the page read before 09.09.2026. See src/lib/pricing-display.ts
  // for why it is all four amounts or none.
  const localPrice = await getLocalPriceContext();
  const copy = priceCopy(localPrice, lang, {
    monthly: p.monthly.price,
    annual: p.annual.price,
    lifetime: p.lifetime.price,
    annualPerMonth: p.annual.perMonthPrice,
  });

  // The button names the same currency as the figure above it because it is
  // handed the same string — the dictionary carries "Empezar por {price}/mes"
  // and nothing else.
  const subscriptionOption = (plan: "monthly" | "annual"): BillingOption => ({
    name: p[plan].name,
    price: marked(copy[plan], copy),
    period: p[plan].period,
    badge: plan === "annual" ? p.annual.badge : undefined,
    perMonthNote: plan === "annual" ? withPrice(p.annual.perMonthNote, copy.annualPerMonth) : undefined,
    cardCta: withPrice(p[plan].cardCta, copy[plan]),
    cashCta: p[plan].cashCta,
  });

  // Two edits, not one: the OXXO-expiry question disappears whole, and the
  // auto-renewal answer loses its "with cash (OXXO)… " clause. Filtering by
  // `id` rather than by position — the questions are content and get
  // reordered; an index would silently drop the wrong one.
  const faq = (cashAvailable ? p.faq : p.faq.filter((item) => item.id !== "oxxoExpiry")).map((item) =>
    !cashAvailable && item.id === "autoCharge" ? { ...item, a: p.faqAutoChargeCardOnly } : item
  );

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 sm:px-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          // The same list the page shows below, not the dictionary's — a
          // FAQPage block advertising a question the page does not display
          // is exactly what Google's structured-data rules forbid.
          mainEntity: faq.map((item) => ({
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
      {(checkout === "unavailable" || checkout === "rate_limited" || checkout === "cash_unavailable") && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
        >
          {checkout === "rate_limited"
            ? p.checkoutRateLimited
            : checkout === "cash_unavailable"
              ? p.checkoutCashUnavailable
              : p.checkoutUnavailable}
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
          option={subscriptionOption("monthly")}
          featuresTitle={p.featuresTitle}
          features={p.features}
          oxxoDict={p}
          cashAvailable={cashAvailable}
        />

        <SubscriptionCard
          lang={lang}
          next={next}
          plan="annual"
          methodLabel={p.paymentMethodLabel}
          cardLabel={p.cardLabel}
          cashLabel={p.cashLabel}
          option={subscriptionOption("annual")}
          featuresTitle={p.featuresTitle}
          features={p.features}
          oxxoDict={p}
          cashAvailable={cashAvailable}
          recommended
        />

        <PremiumCard
          lang={lang}
          methodLabel={p.paymentMethodLabel}
          cardLabel={p.cardLabel}
          cashLabel={p.cashLabel}
          name={p.lifetime.name}
          price={marked(copy.lifetime, copy)}
          period={p.lifetime.period}
          badge={p.lifetime.badge}
          valueNote={p.lifetime.valueNote}
          cardCta={withPrice(p.lifetime.cardCta, copy.lifetime)}
          cashCta={p.lifetime.cashCta}
          featuresTitle={p.featuresPremiumTitle}
          features={p.featuresPremium}
          featuresNote={p.featuresPremiumNote}
          oxxoDict={p}
          cashAvailable={cashAvailable}
          highlighted={highlightPremium}
        />
      </div>

      <div className="mt-16">
        <PaymentMethodLogos
          note={cashAvailable ? p.paymentMethodsNote : p.paymentMethodsNoteCardOnly}
          cashAvailable={cashAvailable}
        />
        {/* The one footnote. It carries the whole conversion story — the
            peso base price, who sets the exact amount, that pesos can still
            be chosen at the till, and that a subscription's later charges
            move with the rate — and it is shown only when the figures above
            are conversions. In Mexico, and wherever no rate could be had,
            this sentence would be describing something the reader cannot
            see. */}
        {copy.converted && (
          <p className="mt-3 text-center text-xs text-foreground/50">
            {withBasePrices(p.approxNote, basePricesText(lang))}
          </p>
        )}
      </div>

      <div className="mt-16">
        <PricingFaq heading={p.faqHeading} items={faq} />
      </div>
    </div>
  );
}
