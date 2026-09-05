import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * Meses sin intereses — who gets offered them and who cannot be.
 *
 * Stripe's rule is one sentence long and it decides this whole file:
 * "Las cuotas solamente funcionan con el modo `payment`, no `setup` ni
 * `subscription`" (docs.stripe.com/payments/meses-sin-intereses/
 * accept-a-payment?payment-ui=checkout). Premium is a one-time payment and
 * is eligible; the monthly and annual plans are Stripe Subscriptions and
 * are not, and no Dashboard switch changes that. So the interesting
 * assertions here are the NEGATIVE ones — asking for installments on a
 * subscription is not a missed opportunity, it is a request Stripe refuses.
 *
 * Separate file from route.test.ts on purpose: src/lib/plans.ts reads the
 * price ids at MODULE LOAD, and this file needs the LIFETIME id present
 * before the route is imported — which is exactly what route.test.ts's
 * first describe block needs ABSENT. Vitest gives each file its own module
 * registry, so both can be true.
 */

const create = vi.fn();
const getCurrentUser = vi.fn();
const getStripe = vi.fn();
const captureException = vi.fn();
const sessionCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    subscription: { create: (...args: unknown[]) => create(...args) },
    user: { update: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: (...args: unknown[]) => getCurrentUser(...args) }));
vi.mock("@/lib/stripe", () => ({ getStripe: (...args: unknown[]) => getStripe(...args) }));
vi.mock("@/lib/subscription", () => ({ invalidateSubscriptionCache: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ getRateLimiter: () => ({ check: async () => false }) }));
vi.mock("@sentry/nextjs", () => ({ captureException: (...args: unknown[]) => captureException(...args) }));

process.env.STRIPE_PRICE_MONTHLY = "price_test_monthly";
process.env.STRIPE_PRICE_ANNUAL = "price_test_annual";
process.env.STRIPE_PRICE_LIFETIME = "price_test_lifetime";

const { POST } = await import("./route");

type SessionParams = {
  mode: string;
  payment_method_options?: { card?: { installments?: { enabled?: boolean } }; oxxo?: unknown };
};

function checkoutRequest(plan: string, method = "card", country = "MX"): NextRequest {
  const form = new FormData();
  form.set("plan", plan);
  form.set("lang", "es");
  form.set("method", method);
  return {
    url: "https://rusofacilapp.com/api/checkout",
    headers: new Headers({ "x-vercel-ip-country": country }),
    formData: async () => form,
  } as unknown as NextRequest;
}

function installmentsOf(call: unknown[]): boolean | undefined {
  const [args] = call as [SessionParams];
  return args.payment_method_options?.card?.installments?.enabled;
}

describe("POST /api/checkout — meses sin intereses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: "user_1", email: "a@b.c", stripeCustomerId: "cus_1" });
    getStripe.mockReturnValue({
      customers: { create: vi.fn() },
      checkout: { sessions: { create: sessionCreate } },
    });
    sessionCreate.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/test" });
    process.env.VERCEL_ENV = "production";
  });

  it("asks for installments on Premium, the one plan Stripe allows them on", async () => {
    const response = await POST(checkoutRequest("lifetime"));

    expect(sessionCreate).toHaveBeenCalledTimes(1);
    const [args] = sessionCreate.mock.calls[0] as [SessionParams];
    expect(args.mode).toBe("payment");
    expect(installmentsOf(sessionCreate.mock.calls[0]!)).toBe(true);
    expect(response.headers.get("location")).toBe("https://checkout.stripe.com/c/pay/test");
  });

  // THE NEGATIVE CONTROL, and the reason the flag is derived from
  // `plan.mode` instead of being written at the call site: a subscription
  // session carrying this parameter is not a slightly worse checkout, it is
  // a checkout Stripe rejects.
  it.each(["monthly", "annual"])("does not ask for them on the %s subscription", async (plan) => {
    await POST(checkoutRequest(plan));

    expect(sessionCreate).toHaveBeenCalledTimes(1);
    const [args] = sessionCreate.mock.calls[0] as [SessionParams];
    expect(args.mode).toBe("subscription");
    expect(args.payment_method_options).toBeUndefined();
  });

  // Cash and installments are different payment methods and must not meet:
  // the OXXO branch pins payment_method_types to ["oxxo"] and its
  // payment_method_options carries the voucher's expiry, nothing else.
  it("leaves the OXXO voucher alone", async () => {
    await POST(checkoutRequest("lifetime", "oxxo"));

    const [args] = sessionCreate.mock.calls[0] as [SessionParams];
    expect(args.payment_method_options?.card).toBeUndefined();
    expect(args.payment_method_options?.oxxo).toEqual({ expires_after_days: 3 });
  });

  /**
   * If Stripe ever refuses the parameter, the OFFER must not take the SALE
   * with it. Without the retry the refusal would fall into the route's
   * generic StripeInvalidRequestError handler and every Premium purchase
   * would answer 503 "checkout unavailable" — an outage caused by an
   * upsell.
   */
  it("still opens the payment page if Stripe refuses installments, and reports it", async () => {
    sessionCreate
      .mockImplementationOnce(() => {
        const error = new Error("This account is not eligible for installments.") as Error & {
          type: string;
        };
        error.type = "StripeInvalidRequestError";
        throw error;
      })
      .mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/retry" });

    const response = await POST(checkoutRequest("lifetime"));

    expect(sessionCreate).toHaveBeenCalledTimes(2);
    expect(installmentsOf(sessionCreate.mock.calls[0]!)).toBe(true);
    // The second attempt is the same session minus the offer.
    const [second] = sessionCreate.mock.calls[1] as [SessionParams];
    expect(second.payment_method_options).toBeUndefined();
    expect(second.mode).toBe("payment");
    // The buyer gets a payment page, not the 503.
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://checkout.stripe.com/c/pay/retry");
    // Reported as a warning under its own tag: nobody's purchase broke, but
    // an advertised offer silently stopped existing.
    expect(captureException).toHaveBeenCalledTimes(1);
    const [, context] = captureException.mock.calls[0] as [Error, { tags: Record<string, string> }];
    expect(context.tags.defect).toBe("checkout-installments-refused");
  });

  // NEGATIVE CONTROL for the retry: it must not turn a real, permanent
  // refusal into a silent success. The retry cannot tell WHY Stripe said
  // no — Stripe's error text is not a contract — so a dead Price id is
  // tried a second time without the parameter and refused again; what
  // matters is that the buyer still ends up on the 503 page that names no
  // Stripe detail, exactly as before 7.121, and never on a checkout that
  // charges nothing.
  it("a refusal that is not about installments still ends in the 503 page", async () => {
    sessionCreate.mockImplementation(() => {
      const error = new Error("The price specified is inactive.") as Error & { type: string };
      error.type = "StripeInvalidRequestError";
      throw error;
    });

    const response = await POST(checkoutRequest("lifetime"));

    expect(sessionCreate).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(503);
    const tags = (captureException.mock.calls as [Error, { tags: Record<string, string> }][]).map(
      ([, context]) => context.tags.defect
    );
    expect(tags).toContain("checkout-blocked");
  });
});
