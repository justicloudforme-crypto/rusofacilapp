"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import OxxoInstructions, { type OxxoInstructionsDict } from "./OxxoInstructions";
import PaymentMethodTabs, { type Method } from "./PaymentMethodTabs";

// Gold stays on decorative elements only (border/badge) — the button
// itself is primary, same as every other CTA on the page, per the
// premium-is-never-clickable rule (enforced by check:tokens).
export default function PremiumCard({
  lang,
  methodLabel,
  cardLabel,
  cashLabel,
  name,
  price,
  period,
  badge,
  valueNote,
  cardCta,
  cashCta,
  featuresTitle,
  features,
  featuresNote,
  oxxoDict,
  cashAvailable,
  highlighted = false,
}: {
  lang: string;
  methodLabel: string;
  cardLabel: string;
  cashLabel: string;
  name: string;
  price: string;
  period: string;
  badge?: string;
  valueNote: string;
  cardCta: string;
  cashCta: string;
  featuresTitle: string;
  features: string[];
  /** One line under the feature list saying what Premium does NOT add.
   * The card sells "nivel C1", and the course stops at B2 — without this
   * sentence a buyer can reasonably read the C1 bullet as "there are C1
   * lessons too". See PROGRESS.md 7.76. */
  featuresNote: string;
  oxxoDict: OxxoInstructionsDict;
  /** Whether this visitor is in the one country where an OXXO voucher can
   * be paid — see SubscriptionCard.tsx and PROGRESS.md 7.117. */
  cashAvailable: boolean;
  /** Set via /pricing?highlight=premium — the profile page's per-plan
   * upsell link (annual subscribers -> "unlock C1 forever") lands here.
   * Purely a visual ring + scroll target (`id="premium"`, browsers
   * auto-scroll to a matching URL fragment natively) — never touches
   * checkout/Stripe, just points at this existing card. */
  highlighted?: boolean;
}) {
  // The card opens; cash is one tap away and no less visible for it —
  // same as the monthly/annual cards, see SubscriptionCard.tsx and
  // PaymentMethodTabs.tsx for why (PROGRESS.md 7.121).
  const [method, setMethod] = useState<Method>("card");

  return (
    <Card
      id="premium"
      tone="premium"
      padding="lg"
      shadow
      className={`relative flex h-full flex-col ${highlighted ? "ring-2 ring-premium-500 ring-offset-2 ring-offset-background" : ""}`}
    >
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-premium-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
          <span aria-hidden>👑 </span>
          {badge}
        </span>
      )}
      <h2 className="text-lg font-medium">{name}</h2>

      {/* flex-WRAP, and it is not decoration. At 1024 the pricing grid goes
          to four columns, which leaves each card 178px of content; the price
          is `whitespace-nowrap` (rightly — "169,99 US$" must not break), and
          in Russian the period beside it is long enough that the two
          together do not fit. Without wrapping the period span was pushed
          out of the card and out of the page: /ru/pricing measured 1063px of
          document in a 1024px viewport, with that 89px span sitting at
          x=974–1063. Found 02.09.2026 by the widened width sweep — it is
          older than this pass, and every width the sweep had before stopped
          at 768, where the grid is only two columns wide. */}
      <p className="mt-4 flex flex-wrap items-baseline gap-x-1">
        <span className="whitespace-nowrap text-3xl font-semibold tracking-tight">{price}</span>
        <span className="text-sm text-foreground/60">{period}</span>
      </p>
      <p className="mt-1.5 text-xs text-premium-700 dark:text-premium-300">{valueNote}</p>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-foreground/50">{featuresTitle}</p>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-foreground/70">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span aria-hidden>✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-5 text-foreground/60">{featuresNote}</p>

      <div className="mt-auto pt-8">
        {cashAvailable && (
          <>
            <PaymentMethodTabs
              label={methodLabel}
              cardLabel={cardLabel}
              cashLabel={cashLabel}
              method={method}
              onSelect={setMethod}
            />

            {method === "cash" && <OxxoInstructions dict={oxxoDict} />}
          </>
        )}

        <form action="/api/checkout" method="POST" className="mt-4">
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="plan" value="lifetime" />
          <input type="hidden" name="method" value={method === "cash" ? "oxxo" : "card"} />
          <Button type="submit" variant="primary" fullWidth haptic={false}>
            {method === "cash" ? cashCta : cardCta}
          </Button>
        </form>
      </div>
    </Card>
  );
}
