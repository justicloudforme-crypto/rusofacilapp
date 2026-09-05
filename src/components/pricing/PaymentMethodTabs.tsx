"use client";

import Tabs from "@/components/ui/Tabs";
import { CardGlyph, CashGlyph } from "./PaymentMethodLogos";

export type Method = "card" | "cash";

/**
 * The card/cash switch on a paid pricing card.
 *
 * Shown only where cash can actually be paid — that is Mexico and nowhere
 * else (PROGRESS.md 7.117), and the decision is the caller's.
 *
 * Since 10.09.2026 the card is the method a Mexican buyer lands on, not
 * cash (PROGRESS.md 7.121). That moves "Efectivo" from the FILLED pill to
 * the plain one, and the whole risk of the change is right there: in Mexico
 * cash is the only way some buyers can pay at all, so the tab has to stay
 * just as findable as when it was the selected one. Two things carry that,
 * and both are asserted in e2e/pricing-payment-methods.spec.ts rather than
 * assumed:
 *
 *   1. GEOMETRY. Both pills are `grow` inside the strip, so they split the
 *      row in half — the unselected tab is the same 44px-tall, same-width
 *      target it was when it was selected. Nothing shrank, nothing moved
 *      behind a menu, nothing became hover-only.
 *   2. A MARK THAT IS NOT COLOR. The selected pill announces itself with a
 *      fill; the unselected one has no fill to announce itself with, so
 *      each tab now carries its own glyph — a banknote for cash, a card for
 *      the card. The banknote is the same drawing the trust row under the
 *      cards and the OXXO instructions use, so "cash" is recognisable on
 *      this page before its label is read.
 *
 * The glyphs are handed `h-4 w-4` with no colour of their own so they
 * inherit the pill's `currentColor`: white on the selected tab, the same
 * `text-foreground/70` as the label on the other.
 */
export default function PaymentMethodTabs({
  label,
  cardLabel,
  cashLabel,
  method,
  onSelect,
}: {
  label: string;
  cardLabel: string;
  cashLabel: string;
  method: Method;
  onSelect: (method: Method) => void;
}) {
  return (
    <Tabs
      label={label}
      items={[
        { id: "card", label: cardLabel, icon: <CardGlyph className="h-4 w-4" /> },
        { id: "cash", label: cashLabel, icon: <CashGlyph className="h-4 w-4" /> },
      ]}
      activeId={method}
      onSelect={(id) => onSelect(id as Method)}
    />
  );
}
