import { describe, expect, it, vi } from "vitest";

// isSubscriptionActive is pure, but the module also imports ./db, which
// opens a real better-sqlite3 connection as a side effect of import —
// mocked out so this stays a fast, isolated unit test instead of an
// implicit integration test against whatever dev.db happens to exist.
vi.mock("./db", () => ({ db: {} }));

const { isSubscriptionActive, tierOfSubscriptions, pickEffectiveSubscription } = await import(
  "./subscription"
);

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
// tierOfSubscriptions: the tier is the BEST live ground for access a person
// holds, not the plan on their newest row. Everything below is the read half
// of "a Premium purchase lives on its own record".
// ---------------------------------------------------------------------------

describe("tierOfSubscriptions", () => {
  const DAY = 86_400_000;
  const row = (plan: string, status = "active", endInDays = 10) => ({
    plan,
    status,
    currentPeriodEnd: new Date(Date.now() + endInDays * DAY),
  });

  it("is free with no rows at all", () => {
    expect(tierOfSubscriptions([])).toBe("free");
  });

  it("is premium when ANY live row is Premium, whatever order the rows are in", () => {
    expect(tierOfSubscriptions([row("monthly"), row("lifetime")])).toBe("premium");
    expect(tierOfSubscriptions([row("lifetime"), row("monthly")])).toBe("premium");
  });

  // The three shapes debt 28 was about, stated as data: whatever happens to
  // the monthly row, the Premium row is a separate answer to the question.
  it("keeps premium when the monthly row renews, is canceled, or expires", () => {
    for (const monthly of [row("monthly", "active", 30), row("monthly", "canceled"), row("monthly", "active", -1)]) {
      expect(tierOfSubscriptions([monthly, row("lifetime", "active", 36_500)])).toBe("premium");
    }
  });

  it("ignores rows that are not live", () => {
    expect(tierOfSubscriptions([row("lifetime", "canceled"), row("monthly")])).toBe("standard");
    expect(tierOfSubscriptions([row("lifetime", "active", -1)])).toBe("free");
  });
});

describe("pickEffectiveSubscription", () => {
  const DAY = 86_400_000;
  const row = (id: string, plan: string, status = "active", endInDays = 10) => ({
    id,
    plan,
    status,
    currentPeriodEnd: new Date(Date.now() + endInDays * DAY),
  });

  it("describes the Premium purchase, not the newer monthly row", () => {
    const rows = [row("new", "monthly"), row("old", "lifetime", "active", 36_500)];
    expect(pickEffectiveSubscription(rows)?.id).toBe("old");
  });

  it("falls back to the longest-lasting live row when tiers are equal", () => {
    const rows = [row("short", "monthly", "active", 3), row("long", "annual", "active", 300)];
    expect(pickEffectiveSubscription(rows)?.id).toBe("long");
  });

  it("still names the newest dead row when nothing is live, so the page can say why", () => {
    const rows = [row("newest", "monthly", "canceled"), row("older", "manual", "active", -5)];
    expect(pickEffectiveSubscription(rows)?.id).toBe("newest");
    expect(pickEffectiveSubscription([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extendOrGrantSubscription: WHICH ROW a grant is written onto. That is the
// whole subject — a grant written onto a row Stripe owns is not stored, it is
// borrowed until Stripe's next event (PROGRESS.md debt 28).
// ---------------------------------------------------------------------------

describe("extendOrGrantSubscription and the row it writes to", () => {
  const DAY = 86_400_000;

  type StoredRow = {
    id: string;
    plan: string;
    status: string;
    currentPeriodEnd: Date;
    stripeSubscriptionId: string | null;
    rcOriginalTransactionId: string | null;
  };

  async function run(existing: StoredRow[], plan: string, paymentIntentId?: string) {
    // Typed through vi.fn's type parameter rather than left bare: without a
    // signature `mock.calls` is an empty tuple and reading `[0][0].data`
    // does not typecheck (`npm run verify` runs tsc over the tests too).
    type Write = (args: { where?: unknown; data: Record<string, unknown> }) => Promise<unknown>;
    const update = vi.fn<Write>(async () => ({}));
    const create = vi.fn<Write>(async () => ({}));
    const findMany = vi.fn(async () => existing);
    vi.resetModules();
    vi.doMock("./db", () => ({ db: { subscription: { findMany, update, create } } }));
    // The 30s TtlCache in front of the row read is a globalThis singleton,
    // so a fresh module registry is not enough on its own — a second case
    // would read the first case's rows. Give each run its own user id
    // instead of trying to reach into the cache.
    const mod = await import("./subscription");
    await mod.extendOrGrantSubscription(`user-${Math.random()}`, 30, plan, paymentIntentId);
    return { update, create };
  }

  const local = (plan: string, overrides: Partial<StoredRow> = {}): StoredRow => ({
    id: `local-${plan}`,
    plan,
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 10 * DAY),
    stripeSubscriptionId: null,
    rcOriginalTransactionId: null,
    ...overrides,
  });

  const stripeRow = (plan: string, overrides: Partial<StoredRow> = {}): StoredRow =>
    local(plan, { id: `stripe-${plan}`, stripeSubscriptionId: "sub_123", ...overrides });

  // THE DEFECT THIS GUARDS (debt 28). A Premium purchase used to be written
  // onto whatever row was live, including the one Stripe rewrites on every
  // renewal and marks canceled on cancellation. A hundred years of paid-for
  // access lived there until Stripe's next event, and then did not.
  it("opens its own row for a Premium purchase instead of writing onto the Stripe subscription", async () => {
    const { update, create } = await run([stripeRow("monthly")], "lifetime");
    expect(update).not.toHaveBeenCalled();
    expect(create.mock.calls[0]?.[0]?.data?.plan).toBe("lifetime");
  });

  it("does the same for every other live plan a buyer might already hold", async () => {
    for (const from of ["annual", "referral", "manual", "e2e-test"]) {
      const { update, create } = await run([local(from)], "lifetime");
      expect(update, `Premium bought on top of ${from}`).not.toHaveBeenCalled();
      expect(create.mock.calls[0]?.[0]?.data?.plan, `Premium bought on top of ${from}`).toBe("lifetime");
    }
  });

  // The same rule read from the other side: a grant that is not Premium
  // never lands on the Premium row, so nothing that adds days can demote
  // somebody who paid for Premium.
  it("never writes a non-Premium grant onto a live Premium row", async () => {
    for (const grant of ["referral", "manual", "monthly", "annual"]) {
      const { update, create } = await run([local("lifetime")], grant);
      expect(update, `granting ${grant} on top of Premium`).not.toHaveBeenCalled();
      expect(create.mock.calls[0]?.[0]?.data?.plan, `granting ${grant} on top of Premium`).toBe(grant);
    }
  });

  // Same class as debt 28, and it was never only about Premium: referral
  // days and admin grants added onto a Stripe-owned row were erased by the
  // next renewal just as thoroughly.
  it("keeps referral and admin days off the Stripe-owned row too", async () => {
    for (const grant of ["referral", "manual"]) {
      const { update, create } = await run([stripeRow("monthly")], grant);
      expect(update, `granting ${grant} over a Stripe subscription`).not.toHaveBeenCalled();
      expect(create.mock.calls[0]?.[0]?.data?.plan, `granting ${grant} over a Stripe subscription`).toBe(grant);
    }
  });

  it("leaves a native store row alone as well — RevenueCat rewrites it the same way", async () => {
    const rc = local("monthly", { id: "rc-1", stripeSubscriptionId: null, rcOriginalTransactionId: "1000000123" });
    const { update, create } = await run([rc], "referral");
    expect(update).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  // The rows this app does own are still extended rather than multiplied —
  // otherwise every referral bonus would leave a new row behind.
  it("extends the row it owns when the grant is of the same kind", async () => {
    const { update, create } = await run([local("manual")], "referral");
    expect(create).not.toHaveBeenCalled();
    expect(update.mock.calls[0]?.[0]?.data?.currentPeriodEnd).toBeInstanceOf(Date);
    // Extending never rewrites the plan: the row keeps standing for the
    // ground it was opened on.
    expect(update.mock.calls[0]?.[0]?.data).not.toHaveProperty("plan");
  });

  it("extends an existing Premium row rather than opening a second one", async () => {
    const { update, create } = await run([local("lifetime")], "lifetime");
    expect(create).not.toHaveBeenCalled();
    expect(update.mock.calls[0]?.[0]?.where).toEqual({ id: "local-lifetime" });
  });

  it("skips rows that are no longer live and opens a fresh one", async () => {
    const dead = local("manual", { status: "canceled" });
    const { update, create } = await run([dead], "manual");
    expect(update).not.toHaveBeenCalled();
    expect(create.mock.calls[0]?.[0]?.data?.plan).toBe("manual");
  });

  it("writes the plan it was given when there is nothing at all to extend", async () => {
    const { create, update } = await run([], "lifetime");
    expect(update).not.toHaveBeenCalled();
    expect(create.mock.calls[0]?.[0]?.data?.plan).toBe("lifetime");
  });

  // DEBT 29's other half. A refund can only revoke what it can find, and
  // what it finds by is this column — written here, at the one moment the
  // app learns which payment paid for which row.
  it("records the payment that paid for a new row", async () => {
    const { create } = await run([], "lifetime", "pi_new");
    expect(create.mock.calls[0]?.[0]?.data?.stripePaymentIntentId).toBe("pi_new");
  });

  it("records the payment on an extended row too — the newest payment wins the column", async () => {
    const { update } = await run([local("lifetime")], "lifetime", "pi_second");
    expect(update.mock.calls[0]?.[0]?.data?.stripePaymentIntentId).toBe("pi_second");
  });

  it("leaves the column null for the grants nobody paid for", async () => {
    // Admin grants, referral rewards and the e2e route call this without a
    // payment. Writing `undefined` into the column would be a silent
    // difference from writing null; writing a stale id would be worse.
    const { create } = await run([], "manual");
    expect(create.mock.calls[0]?.[0]?.data?.stripePaymentIntentId).toBeNull();
  });

  it("does not blank an existing payment id when a later grant has none", async () => {
    const { update } = await run([local("manual")], "referral");
    expect(update.mock.calls[0]?.[0]?.data).not.toHaveProperty("stripePaymentIntentId");
  });
});

// ---------------------------------------------------------------------------
// revokeAccessForPayment — DEBT 29. Money went back; take the access with it.
//
// The whole safety property here is SCOPE. A refund of one Stripe charge must
// take down the row that charge paid for and nothing else: not the admin
// grant somebody was given, not the referral days they earned, not a second
// subscription they are still paying for, not a native store purchase. Every
// one of those is its own row (see extendOrGrantSubscription above), and the
// cases below are what says so.
// ---------------------------------------------------------------------------

describe("revokeAccessForPayment", () => {
  type Row = { id: string; userId: string };

  async function revoke(
    reference: { paymentIntentId?: string | null; stripeSubscriptionId?: string | null },
    matched: Row[] = []
  ) {
    type Where = { where?: Record<string, unknown>; data?: Record<string, unknown>; select?: unknown };
    const findMany = vi.fn<(args: Where) => Promise<Row[]>>(async () => matched);
    const updateMany = vi.fn<(args: Where) => Promise<{ count: number }>>(async () => ({
      count: matched.length,
    }));
    const del = vi.fn(async () => undefined);
    vi.resetModules();
    vi.doMock("./db", () => ({ db: { subscription: { findMany, updateMany } } }));
    vi.doMock("./ttl-cache", async () => {
      const actual = await vi.importActual<typeof import("./ttl-cache")>("./ttl-cache");
      return { ...actual };
    });
    const mod = await import("./subscription");
    const result = await mod.revokeAccessForPayment(reference);
    return { result, findMany, updateMany, del };
  }

  it("revokes the row the refunded payment paid for", async () => {
    const { result, findMany, updateMany } = await revoke({ paymentIntentId: "pi_1" }, [
      { id: "row_paid", userId: "user_1" },
    ]);

    expect(findMany.mock.calls[0]![0].where).toEqual({ OR: [{ stripePaymentIntentId: "pi_1" }] });
    expect(updateMany.mock.calls[0]![0].where).toEqual({ id: { in: ["row_paid"] } });
    // Both halves: the status a dead row has, and a period that is over.
    // Either alone would do; together, a reader that somehow ignores one
    // still gets the right answer.
    expect(updateMany.mock.calls[0]![0].data!.status).toBe("canceled");
    expect(updateMany.mock.calls[0]![0].data!.currentPeriodEnd).toBeInstanceOf(Date);
    expect(result).toEqual({ revoked: 1, userIds: ["user_1"] });
  });

  it("can also be addressed by the Stripe subscription, and by both at once", async () => {
    const { findMany } = await revoke({ paymentIntentId: "pi_2", stripeSubscriptionId: "sub_2" }, []);
    expect(findMany.mock.calls[0]![0].where).toEqual({
      OR: [{ stripePaymentIntentId: "pi_2" }, { stripeSubscriptionId: "sub_2" }],
    });
  });

  /**
   * THE CASE THAT MATTERS MOST, and the reason this function takes a payment
   * reference rather than a person.
   *
   * A learner can hold two independent grounds for access at once: an admin
   * grant or a referral reward (this app's own rows, `stripePaymentIntentId`
   * and `stripeSubscriptionId` both null) and a Stripe purchase beside it.
   * Refunding the purchase must leave the granted one standing — and the
   * query is what guarantees it, because a null-carrying row cannot match a
   * `stripePaymentIntentId: "pi_…"` clause at all.
   */
  it("cannot touch a hand-granted row: an empty reference matches nothing", async () => {
    const { result, findMany, updateMany } = await revoke({ paymentIntentId: null, stripeSubscriptionId: null });
    // Not "found nothing" — never asked. `updateMany({ where: { x: null } })`
    // is one typo away from cancelling every granted row in the database.
    expect(findMany).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ revoked: 0, userIds: [] });
  });

  it("asks only for rows carrying that exact payment — never for the person's rows", async () => {
    const { findMany } = await revoke({ paymentIntentId: "pi_3" }, []);
    const where = findMany.mock.calls[0]![0].where!;
    // No userId, no customer, no status filter that could widen it.
    expect(JSON.stringify(where)).not.toMatch(/userId|customer/);
  });

  it("writes nothing when the payment matches no row, and says so", async () => {
    const { result, updateMany } = await revoke({ paymentIntentId: "pi_4" }, []);
    expect(updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ revoked: 0, userIds: [] });
  });

  it("revokes every row one payment paid for, and names each owner once", async () => {
    const { result } = await revoke({ paymentIntentId: "pi_5" }, [
      { id: "a", userId: "user_5" },
      { id: "b", userId: "user_5" },
    ]);
    expect(result).toEqual({ revoked: 2, userIds: ["user_5"] });
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

  /** Runs the read-back against a database that holds `stored` as the
   * user's only row, with Sentry replaced by a spy. `stored` is what the
   * grant LEFT BEHIND, which is the whole point: the check reads the
   * database back rather than trusting what the writer meant to do. */
  async function run(
    stored: { id: string; plan: string; status: string; currentPeriodEnd: Date } | null,
    paidPlan: string
  ) {
    const captureException = vi.fn();
    const findMany = vi.fn(async () => (stored ? [stored] : []));
    vi.resetModules();
    vi.doMock("./db", () => ({ db: { subscription: { findMany } } }));
    vi.doMock("@sentry/nextjs", () => ({ captureException }));
    const mod = await import("./subscription");
    // Fresh user id per run for the same reason the block above needs one:
    // the 30s cache in front of the row read is a global singleton.
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
