"use client";

import { Capacitor } from "@capacitor/core";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from "@revenuecat/purchases-capacitor";
import { RevenueCatUI, PaywallResultEnum } from "@revenuecat/purchases-capacitor-ui";

// The single entitlement identifier configured in the RevenueCat dashboard
// that gates the whole app's PRO course content — mirrors what the
// EXPIRATION/CANCELLATION webhook handlers in
// src/app/api/webhooks/revenuecat/route.ts ultimately drive on the backend
// Subscription row, but read here directly from the on-device
// CustomerInfo cache so native screens don't need a round trip to our API
// just to know if a purchase went through.
export const PRO_ENTITLEMENT_ID = "rusofácilapp_pro";

// RevenueCat public SDK keys (unlike REVENUECAT_WEBHOOK_SECRET, which is
// server-only) are meant to ship inside the app binary — that's how every
// native RevenueCat integration works. Still routed through env vars
// rather than hardcoded so a test-mode key never has to be swapped by hand
// in this file before a store submission.
const IOS_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY;
const ANDROID_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY;

let configured = false;

function currentPlatformApiKey(): string | undefined {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") return IOS_API_KEY;
  if (platform === "android") return ANDROID_API_KEY;
  return undefined;
}

/**
 * Configures the RevenueCat SDK. Must be called once before any other
 * Purchases call. Safe to call multiple times (idempotent) and a no-op on
 * web — this app's browser build stays on Stripe (see
 * src/lib/stripe.ts) and only the native shells use store billing at all.
 */
export async function configureRevenueCat(): Promise<void> {
  if (!Capacitor.isNativePlatform() || configured) return;

  const apiKey = currentPlatformApiKey();
  if (!apiKey) {
    // Matches the rest of this project's "leave blank to run in
    // local/demo mode" convention (see .env.example) rather than
    // throwing — a dev running the app without store keys configured yet
    // shouldn't get a hard crash on every screen.
    console.warn("[revenuecat] No API key configured for this platform — skipping configure().");
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
  }

  await Purchases.configure({ apiKey });
  configured = true;
}

/**
 * Links the RevenueCat anonymous user to our own account id, the same
 * appUserID the /api/webhooks/revenuecat handler expects in
 * `event.app_user_id` — call this right after a user signs in so purchase
 * events land on the correct account from the very first purchase.
 */
export async function loginRevenueCat(userId: string): Promise<CustomerInfo | undefined> {
  if (!Capacitor.isNativePlatform() || !configured) return undefined;
  const { customerInfo } = await Purchases.logIn({ appUserID: userId });
  return customerInfo;
}

/**
 * Reverts to an anonymous RevenueCat user — call this on sign-out so a
 * shared device never lets the next signed-in user inherit the previous
 * user's purchase state.
 */
export async function logoutRevenueCat(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !configured) return;
  await Purchases.logOut();
}

export async function getCustomerInfo(): Promise<CustomerInfo | undefined> {
  if (!Capacitor.isNativePlatform() || !configured) return undefined;
  const { customerInfo } = await Purchases.getCustomerInfo();
  return customerInfo;
}

export function isProEntitlementActive(customerInfo: CustomerInfo | undefined): boolean {
  if (!customerInfo) return false;
  return customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
}

export async function restorePurchases(): Promise<CustomerInfo | undefined> {
  if (!Capacitor.isNativePlatform() || !configured) return undefined;
  const { customerInfo } = await Purchases.restorePurchases();
  return customerInfo;
}

/** The "default" Offering, containing the lifetime / yearly / monthly
 * Packages configured in the RevenueCat dashboard. Offerings and Packages
 * are dashboard config, not something defined in this codebase — this
 * just fetches whatever is currently live there. */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!Capacitor.isNativePlatform() || !configured) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

/**
 * Presents RevenueCat's dashboard-designed Paywall UI (native screen, not
 * anything rendered by this app) only if the user doesn't already have
 * the PRO entitlement — the standard "gate this screen" call. Returns
 * true if the user ends up entitled after the sheet closes (purchased,
 * restored, or already had it), false if they dismissed it without
 * unlocking access.
 */
export async function presentPaywallIfNeeded(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !configured) return false;
  const { result } = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
  });
  return result === PaywallResultEnum.PURCHASED || result === PaywallResultEnum.RESTORED || result === PaywallResultEnum.NOT_PRESENTED;
}

/** Presents the same Paywall UI unconditionally — for an explicit
 * "Ver planes" / upgrade button rather than a gate. */
export async function presentPaywall(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !configured) return false;
  const { result } = await RevenueCatUI.presentPaywall();
  return result === PaywallResultEnum.PURCHASED || result === PaywallResultEnum.RESTORED;
}

/**
 * Presents RevenueCat's Customer Center (manage/cancel subscription,
 * request a refund, see billing history) — all native store-billing
 * management, so it only makes sense for a `provider: "revenuecat"`
 * subscription. A Stripe subscriber on web keeps using the existing
 * billing-portal flow instead (see src/lib/stripe.ts) — the two never
 * overlap for the same user, since a subscription's provider is fixed at
 * the point of purchase.
 */
export async function presentCustomerCenter(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !configured) return;
  await RevenueCatUI.presentCustomerCenter();
}

/** Not currently used directly by any screen (the Paywall UI purchases
 * packages internally), but kept exported for a future custom purchase
 * button that bypasses the dashboard Paywall UI. */
export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  return customerInfo;
}
