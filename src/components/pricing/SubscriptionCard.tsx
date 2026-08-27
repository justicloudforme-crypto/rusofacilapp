"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";
import OxxoInstructions, { type OxxoInstructionsDict } from "./OxxoInstructions";

type Method = "card" | "cash";
type Plan = "monthly" | "annual";

export interface BillingOption {
  name: string;
  price: string;
  period: string;
  badge?: string;
  perMonthNote?: string;
  mxnApprox: string;
  cardCta: string;
  cashCta: string;
}

// One card per subscription plan (monthly or annual) — the old
// Month/Year toggle inside a single card was replaced by two
// independent, always-visible cards (see /docs, pricing 4-column
// restructure) so both prices are comparable at a glance instead of
// hidden behind a switch. `recommended` carries the old toggle
// version's "primary" tile treatment (tone, shadow, scale-up, border)
// over to whichever plan should stand out — the annual plan today,
// via its −50% badge.
export default function SubscriptionCard({
  lang,
  next,
  plan,
  methodLabel,
  cardLabel,
  cashLabel,
  option,
  featuresTitle,
  features,
  oxxoDict,
  recommended = false,
}: {
  lang: string;
  next?: string;
  plan: Plan;
  methodLabel: string;
  cardLabel: string;
  cashLabel: string;
  option: BillingOption;
  featuresTitle: string;
  features: string[];
  oxxoDict: OxxoInstructionsDict;
  recommended?: boolean;
}) {
  // Cash (OXXO) open by default on every paid card, matching the
  // pattern already used across the pricing page — cash requires
  // reading a multi-step instructions block before paying, so it
  // should never be one extra tap away from a card-only assumption.
  const [method, setMethod] = useState<Method>("cash");

  return (
    <Card
      tone={recommended ? "primary" : "neutral"}
      padding="lg"
      shadow={recommended}
      className={`relative flex h-full flex-col ${recommended ? "border-2 sm:scale-[1.03]" : ""}`}
    >
      {option.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-folk-red px-3 py-1 text-xs font-semibold text-white shadow-sm">
          {option.badge}
        </span>
      )}

      <h2 className="text-lg font-medium">{option.name}</h2>

      <p className="mt-4 flex items-baseline gap-1">
        <span className="whitespace-nowrap text-3xl font-semibold tracking-tight">{option.price}</span>
        <span className="text-sm text-foreground/60">{option.period}</span>
      </p>
      <p className="mt-1 text-xs text-foreground/50">{option.mxnApprox}</p>
      {option.perMonthNote && <p className="mt-1 text-xs text-foreground/60">{option.perMonthNote}</p>}

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
          <input type="hidden" name="plan" value={plan} />
          <input type="hidden" name="method" value={method === "cash" ? "oxxo" : "card"} />
          {next && <input type="hidden" name="next" value={next} />}
          <Button type="submit" variant="primary" fullWidth haptic={false}>
            {method === "cash" ? option.cashCta : option.cardCta}
          </Button>
        </form>
      </div>
    </Card>
  );
}
