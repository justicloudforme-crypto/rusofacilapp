import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const findUnique = vi.fn();
const upsert = vi.fn();
const updateMany = vi.fn();
const userFindUnique = vi.fn();
const invalidateSubscriptionCache = vi.fn();
const captureException = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    subscription: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      upsert: (...args: unknown[]) => upsert(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/subscription", () => ({
  invalidateSubscriptionCache: (...args: unknown[]) => invalidateSubscriptionCache(...args),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: (...args: unknown[]) => captureException(...args) }));

const { POST } = await import("./route");

function fakeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return {
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    json: async () => body,
  } as unknown as NextRequest;
}

function rcEvent(type: string, overrides: Record<string, unknown> = {}) {
  return {
    event: {
      type,
      app_user_id: "user_123",
      original_transaction_id: "txn_abc",
      product_id: "com.rusofacilapp.monthly",
      store: "APP_STORE",
      expiration_at_ms: Date.now() + 1000 * 60 * 60 * 24 * 30,
      ...overrides,
    },
  };
}

describe("POST /api/webhooks/revenuecat", () => {
  const originalSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const originalMonthly = process.env.REVENUECAT_PRODUCT_MONTHLY;
  const originalLifetime = process.env.REVENUECAT_PRODUCT_LIFETIME;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVENUECAT_WEBHOOK_SECRET = "rc_test_secret";
    process.env.REVENUECAT_PRODUCT_MONTHLY = "com.rusofacilapp.monthly";
    process.env.REVENUECAT_PRODUCT_LIFETIME = "com.rusofacilapp.lifetime";
    findUnique.mockResolvedValue(null);
    // Default for every pre-existing case: the app_user_id resolves to a
    // real user, which is what those cases always silently assumed.
    userFindUnique.mockResolvedValue({ id: "user_123" });
  });

  afterEach(() => {
    process.env.REVENUECAT_WEBHOOK_SECRET = originalSecret;
    process.env.REVENUECAT_PRODUCT_MONTHLY = originalMonthly;
    process.env.REVENUECAT_PRODUCT_LIFETIME = originalLifetime;
  });

  it("responds 503 when RevenueCat is not configured", async () => {
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
    const response = await POST(fakeRequest(rcEvent("INITIAL_PURCHASE")));
    expect(response.status).toBe(503);
  });

  it("responds 401 when the Authorization header is missing", async () => {
    const response = await POST(fakeRequest(rcEvent("INITIAL_PURCHASE")));
    expect(response.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("responds 401 when the Authorization header doesn't match the secret", async () => {
    const response = await POST(
      fakeRequest(rcEvent("INITIAL_PURCHASE"), { authorization: "Bearer wrong" })
    );
    expect(response.status).toBe(401);
  });

  it("responds 400 on malformed JSON", async () => {
    const badRequest = {
      headers: { get: (key: string) => (key === "authorization" ? "Bearer rc_test_secret" : null) },
      json: async () => {
        throw new Error("bad json");
      },
    } as unknown as NextRequest;
    const response = await POST(badRequest);
    expect(response.status).toBe(400);
  });

  it("responds 400 when the event is missing type or app_user_id", async () => {
    const response = await POST(
      fakeRequest({ event: { type: "INITIAL_PURCHASE" } }, { authorization: "Bearer rc_test_secret" })
    );
    expect(response.status).toBe(400);
  });

  it("upserts an active subscription on INITIAL_PURCHASE, keyed by original_transaction_id", async () => {
    const response = await POST(
      fakeRequest(rcEvent("INITIAL_PURCHASE"), { authorization: "Bearer rc_test_secret" })
    );
    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rcOriginalTransactionId: "txn_abc" },
        create: expect.objectContaining({
          userId: "user_123",
          plan: "monthly",
          status: "active",
          provider: "revenuecat",
          rcOriginalTransactionId: "txn_abc",
          rcStore: "APP_STORE",
        }),
      })
    );
    expect(invalidateSubscriptionCache).toHaveBeenCalledWith("user_123");
  });

  it("grants a never-expiring lifetime subscription on NON_RENEWING_PURCHASE", async () => {
    await POST(
      fakeRequest(
        rcEvent("NON_RENEWING_PURCHASE", {
          product_id: "com.rusofacilapp.lifetime",
          expiration_at_ms: null,
        }),
        { authorization: "Bearer rc_test_secret" }
      )
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          plan: "lifetime",
          status: "active",
          currentPeriodEnd: new Date("2099-12-31T00:00:00.000Z"),
        }),
      })
    );
  });

  it("keeps status active on CANCELLATION (auto-renew off, access continues to period end)", async () => {
    await POST(fakeRequest(rcEvent("CANCELLATION"), { authorization: "Bearer rc_test_secret" }));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { status: "active", currentPeriodEnd: expect.any(Date) } }));
  });

  it("closes access on EXPIRATION", async () => {
    findUnique.mockResolvedValue({ userId: "user_123", plan: "monthly" });
    await POST(fakeRequest(rcEvent("EXPIRATION"), { authorization: "Bearer rc_test_secret" }));
    expect(updateMany).toHaveBeenCalledWith({
      where: { rcOriginalTransactionId: "txn_abc", plan: { not: "lifetime" } },
      data: { status: "canceled" },
    });
    expect(invalidateSubscriptionCache).toHaveBeenCalledWith("user_123");
  });

  it("marks past_due on BILLING_ISSUE", async () => {
    findUnique.mockResolvedValue({ userId: "user_123" });
    await POST(fakeRequest(rcEvent("BILLING_ISSUE"), { authorization: "Bearer rc_test_secret" }));
    expect(updateMany).toHaveBeenCalledWith({
      where: { rcOriginalTransactionId: "txn_abc" },
      data: { status: "past_due" },
    });
  });

  it("acknowledges unhandled event types without touching the database", async () => {
    const response = await POST(
      fakeRequest(rcEvent("TEST"), { authorization: "Bearer rc_test_secret" })
    );
    expect(response.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("does nothing when original_transaction_id is missing", async () => {
    await POST(
      fakeRequest(rcEvent("INITIAL_PURCHASE", { original_transaction_id: null }), {
        authorization: "Bearer rc_test_secret",
      })
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // Долг 31, конец первый: чужой app_user_id не роняет маршрут
  //
  // Until this run the create path wrote userId: event.app_user_id into a
  // foreign key onto User without asking whether that user exists, so an
  // event naming an unknown id made Prisma throw → 500 → RevenueCat
  // redelivered the same event forever. The contract asserted here is: the
  // user is looked up FIRST, nothing is written, and the answer is 200 with
  // an explicit marker so "ignored" is distinguishable from "stored".
  // ------------------------------------------------------------------

  it("debt 31, end one: an unknown app_user_id is answered 200, writes nothing, and is reported", async () => {
    userFindUnique.mockResolvedValue(null);
    const response = await POST(
      fakeRequest(rcEvent("INITIAL_PURCHASE", { app_user_id: "user_does_not_exist" }), {
        authorization: "Bearer rc_test_secret",
      })
    );

    // 200, not 500: this is what stops the redelivery loop.
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, ignored: "unknown-app-user-id" });

    // Nothing written — the foreign key is never given a chance to throw.
    expect(upsert).not.toHaveBeenCalled();
    expect(invalidateSubscriptionCache).not.toHaveBeenCalled();

    // The user was checked BEFORE the write, not after a failure.
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: "user_does_not_exist" },
      select: { id: true },
    });

    // Silence is the failure mode this guard could have introduced, so the
    // report is part of the contract, not a nicety.
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ name: "RevenueCatUnknownAppUserId" }),
      expect.objectContaining({
        level: "warning",
        extra: expect.objectContaining({ appUserId: "user_does_not_exist" }),
      })
    );
  });

  it("debt 31, end one: a known app_user_id is still stored (the guard does not block real purchases)", async () => {
    userFindUnique.mockResolvedValue({ id: "user_123" });
    const response = await POST(
      fakeRequest(rcEvent("INITIAL_PURCHASE"), { authorization: "Bearer rc_test_secret" })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("debt 31, end one: an existing row is updated without re-checking the user", async () => {
    // An existing row already carries a valid userId — asking User again
    // would be a read per renewal event for no gain.
    findUnique.mockResolvedValue({ plan: "monthly", userId: "user_123" });
    await POST(fakeRequest(rcEvent("RENEWAL"), { authorization: "Bearer rc_test_secret" }));
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // Долг 31, конец второй: EXPIRATION не гасит пожизненную покупку
  //
  // The revocation named no plan at all, so a lifetime purchase (stored
  // with currentPeriodEnd 2099 precisely so nothing expires it) was closed
  // by the same updateMany as a lapsed monthly subscription.
  // ------------------------------------------------------------------

  it("debt 31, end two: EXPIRATION on a lifetime row writes nothing and is reported", async () => {
    findUnique.mockResolvedValue({ userId: "user_123", plan: "lifetime" });
    const response = await POST(
      fakeRequest(
        rcEvent("EXPIRATION", { product_id: "com.rusofacilapp.lifetime", expiration_at_ms: null }),
        { authorization: "Bearer rc_test_secret" }
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, ignored: "expiration-on-lifetime" });
    expect(updateMany).not.toHaveBeenCalled();
    expect(invalidateSubscriptionCache).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ name: "RevenueCatExpirationOnLifetime" }),
      expect.objectContaining({ level: "warning" })
    );
  });

  it("debt 31, end two: the lifetime guard is in the where clause, so a monthly row still closes", async () => {
    findUnique.mockResolvedValue({ userId: "user_123", plan: "monthly" });
    await POST(fakeRequest(rcEvent("EXPIRATION"), { authorization: "Bearer rc_test_secret" }));
    expect(updateMany).toHaveBeenCalledWith({
      where: { rcOriginalTransactionId: "txn_abc", plan: { not: "lifetime" } },
      data: { status: "canceled" },
    });
    expect(invalidateSubscriptionCache).toHaveBeenCalledWith("user_123");
  });
});
