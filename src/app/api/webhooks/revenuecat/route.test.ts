import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const findUnique = vi.fn();
const upsert = vi.fn();
const updateMany = vi.fn();
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

vi.mock("@/lib/subscription", () => ({
  invalidateSubscriptionCache: (...args: unknown[]) => invalidateSubscriptionCache(...args),
}));

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
    findUnique.mockResolvedValue({ userId: "user_123" });
    await POST(fakeRequest(rcEvent("EXPIRATION"), { authorization: "Bearer rc_test_secret" }));
    expect(updateMany).toHaveBeenCalledWith({
      where: { rcOriginalTransactionId: "txn_abc" },
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
});
