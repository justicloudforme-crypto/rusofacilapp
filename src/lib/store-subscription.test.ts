import { describe, expect, it } from "vitest";
import { hasRenewingStoreSubscription } from "./store-subscription";

// 7.242, долг 344: кому показывать «сначала отмените подписку в Google Play».
describe("hasRenewingStoreSubscription", () => {
  const future = new Date(Date.now() + 30 * 86_400_000);
  const base = { provider: "revenuecat", plan: "monthly", status: "active", currentPeriodEnd: future, canceledAt: null };

  it("подписка Google Play, которая продлевается, — да", () => {
    expect(hasRenewingStoreSubscription([base])).toBe(true);
    expect(hasRenewingStoreSubscription([{ ...base, status: "trialing" }])).toBe(true);
  });

  it("продление уже отменено в Google Play — нет", () => {
    expect(hasRenewingStoreSubscription([{ ...base, canceledAt: new Date() }])).toBe(false);
  });

  it("Premium — разовая покупка, продлевать нечему — нет", () => {
    expect(hasRenewingStoreSubscription([{ ...base, plan: "lifetime" }])).toBe(false);
  });

  it("подписка сайта отменяется удалением сама — нет", () => {
    expect(hasRenewingStoreSubscription([{ ...base, provider: "stripe" }])).toBe(false);
  });

  it("истёкшая — нет; среди нескольких строк решает любая продлеваемая", () => {
    const expired = { ...base, currentPeriodEnd: new Date(Date.now() - 86_400_000) };
    expect(hasRenewingStoreSubscription([expired])).toBe(false);
    expect(hasRenewingStoreSubscription([{ ...base, provider: "stripe" }, base])).toBe(true);
    expect(hasRenewingStoreSubscription(null)).toBe(false);
  });
});
