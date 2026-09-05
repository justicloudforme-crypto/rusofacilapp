import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { readFileSync } from "node:fs";
import path from "node:path";

const findUnique = vi.fn();
const upsert = vi.fn();
const updateMany = vi.fn();
const create = vi.fn();
const update = vi.fn();
const constructEvent = vi.fn();
const subscriptionsRetrieve = vi.fn();
const getStripe = vi.fn();
const invalidateSubscriptionCache = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    subscription: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      upsert: (...args: unknown[]) => upsert(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: (...args: unknown[]) => getStripe(...args),
}));

vi.mock("@/lib/subscription", () => ({
  invalidateSubscriptionCache: (...args: unknown[]) => invalidateSubscriptionCache(...args),
  // Not a spy: the real predicate is one comparison, and the point of the
  // tests below is what the route does with its answer.
  isPremiumPlan: (plan: string) => plan === "lifetime",
}));

const { POST } = await import("./route");

function fakeRequest(body: string, headers: Record<string, string> = {}): NextRequest {
  return {
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    text: async () => body,
  } as unknown as NextRequest;
}

const fakeStripe = {
  webhooks: { constructEvent: (...args: unknown[]) => constructEvent(...args) },
  subscriptions: { retrieve: (...args: unknown[]) => subscriptionsRetrieve(...args) },
} as unknown as Stripe;

function stripeEvent(type: string, object: unknown): Stripe.Event {
  return { type, data: { object } } as unknown as Stripe.Event;
}

describe("POST /api/webhooks/stripe", () => {
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    getStripe.mockReturnValue(fakeStripe);
    findUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
  });

  it("responds 503 when Stripe is not configured", async () => {
    getStripe.mockReturnValue(null);
    const response = await POST(fakeRequest("{}", { "stripe-signature": "sig" }));
    expect(response.status).toBe(503);
  });

  it("responds 503 when STRIPE_WEBHOOK_SECRET is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const response = await POST(fakeRequest("{}", { "stripe-signature": "sig" }));
    expect(response.status).toBe(503);
  });

  it("responds 400 when the stripe-signature header is missing", async () => {
    const response = await POST(fakeRequest("{}"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/signature/i);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it("responds 400 when signature verification fails, without touching the database", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });
    const response = await POST(fakeRequest("{}", { "stripe-signature": "bad-sig" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/signature/i);
    expect(findUnique).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts a subscription on customer.subscription.updated, using metadata.userId when no row exists yet", async () => {
    const subscription = {
      id: "sub_1",
      status: "active",
      customer: "cus_1",
      metadata: { userId: "user_1", plan: "monthly" },
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86_400 }] },
    };
    constructEvent.mockReturnValue(stripeEvent("customer.subscription.updated", subscription));

    const response = await POST(fakeRequest("{}", { "stripe-signature": "sig" }));

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0]![0];
    expect(call.where).toEqual({ stripeSubscriptionId: "sub_1" });
    expect(call.create).toMatchObject({ userId: "user_1", plan: "monthly", status: "active" });
    expect(invalidateSubscriptionCache).toHaveBeenCalledWith("user_1");
  });

  it("does nothing when an event references a subscription with no linkable userId", async () => {
    const subscription = {
      id: "sub_orphan",
      status: "active",
      customer: "cus_1",
      metadata: {},
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86_400 }] },
    };
    constructEvent.mockReturnValue(stripeEvent("customer.subscription.updated", subscription));

    const response = await POST(fakeRequest("{}", { "stripe-signature": "sig" }));

    expect(response.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
    expect(invalidateSubscriptionCache).not.toHaveBeenCalled();
  });

  it("retrieves and upserts the subscription on checkout.session.completed", async () => {
    const session = { subscription: "sub_2", client_reference_id: "user_2" };
    const retrievedSubscription = {
      id: "sub_2",
      status: "active",
      customer: "cus_2",
      metadata: {},
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86_400 }] },
    };
    subscriptionsRetrieve.mockResolvedValue(retrievedSubscription);
    constructEvent.mockReturnValue(stripeEvent("checkout.session.completed", session));

    const response = await POST(fakeRequest("{}", { "stripe-signature": "sig" }));

    expect(response.status).toBe(200);
    expect(subscriptionsRetrieve).toHaveBeenCalledWith("sub_2");
    // client_reference_id fills in metadata.userId when Stripe hasn't set it.
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]![0].create).toMatchObject({ userId: "user_2" });
  });

  it("marks the subscription canceled and invalidates the cache on customer.subscription.deleted", async () => {
    findUnique.mockResolvedValue({ userId: "user_3" });
    constructEvent.mockReturnValue(stripeEvent("customer.subscription.deleted", { id: "sub_3" }));

    const response = await POST(fakeRequest("{}", { "stripe-signature": "sig" }));

    expect(response.status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_3" },
      data: { status: "canceled" },
    });
    expect(invalidateSubscriptionCache).toHaveBeenCalledWith("user_3");
  });

  it("marks the subscription past_due on invoice.payment_failed", async () => {
    findUnique.mockResolvedValue({ userId: "user_4" });
    const invoice = { parent: { subscription_details: { subscription: "sub_4" } } };
    constructEvent.mockReturnValue(stripeEvent("invoice.payment_failed", invoice));

    const response = await POST(fakeRequest("{}", { "stripe-signature": "sig" }));

    expect(response.status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_4" },
      data: { status: "past_due" },
    });
    expect(invalidateSubscriptionCache).toHaveBeenCalledWith("user_4");
  });

  // A row created before the "Premium lives on its own record" fix can be
  // both a Stripe subscription and somebody's Premium purchase. Stripe's
  // lifecycle events rewrite such a row wholesale, which is how a
  // bought-forever access used to disappear at the next renewal or
  // cancellation (PROGRESS.md debt 28). The route splits the two apart the
  // first time it sees one.
  describe("a legacy row that is both a Stripe subscription and a Premium purchase", () => {
    const legacy = {
      id: "row_legacy",
      userId: "user_legacy",
      plan: "lifetime",
      currentPeriodEnd: new Date("2126-01-01T00:00:00.000Z"),
    };

    it("moves the Premium half onto its own row before a cancellation lands", async () => {
      findUnique.mockResolvedValue(legacy);
      constructEvent.mockReturnValue(
        stripeEvent("customer.subscription.deleted", { id: "sub_legacy", metadata: { plan: "monthly" } })
      );

      const response = await POST(fakeRequest("{}", { "stripe-signature": "sig" }));

      expect(response.status).toBe(200);
      // The new row carries the Premium plan and the period it was granted,
      // and is NOT tied to the Stripe subscription being canceled.
      expect(create).toHaveBeenCalledTimes(1);
      expect(create.mock.calls[0]![0].data).toMatchObject({
        userId: "user_legacy",
        plan: "lifetime",
        status: "active",
        currentPeriodEnd: legacy.currentPeriodEnd,
      });
      expect(create.mock.calls[0]![0].data).not.toHaveProperty("stripeSubscriptionId");
      // ...and the original row goes back to being the subscription Stripe
      // thinks it is, so the cancellation below cancels a monthly plan.
      expect(update).toHaveBeenCalledWith({ where: { id: "row_legacy" }, data: { plan: "monthly" } });
      expect(updateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: "sub_legacy" },
        data: { status: "canceled" },
      });
    });

    it("does the same before a renewal overwrites the period", async () => {
      findUnique.mockResolvedValue(legacy);
      constructEvent.mockReturnValue(
        stripeEvent("customer.subscription.updated", {
          id: "sub_legacy",
          status: "active",
          customer: "cus_legacy",
          metadata: { plan: "monthly", userId: "user_legacy" },
          items: { data: [{ current_period_end: 1_800_000_000 }] },
        })
      );

      const response = await POST(fakeRequest("{}", { "stripe-signature": "sig" }));

      expect(response.status).toBe(200);
      expect(create.mock.calls[0]![0].data).toMatchObject({ plan: "lifetime" });
      // The upsert that follows writes the Stripe plan, never "lifetime".
      expect(upsert.mock.calls[0]![0].create).toMatchObject({ plan: "monthly" });
    });

    // NEGATIVE CONTROL: an ordinary Stripe row must not be split, or every
    // renewal would leave a spurious row behind.
    it("leaves an ordinary Stripe subscription row alone", async () => {
      findUnique.mockResolvedValue({ id: "row_1", userId: "user_1", plan: "monthly" });
      constructEvent.mockReturnValue(
        stripeEvent("customer.subscription.deleted", { id: "sub_1", metadata: {} })
      );

      await POST(fakeRequest("{}", { "stripe-signature": "sig" }));

      expect(create).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });
  });

  /**
   * The two subscriptions bought before 2026-09-06 are billed on the old USD
   * Prices, which stay live on purpose (PROGRESS.md 7.116). Their renewals
   * keep arriving here forever, in a currency this app no longer sells in.
   * If anything in this handler had an opinion about currency or amount,
   * those two people would quietly stop being subscribers.
   */
  describe("a renewal in the old currency is handled exactly like any other", () => {
    // A real Stripe subscription item as it arrives for one of those rows:
    // the embedded Price is the archived-from-sale-but-live 7,99 USD one.
    const usdItem = {
      current_period_end: Math.floor(Date.now() / 1000) + 86_400,
      price: {
        id: "price_old_usd_monthly",
        currency: "usd",
        unit_amount: 799,
        product: "prod_V686OIEKpWeTGX",
      },
    };

    it("renews a USD subscription without rejecting it", async () => {
      const subscription = {
        id: "sub_legacy_usd",
        status: "active",
        customer: "cus_legacy",
        currency: "usd",
        metadata: { userId: "user_usd", plan: "monthly" },
        items: { data: [usdItem] },
      };
      constructEvent.mockReturnValue(stripeEvent("customer.subscription.updated", subscription));

      const response = await POST(fakeRequest("{}", { "stripe-signature": "sig" }));

      expect(response.status).toBe(200);
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(upsert.mock.calls[0]![0].create).toMatchObject({
        userId: "user_usd",
        plan: "monthly",
        status: "active",
      });
      expect(invalidateSubscriptionCache).toHaveBeenCalledWith("user_usd");
    });

    it("still cancels a USD subscription when Stripe says it ended", async () => {
      findUnique.mockResolvedValue({ userId: "user_usd", plan: "monthly" });
      constructEvent.mockReturnValue(
        stripeEvent("customer.subscription.deleted", { id: "sub_legacy_usd", currency: "usd" })
      );

      const response = await POST(fakeRequest("{}", { "stripe-signature": "sig" }));

      expect(response.status).toBe(200);
      expect(updateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: "sub_legacy_usd" },
        data: { status: "canceled" },
      });
    });

    /**
     * The behavioural tests above pass for a handler that ignores currency
     * AND for one that happens to accept "usd" specifically. This is what
     * separates them: the handler has no currency concept at all. Read off
     * the source rather than asserted about behaviour, because the property
     * is an absence, and an absence has no observable behaviour to test.
     *
     * The control is the second half: the very same reader, pointed at a
     * planted copy, must find the field. Without it "0 matches" would also
     * be what a broken reader returns (PROGRESS.md 4.1).
     */
    it("the handler never reads a currency or an amount off a Stripe event", () => {
      const source = readFileSync(path.join(process.cwd(), "src/app/api/webhooks/stripe/route.ts"), "utf8");
      // Comments talk about money in prose; the rule is about code.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      const moneyFields = /\b(currency|unit_amount|amount_total|amount_paid|amount_due)\b/g;
      expect(code.match(moneyFields)).toBeNull();

      const planted = code.replace(
        "switch (event.type) {",
        'if (event.data.object.currency !== "mxn") return NextResponse.json({}, { status: 400 });\n  switch (event.type) {'
      );
      expect(planted.match(moneyFields)).toEqual(["currency"]);
    });
  });

  it("acknowledges unhandled event types without touching the database", async () => {
    constructEvent.mockReturnValue(stripeEvent("customer.created", {}));

    const response = await POST(fakeRequest("{}", { "stripe-signature": "sig" }));

    expect(response.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
