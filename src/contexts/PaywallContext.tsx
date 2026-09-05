"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import type { Locale } from "@/i18n/config";
import type { PlanId } from "@/lib/plans";
import { useRevenueCat } from "@/hooks/useRevenueCat";
import PaywallModal, { type PaywallModalDict, type PaywallPlanCopy } from "@/components/subscription/PaywallModal";

export type PaywallReason = "free" | "premium";

interface PaywallContextValue {
  /** Opens the paywall — native presents RevenueCat's own dashboard
   * paywall sheet and, on a successful purchase/restore, refreshes the
   * current route's server data in place (no full app reload); web opens
   * the in-page modal, whose plan buttons redirect through Stripe Checkout
   * and back to the current page via `next`. */
  openPaywall: (reason?: PaywallReason) => void;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

// Once a native purchase/restore resolves, the RevenueCat webhook still
// needs a moment to land and write the Subscription row this app's server
// components actually read — same propagation gap
// e2e/helpers/auth.ts already retries around for the test suite. Polling
// briefly here means router.refresh() below reliably shows unlocked
// content on the first try instead of occasionally needing a second tap.
const STATUS_POLL_ATTEMPTS = 5;
const STATUS_POLL_DELAY_MS = 700;

async function waitForNonFreeTier(): Promise<void> {
  for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt++) {
    try {
      const res = await fetch("/api/subscription/status", { cache: "no-store" });
      if (res.ok) {
        const body = (await res.json()) as { tier?: string };
        if (body.tier && body.tier !== "free") return;
      }
    } catch {
      // Network hiccup — fall through to the next attempt/backoff.
    }
    await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_DELAY_MS));
  }
}

export function PaywallProvider({
  lang,
  userId,
  dict,
  plans,
  priceNote,
  children,
}: {
  lang: Locale;
  userId: string | null;
  dict: PaywallModalDict;
  plans: Record<PlanId, PaywallPlanCopy>;
  /** The conversion footnote, or undefined when the prices above it are
   * already in the reader's own money (Mexico) or could not be converted.
   * Built on the server — see src/lib/pricing-display.ts. */
  priceNote?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<PaywallReason>("free");
  const { isNative, openPaywall: presentNativePaywall } = useRevenueCat(userId);

  const openPaywall = useCallback(
    (nextReason: PaywallReason = "free") => {
      if (isNative || Capacitor.isNativePlatform()) {
        void (async () => {
          const purchased = await presentNativePaywall();
          if (purchased) {
            await waitForNonFreeTier();
            router.refresh();
          }
        })();
        return;
      }
      setReason(nextReason);
      setOpen(true);
    },
    [isNative, presentNativePaywall, router]
  );

  const value = useMemo<PaywallContextValue>(() => ({ openPaywall }), [openPaywall]);

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <PaywallModal
        lang={lang}
        open={open}
        reason={reason}
        next={pathname}
        dict={dict}
        plans={plans}
        priceNote={priceNote}
        onClose={() => setOpen(false)}
      />
    </PaywallContext.Provider>
  );
}

/** Call from any client component to trigger the paywall — e.g. when a
 * gated fetch comes back `limited: true`/403, or when the user taps a
 * visibly Premium-locked tile (★ word game, C1 category). Pass
 * reason: "premium" when the visitor already has an active subscription
 * but this specific content needs the Premium/lifetime plan specifically. */
export function usePaywall(): PaywallContextValue {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall must be used within a PaywallProvider");
  return ctx;
}
