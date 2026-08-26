"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";

type Period = "monthly" | "annual";

export interface BillingOption {
  price: string;
  period: string;
  badge?: string;
  perMonthNote?: string;
  cardCta: string;
}

// The one recommended tile on the page (Card tone="primary" + shadow +
// slight scale-up, same "highlighted" treatment the old 3-card layout
// used) — every other CTA on the page is outline, so this is the only
// primary button, per the "one accent color" rule.
export default function SubscriptionCard({
  lang,
  next,
  periodLabel,
  monthLabel,
  yearLabel,
  monthly,
  annual,
  featuresTitle,
  features,
}: {
  lang: string;
  next?: string;
  periodLabel: string;
  monthLabel: string;
  yearLabel: string;
  monthly: BillingOption;
  annual: BillingOption;
  featuresTitle: string;
  features: string[];
}) {
  // Annual by default — it's the plan this card exists to steer people
  // toward (−50% badge), not a neutral middle ground.
  const [period, setPeriod] = useState<Period>("annual");
  const option = period === "monthly" ? monthly : annual;

  return (
    <Card
      tone="primary"
      padding="lg"
      shadow
      className="relative flex h-full flex-col border-2 sm:scale-[1.03]"
    >
      {option.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-folk-red px-3 py-1 text-xs font-semibold text-white shadow-sm">
          {option.badge}
        </span>
      )}

      <Tabs
        label={periodLabel}
        items={[
          { id: "monthly", label: monthLabel },
          { id: "annual", label: yearLabel },
        ]}
        activeId={period}
        onSelect={(id) => setPeriod(id as Period)}
      />

      <p className="mt-5 flex items-baseline gap-1">
        <span className="whitespace-nowrap text-3xl font-semibold tracking-tight">{option.price}</span>
        <span className="text-sm text-foreground/60">{option.period}</span>
      </p>
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

      <form action="/api/checkout" method="POST" className="mt-auto pt-8">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="plan" value={period} />
        <input type="hidden" name="method" value="card" />
        {next && <input type="hidden" name="next" value={next} />}
        <Button type="submit" variant="primary" fullWidth haptic={false}>
          {option.cardCta}
        </Button>
      </form>
    </Card>
  );
}
