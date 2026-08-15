import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";

const findUnique = vi.fn();
const upsert = vi.fn();
const updateMany = vi.fn();
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
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: (...args: unknown[]) => getStripe(...args),
}));

vi.mock("@/lib/subscription", () => ({
  invalidateSubscriptionCache: (...args: unknown[]) => invalidateSubscriptionCache(...args),
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

  it("acknowledges unhandled event types without touching the database", async () => {
    constructEvent.mockReturnValue(stripeEvent("customer.created", {}));

    const response = await POST(fakeRequest("{}", { "stripe-signature": "sig" }));

    expect(response.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
