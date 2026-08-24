"use client";

import { usePaywall } from "@/contexts/PaywallContext";

/** Shown wherever a flashcard/idiom fetch comes back `limited: true` — the
 * visitor is on the free trial sample (FREE_TRIAL_LIMITS in entitlement.ts)
 * rather than the full set. Opens the paywall with reason "free" (not
 * "premium" — any active subscription already lifts this cap). */
export default function FreeTrialLimitBanner({
  message,
  cta,
}: {
  message: string;
  cta: string;
}) {
  const { openPaywall } = usePaywall();

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand/5 px-4 py-3 dark:border-brand-light/30 dark:bg-brand-light/10">
      <p className="text-sm text-foreground/80">{message}</p>
      <button
        type="button"
        onClick={() => openPaywall("free")}
        className="tap shrink-0 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
      >
        {cta}
      </button>
    </div>
  );
}
