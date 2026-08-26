"use client";

import { usePaywall, type PaywallReason } from "@/contexts/PaywallContext";

/** Shown wherever a flashcard/idiom fetch comes back `limited: true` — the
 * visitor is on the free trial sample (FREE_TRIAL_LIMITS in entitlement.ts)
 * rather than the full set. Also reused for the "literary" idiom
 * category's own tier cap (see getLiteraryIdiomLimit in entitlement.ts),
 * which can apply to an already-subscribed "standard" visitor — pass
 * `reason: "premium"` for that case so the paywall emphasizes the
 * lifetime plan specifically rather than "free" (any plan). */
export default function FreeTrialLimitBanner({
  message,
  cta,
  reason = "free",
}: {
  message: string;
  cta: string;
  reason?: PaywallReason;
}) {
  const { openPaywall } = usePaywall();

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 dark:border-primary-400/30 dark:bg-primary-400/10">
      <p className="text-sm text-foreground/80">{message}</p>
      <button
        type="button"
        onClick={() => openPaywall(reason)}
        className="tap shrink-0 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
      >
        {cta}
      </button>
    </div>
  );
}
