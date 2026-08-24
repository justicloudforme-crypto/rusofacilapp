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
  price: string;
  period: string;
  badge?: string;
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
  onClose,
}: {
  lang: Locale;
  open: boolean;
  reason: "free" | "premium";
  /** Path to return to after a successful Stripe checkout. */
  next: string;
  dict: PaywallModalDict;
  plans: Record<PlanId, PaywallPlanCopy>;
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
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/10 sm:p-8"
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
                  className={`tap flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                    isLifetime
                      ? "border-brand bg-brand/5 hover:bg-brand/10 active:bg-brand/10"
                      : "border-black/10 hover:border-foreground/40 active:border-foreground/40 dark:border-white/10"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium">{plan.name}</span>
                    {plan.badge && <span className="block text-xs text-foreground/50">{plan.badge}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold tracking-tight">
                      {plan.price}
                      <span className="ml-1 text-xs font-normal text-foreground/50">{plan.period}</span>
                    </span>
                  </span>
                </button>
              </form>
            );
          })}
        </div>
      </div>
    </div>
  );
}
