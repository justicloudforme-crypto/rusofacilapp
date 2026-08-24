"use client";

import { useRevenueCat } from "@/hooks/useRevenueCat";

interface NativeSubscriptionPanelProps {
  userId: string;
  dict: {
    heading: string;
    proActive: string;
    proInactive: string;
    manageButton: string;
    upgradeButton: string;
    restoreButton: string;
    errorMessage: string;
  };
}

/**
 * Native-only (iOS/Android app shell) subscription panel, backed by
 * RevenueCat instead of Stripe. Renders nothing on web — this app's
 * browser build keeps using the existing Stripe checkout/cancel flow in
 * the surrounding profile page (see src/app/[lang]/profile/page.tsx),
 * per the store anti-steering rule: native apps must not link out to or
 * even reference web billing.
 *
 * Drop this at the top of the profile page's "subscription" tab section,
 * before the existing Stripe-oriented markup — useRevenueCat's own
 * `isNative` check makes it a safe no-op addition on web.
 */
export default function NativeSubscriptionPanel({ userId, dict }: NativeSubscriptionPanelProps) {
  const { isNative, loading, isPro, error, openPaywall, openCustomerCenter, restore } =
    useRevenueCat(userId);

  if (!isNative) return null;

  if (loading) {
    return (
      <section className="rounded-2xl border border-black/10 p-5 dark:border-white/10 sm:p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-black/10 dark:bg-white/10" />
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-black/10 p-5 dark:border-white/10 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">{dict.heading}</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isPro
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-black/5 text-foreground/70 dark:bg-white/10"
          }`}
        >
          {isPro ? dict.proActive : dict.proInactive}
        </span>
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{dict.errorMessage}</p>}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {isPro ? (
          <button
            type="button"
            onClick={() => void openCustomerCenter()}
            className="w-full rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] sm:w-auto"
          >
            {dict.manageButton}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void openPaywall()}
            className="w-full rounded-full bg-foreground px-5 py-2.5 text-center text-sm font-medium text-background transition-colors hover:bg-foreground/85 sm:w-auto"
          >
            {dict.upgradeButton}
          </button>
        )}
        <button
          type="button"
          onClick={() => void restore()}
          className="w-full rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] sm:w-auto"
        >
          {dict.restoreButton}
        </button>
      </div>
    </section>
  );
}
