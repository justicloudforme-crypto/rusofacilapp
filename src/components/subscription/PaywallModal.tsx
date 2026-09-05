"use client";

import { useEffect } from "react";
import type { Locale } from "@/i18n/config";
import type { PlanId } from "@/lib/plans";

export interface PaywallModalDict {
  titleFree: string;
  subtitleFree: string;
  titlePremium: string;
  subtitlePremium: string;
  closeLabel: string;
  choosePlanCta: string;
}

export interface PaywallPlanCopy {
  name: string;
  /** The ONE figure shown for this plan — the visitor's own currency with
   * "≈" and a footnote asterisk where there is one to quote, the peso price
   * otherwise (Mexico, an unlisted or unknown country, a silent rate feed).
   * Built on the server; see src/lib/pricing-display.ts and PROGRESS.md
   * 7.120. */
  price: string;
  period: string;
  badge?: string;
  /** Lifetime-only cost-comparison line (see dict.pricing.lifetime.valueNote),
   * shown under its button so the "why pay more upfront" case is made right
   * where the decision happens, not just on /pricing. */
  valueNote?: string;
}

/**
 * Web-only paywall overlay (native uses RevenueCat's own dashboard-designed
 * paywall sheet instead — see PaywallContext). Reuses the same three Stripe
 * plans/copy as /pricing rather than inventing separate paywall-specific
 * pricing text, so a "buy" tap here posts to the same /api/checkout the
 * pricing page uses — including `next`, so a successful purchase returns
 * the visitor to the page that triggered this modal instead of always
 * landing on /profile.
 *
 * `reason` distinguishes the two triggers this modal covers: "free" (the
 * free-trial sample is exhausted — any plan unlocks the content) vs.
 * "premium" (the visitor already has an active monthly/annual subscription,
 * but this specific content is Premium/lifetime-exclusive — only the
 * lifetime plan actually unlocks it, so it's visually emphasized).
 */
export default function PaywallModal({
  lang,
  open,
  reason,
  next,
  dict,
  plans,
  priceNote,
  onClose,
}: {
  lang: Locale;
  open: boolean;
  reason: "free" | "premium";
  /** Path to return to after a successful Stripe checkout. */
  next: string;
  dict: PaywallModalDict;
  plans: Record<PlanId, PaywallPlanCopy>;
  /** The single conversion footnote, at the foot of the modal because the
   * modal is the whole surface while it is open. Undefined when the figures
   * above are not conversions. */
  priceNote?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const planOrder: PlanId[] = reason === "premium" ? ["lifetime", "annual", "monthly"] : ["monthly", "annual", "lifetime"];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={reason === "premium" ? dict.titlePremium : dict.titleFree}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/30 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={dict.closeLabel}
          className="tap absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-foreground/50 hover:bg-black/5 hover:text-foreground active:bg-black/5 dark:hover:bg-white/10"
        >
          ✕
        </button>

        <div className="pr-8">
          <h2 className="text-lg font-semibold tracking-tight">
            {reason === "premium" ? dict.titlePremium : dict.titleFree}
          </h2>
          <p className="mt-2 text-sm text-foreground/70">
            {reason === "premium" ? dict.subtitlePremium : dict.subtitleFree}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {planOrder.map((planId) => {
            const plan = plans[planId];
            const isLifetime = planId === "lifetime";
            return (
              <form key={planId} action="/api/checkout" method="POST">
                <input type="hidden" name="lang" value={lang} />
                <input type="hidden" name="plan" value={planId} />
                <input type="hidden" name="method" value="card" />
                <input type="hidden" name="next" value={next} />
                <button
                  type="submit"
                  className={`tap flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    isLifetime
                      ? "border-primary/40 bg-primary/5 hover:bg-primary/10 active:bg-primary/10"
                      : "border-black/10 hover:border-foreground/40 active:border-foreground/40 dark:border-white/30"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium">
                      {isLifetime && <span aria-hidden>👑 </span>}
                      {plan.name}
                    </span>
                    {plan.badge && <span className="block text-xs text-foreground/50">{plan.badge}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-right text-sm font-semibold tracking-tight">
                      {/* The figure in its own element, so it can be read
                          back whole. e2e/paywall-modal.spec.ts compares it
                          character for character with the figure on
                          /pricing for the same country (PROGRESS.md
                          7.122); with the price and the period sharing one
                          node there was nothing to compare but a substring. */}
                      <span data-plan-price>{plan.price}</span>
                      <span className="ml-1 text-xs font-normal text-foreground/50">{plan.period}</span>
                    </span>
                  </span>
                </button>
                {isLifetime && plan.valueNote && (
                  <p className="mt-1.5 px-1 text-xs text-amber-600 dark:text-amber-400">{plan.valueNote}</p>
                )}
              </form>
            );
          })}
        </div>

        {priceNote && <p className="text-xs leading-5 text-foreground/50">{priceNote}</p>}
      </div>
    </div>
  );
}
