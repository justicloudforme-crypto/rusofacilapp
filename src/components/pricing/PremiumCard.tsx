"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";
import OxxoInstructions, { type OxxoInstructionsDict } from "./OxxoInstructions";

type Method = "card" | "cash";

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
  mxnApprox,
  cardCta,
  cashCta,
  featuresTitle,
  features,
  oxxoDict,
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
  mxnApprox: string;
  cardCta: string;
  cashCta: string;
  featuresTitle: string;
  features: string[];
  oxxoDict: OxxoInstructionsDict;
  /** Set via /pricing?highlight=premium — the profile page's per-plan
   * upsell link (annual subscribers -> "unlock C1 forever") lands here.
   * Purely a visual ring + scroll target (`id="premium"`, browsers
   * auto-scroll to a matching URL fragment natively) — never touches
   * checkout/Stripe, just points at this existing card. */
  highlighted?: boolean;
}) {
  // Cash (OXXO) open by default, same as the monthly/annual cards —
  // see SubscriptionCard.tsx for why.
  const [method, setMethod] = useState<Method>("cash");

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

      <p className="mt-4 flex items-baseline gap-1">
        <span className="whitespace-nowrap text-3xl font-semibold tracking-tight">{price}</span>
        <span className="text-sm text-foreground/60">{period}</span>
      </p>
      <p className="mt-1 text-xs text-foreground/50">{mxnApprox}</p>
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

      <div className="mt-auto pt-8">
        <Tabs
          label={methodLabel}
          items={[
            { id: "card", label: cardLabel },
            { id: "cash", label: cashLabel },
          ]}
          activeId={method}
          onSelect={(id) => setMethod(id as Method)}
        />

        {method === "cash" && <OxxoInstructions dict={oxxoDict} />}

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
