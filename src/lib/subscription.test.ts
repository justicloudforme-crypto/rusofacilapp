import { describe, expect, it, vi } from "vitest";

// isSubscriptionActive is pure, but the module also imports ./db, which
// opens a real better-sqlite3 connection as a side effect of import —
// mocked out so this stays a fast, isolated unit test instead of an
// implicit integration test against whatever dev.db happens to exist.
vi.mock("./db", () => ({ db: {} }));

const { isSubscriptionActive } = await import("./subscription");

function subscription(overrides: { status: string; currentPeriodEnd: Date }) {
  return overrides;
}

describe("isSubscriptionActive", () => {
  it("is false when there is no subscription at all", () => {
    expect(isSubscriptionActive(null)).toBe(false);
    expect(isSubscriptionActive(undefined)).toBe(false);
  });

  it("is true for an active subscription with a future period end", () => {
    const sub = subscription({ status: "active", currentPeriodEnd: new Date(Date.now() + 86_400_000) });
    expect(isSubscriptionActive(sub)).toBe(true);
  });

  it("is true for a trialing subscription with a future period end", () => {
    const sub = subscription({ status: "trialing", currentPeriodEnd: new Date(Date.now() + 86_400_000) });
    expect(isSubscriptionActive(sub)).toBe(true);
  });

  it("is false once currentPeriodEnd has passed, even if status is still active", () => {
    // The webhook that would flip status hasn't necessarily arrived yet —
    // access must expire on the clock, not wait for Stripe.
    const sub = subscription({ status: "active", currentPeriodEnd: new Date(Date.now() - 1000) });
    expect(isSubscriptionActive(sub)).toBe(false);
  });

  it("is false for explicitly inactive statuses regardless of period end", () => {
    for (const status of ["canceled", "past_due", "incomplete_expired"]) {
      const sub = subscription({ status, currentPeriodEnd: new Date(Date.now() + 86_400_000) });
      expect(isSubscriptionActive(sub)).toBe(false);
    }
  });

  it("is false for an unrecognized status even with a future period end", () => {
    const sub = subscription({ status: "unpaid", currentPeriodEnd: new Date(Date.now() + 86_400_000) });
    expect(isSubscriptionActive(sub)).toBe(false);
  });
});
