"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import OxxoInstructions, { type OxxoInstructionsDict } from "./OxxoInstructions";
import PaymentMethodTabs, { type Method } from "./PaymentMethodTabs";

type Plan = "monthly" | "annual";

export interface BillingOption {
  name: string;
  /** The ONE figure on the card. Since 09.09.2026 that is the visitor's own
   * currency where there is one to quote — "≈ 11,70 SGD*", asterisk and all
   * — and the peso price everywhere else (Mexico, an unlisted or unknown
   * country, a rate feed that did not answer). Composed on the server in
   * /pricing; see src/lib/pricing-display.ts. */
  price: string;
  period: string;
  badge?: string;
  perMonthNote?: string;
  /** Already carries the figure above it — the dictionary holds
   * "Empezar por {price}/mes" and the page fills the slot, so the button and
   * the price cannot name two different currencies. */
  cardCta: string;
  /** Always in pesos, and correctly so: cash is an OXXO voucher, and an
   * OXXO voucher is only ever offered to a buyer in Mexico. */
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
  cashAvailable,
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
  /** Whether this visitor is in the one country where an OXXO voucher can
   * be paid. False hides the method tabs and the instructions entirely
   * rather than leaving them one tap away — see PROGRESS.md 7.117. */
  cashAvailable: boolean;
  recommended?: boolean;
}) {
  // The CARD is what opens, in every country including Mexico — changed
  // 10.09.2026, PROGRESS.md 7.121. Cash used to open in Mexico, which meant
  // every Mexican buyer met four steps about walking to a shop before the
  // button they were most likely to press. The instructions are long
  // BECAUSE cash needs them, and that is an argument for showing them when
  // cash is chosen, not for choosing cash for everybody.
  //
  // What did NOT change: whether the cash tab is there and how visible it
  // is. See PaymentMethodTabs.
  const [method, setMethod] = useState<Method>("card");

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
