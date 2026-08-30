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

// ---------------------------------------------------------------------------
// extendOrGrantSubscription: what a grant does to the STORED PLAN, which is
// the only thing getEntitlementTier reads to decide Premium vs standard.
// ---------------------------------------------------------------------------

describe("extendOrGrantSubscription and the stored plan", () => {
  const DAY = 86_400_000;

  async function run(existing: { id: string; plan: string; status: string; currentPeriodEnd: Date } | null, plan: string) {
    // Typed through vi.fn's type parameter rather than left bare: without a
    // signature `mock.calls` is an empty tuple and reading `[0][0].data`
    // does not typecheck (`npm run verify` runs tsc over the tests too).
    type Write = (args: { where?: unknown; data: Record<string, unknown> }) => Promise<unknown>;
    const update = vi.fn<Write>(async () => ({}));
    const create = vi.fn<Write>(async () => ({}));
    const findFirst = vi.fn(async () => existing);
    vi.resetModules();
    vi.doMock("./db", () => ({ db: { subscription: { findFirst, update, create } } }));
    // The 30s TtlCache in front of getLatestSubscription is a globalThis
    // singleton, so a fresh module registry is not enough on its own — a
    // second case would read the first case's row. Give each run its own
    // user id instead of trying to reach into the cache.
    const mod = await import("./subscription");
    await mod.extendOrGrantSubscription(`user-${Math.random()}`, 30, plan);
    return { update, create };
  }

  function active(plan: string) {
    return { id: "sub-1", plan, status: "active", currentPeriodEnd: new Date(Date.now() + 10 * DAY) };
  }

  it("raises a live standard subscription to Premium when a lifetime purchase is granted", async () => {
    // THE PRODUCTION BUG this guards. The Stripe webhook calls this helper
    // with "lifetime" when a Premium purchase is paid — by card and by OXXO
    // alike. A customer who already had an active monthly plan used to keep
    // `plan: "monthly"`, so getEntitlementTier kept answering "standard" and
    // the Premium content they had just paid for stayed locked, with nothing
    // anywhere reporting a failure. PROGRESS.md 7.55.
    const { update, create } = await run(active("monthly"), "lifetime");
    expect(create).not.toHaveBeenCalled();
    expect(update.mock.calls[0]?.[0]?.data?.plan).toBe("lifetime");
  });

  it("raises it from any other live plan too — referral days and admin grants included", async () => {
    for (const from of ["annual", "referral", "manual", "e2e-test"]) {
      const { update } = await run(active(from), "lifetime");
      expect(update.mock.calls[0]?.[0]?.data?.plan, `upgrading from ${from}`).toBe("lifetime");
    }
  });

  // The other half of the rule, and the reason this is not just "always
  // overwrite the plan": everything that adds days carries its own plan id,
  // and none of them may demote somebody who paid for Premium.
  it("never demotes a live Premium subscription when days are added to it", async () => {
    for (const grant of ["referral", "manual", "monthly", "annual"]) {
      const { update } = await run(active("lifetime"), grant);
      expect(update.mock.calls[0]?.[0]?.data, `granting ${grant} on top of lifetime`).not.toHaveProperty("plan");
    }
  });

  it("still writes the plan it was given when there is nothing active to extend", async () => {
    const { create, update } = await run(null, "lifetime");
    expect(update).not.toHaveBeenCalled();
    expect(create.mock.calls[0]?.[0]?.data?.plan).toBe("lifetime");
  });

  it("extends the period in every case", async () => {
    const { update } = await run(active("monthly"), "referral");
    expect(update.mock.calls[0]?.[0]?.data?.currentPeriodEnd).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// reportPremiumPaymentNotApplied: the failure the fix above prevents used to
// be COMPLETELY silent — successful payment, 200 from the webhook, no
// exception, no log line, and a customer with no Premium access. These tests
// are about the alarm, not the fix: they check that a mismatch reaches Sentry
// as an error, and — just as important — that a normal payment does not.
// ---------------------------------------------------------------------------

describe("reportPremiumPaymentNotApplied", () => {
  const DAY = 86_400_000;

  /** Runs the read-back against a database that returns `stored` as the
   * user's latest row, with Sentry replaced by a spy. `stored` is what the
   * grant LEFT BEHIND, which is the whole point: the check reads the
   * database back rather than trusting what the writer meant to do. */
  async function run(
    stored: { id: string; plan: string; status: string; currentPeriodEnd: Date } | null,
    paidPlan: string
  ) {
    const captureException = vi.fn();
    const findFirst = vi.fn(async () => stored);
    vi.resetModules();
    vi.doMock("./db", () => ({ db: { subscription: { findFirst } } }));
    vi.doMock("@sentry/nextjs", () => ({ captureException }));
    const mod = await import("./subscription");
    // Fresh user id per run for the same reason the block above needs one:
    // the 30s cache in front of getLatestSubscription is a global singleton.
    const tier = await mod.reportPremiumPaymentNotApplied(`user-${Math.random()}`, paidPlan, {
      source: "test",
      reference: "cs_test_1",
    });
    return { captureException, tier };
  }

  const row = (plan: string, status = "active", endInDays = 10) => ({
    id: "sub-1",
    plan,
    status,
    currentPeriodEnd: new Date(Date.now() + endInDays * DAY),
  });

  // POSITIVE CONTROL. This is the exact shape production held between
  // 24.08.2026 and 30.08.2026: a paid "lifetime" webhook, and a row that
  // still says "monthly" afterwards.
  it("reports a paid Premium that left the user on standard", async () => {
    const { captureException, tier } = await run(row("monthly"), "lifetime");
    expect(tier).toBe("standard");
    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, options] = captureException.mock.calls[0] as [Error, { level: string; extra: Record<string, unknown> }];
    expect(error.name).toBe("PremiumEntitlementMismatch");
    expect(options.level).toBe("error");
    expect(options.extra.storedPlan).toBe("monthly");
    expect(options.extra.observedTier).toBe("standard");
  });

  it("reports the other shapes of the same failure too", async () => {
    for (const [stored, expected] of [
      [row("referral"), "standard"],
      [row("manual"), "standard"],
      // Granted, then immediately canceled or already expired: the money
      // arrived and the access still is not there.
      [row("lifetime", "canceled"), "free"],
      [row("lifetime", "active", -1), "free"],
      [null, "free"],
    ] as const) {
      const { captureException, tier } = await run(stored, "lifetime");
      expect(tier, `stored ${stored?.plan ?? "nothing"}/${stored?.status ?? "-"}`).toBe(expected);
      expect(captureException).toHaveBeenCalledTimes(1);
    }
  });

  // NEGATIVE CONTROL, and the reason the positive one means something: an
  // alarm that fires on healthy payments would be turned off within a week.
  it("stays silent when the Premium payment actually granted Premium", async () => {
    const { captureException, tier } = await run(row("lifetime"), "lifetime");
    expect(tier).toBe("premium");
    expect(captureException).not.toHaveBeenCalled();
  });

  it("stays silent for monthly and annual payments — they are not Premium and never were", async () => {
    for (const plan of ["monthly", "annual", "referral", "manual"]) {
      const { captureException, tier } = await run(row(plan), plan);
      expect(tier, `paid ${plan}`).toBeNull();
      expect(captureException, `paid ${plan}`).not.toHaveBeenCalled();
    }
  });
});
