"use client";

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { CustomerInfo } from "@revenuecat/purchases-capacitor";
import { Purchases } from "@revenuecat/purchases-capacitor";
import {
  configureRevenueCat,
  getCustomerInfo,
  isProEntitlementActive,
  loginRevenueCat,
  logoutRevenueCat,
  presentCustomerCenter,
  presentPaywall,
  presentPaywallIfNeeded,
  restorePurchases,
} from "@/lib/revenuecat-client";

interface UseRevenueCatResult {
  /** false on web (this app's browser build stays on Stripe) and while
   * the SDK is still configuring on native. */
  isNative: boolean;
  loading: boolean;
  isPro: boolean;
  customerInfo: CustomerInfo | undefined;
  error: Error | null;
  refresh: () => Promise<void>;
  openPaywall: () => Promise<boolean>;
  openPaywallIfNeeded: () => Promise<boolean>;
  openCustomerCenter: () => Promise<void>;
  restore: () => Promise<void>;
}

/**
 * Configures RevenueCat, links it to `userId` once known, and keeps
 * `isPro` in sync with the on-device CustomerInfo cache — including live
 * updates pushed by RevenueCat's own listener (e.g. after a purchase
 * completes elsewhere, or a subscription renews in the background).
 *
 * On web this is entirely inert (`isNative: false`, `isPro: false`) — PRO
 * status on web comes from the server-rendered Subscription check via
 * src/lib/subscription.ts instead, same as it always has.
 */
export function useRevenueCat(userId: string | null | undefined): UseRevenueCatResult {
  const isNative = Capacitor.isNativePlatform();
  const [loading, setLoading] = useState(isNative);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!isNative) return;
    try {
      const info = await getCustomerInfo();
      setCustomerInfo(info);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to read RevenueCat customer info"));
    }
  }, [isNative]);

  useEffect(() => {
    // isNative reflects Capacitor.isNativePlatform(), which can't change
    // at runtime — the initial useState(isNative) above already covers
    // the web case (loading starts false), so nothing to do here.
    if (!isNative) return;

    let cancelled = false;

    (async () => {
      try {
        await configureRevenueCat();
        if (userId) await loginRevenueCat(userId);
        const info = await getCustomerInfo();
        if (!cancelled) setCustomerInfo(info);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to initialize RevenueCat"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-runs (and re-logs-in) whenever the signed-in user changes — e.g.
    // sign-out followed by a different account signing in on the same
    // device.
  }, [isNative, userId]);

  useEffect(() => {
    if (!isNative) return;

    let listenerId: string | undefined;
    Purchases.addCustomerInfoUpdateListener((info) => setCustomerInfo(info))
      .then((id) => {
        listenerId = id;
      })
      .catch(() => {
        // configure() hasn't resolved yet — the initial getCustomerInfo()
        // call above already covers the first render, this listener is
        // purely for updates after that.
      });

    return () => {
      if (listenerId) {
        Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: listenerId }).catch(() => {});
      }
    };
  }, [isNative]);

  return {
    isNative,
    loading,
    isPro: isProEntitlementActive(customerInfo),
    customerInfo,
    error,
    refresh,
    openPaywall: presentPaywall,
    openPaywallIfNeeded: presentPaywallIfNeeded,
    openCustomerCenter: presentCustomerCenter,
    restore: async () => {
      const info = await restorePurchases();
      setCustomerInfo(info);
    },
  };
}

/** Call from the sign-out handler alongside the existing server-side
 * logout so a shared device's next signed-in user doesn't inherit stale
 * RevenueCat purchase state. */
export { logoutRevenueCat };
