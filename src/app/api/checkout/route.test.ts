import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const create = vi.fn();
const userUpdate = vi.fn();
const getCurrentUser = vi.fn();
const getStripe = vi.fn();
const captureException = vi.fn();
const invalidateSubscriptionCache = vi.fn();
const limiterCheck = vi.fn(async () => false);

vi.mock("@/lib/db", () => ({
  db: {
    subscription: { create: (...args: unknown[]) => create(...args) },
    user: { update: (...args: unknown[]) => userUpdate(...args) },
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: (...args: unknown[]) => getCurrentUser(...args) }));
vi.mock("@/lib/stripe", () => ({ getStripe: (...args: unknown[]) => getStripe(...args) }));
vi.mock("@/lib/subscription", () => ({
  invalidateSubscriptionCache: (...args: unknown[]) => invalidateSubscriptionCache(...args),
}));
vi.mock("@/lib/rate-limit", () => ({ getRateLimiter: () => ({ check: limiterCheck }) }));
vi.mock("@sentry/nextjs", () => ({ captureException: (...args: unknown[]) => captureException(...args) }));

const { POST } = await import("./route");

function checkoutRequest(plan: string, method = "card"): NextRequest {
  const form = new FormData();
  form.set("plan", plan);
  form.set("lang", "es");
  form.set("method", method);
  return {
    url: "https://rusofacilapp.com/api/checkout",
    formData: async () => form,
  } as unknown as NextRequest;
}

/**
 * The branch under test grants a plan without anyone paying. That is
 * correct on a laptop with no Stripe credentials and catastrophic on a
 * deployment, where one unset environment variable is all it takes to
 * reach it — an absent STRIPE_PRICE_LIFETIME leaves plans.lifetime.priceId
 * undefined, and the paid branch above is skipped for that plan alone.
 */
describe("POST /api/checkout — the no-Stripe fallback that grants access for free", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalPrice = process.env.STRIPE_PRICE_LIFETIME;

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: "user_1", email: "a@b.c", stripeCustomerId: "cus_1" });
    getStripe.mockReturnValue(null);
    delete process.env.STRIPE_PRICE_LIFETIME;
  });

  afterEach(() => {
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
    if (originalPrice === undefined) delete process.env.STRIPE_PRICE_LIFETIME;
    else process.env.STRIPE_PRICE_LIFETIME = originalPrice;
  });

  it("refuses to hand out a plan for free on a deployment, and says so out loud", async () => {
    process.env.VERCEL_ENV = "production";

    const response = await POST(checkoutRequest("lifetime"));

    expect(create).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/es/pricing?checkout=unavailable");
    // A checkout that cannot charge anybody is worth an alarm: the visitor
    // sees a message, and the misconfiguration is not left for someone to
    // notice in the revenue figures a month later.
    expect(captureException).toHaveBeenCalledTimes(1);
    const [error] = captureException.mock.calls[0] as [Error];
    expect(error.name).toBe("CheckoutFellThroughToFreeGrant");
  });

  it("refuses on preview deployments too, not only production", async () => {
    process.env.VERCEL_ENV = "preview";
    await POST(checkoutRequest("monthly"));
    expect(create).not.toHaveBeenCalled();
  });

  // NEGATIVE CONTROL. Off a deployment the fallback is the only way to
  // exercise the access-control flow without real Stripe credentials, and
  // both `npm run dev` and the e2e suite depend on it.
  it("still activates the plan locally, where there is no deployment to protect", async () => {
    delete process.env.VERCEL_ENV;

    const response = await POST(checkoutRequest("lifetime"));

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0].data).toMatchObject({ userId: "user_1", plan: "lifetime", status: "active" });
    expect(response.headers.get("location")).toContain("checkout=mock");
    expect(captureException).not.toHaveBeenCalled();
  });
});
