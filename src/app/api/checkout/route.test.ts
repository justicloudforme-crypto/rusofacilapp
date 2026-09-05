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

// src/lib/plans.ts reads the price ids at MODULE LOAD, so the monthly plan
// has to have one before the route is imported — otherwise the paid branch is
// skipped for every plan and the Stripe-refusal tests at the bottom of this
// file would silently exercise the free-grant fallback instead. The lifetime
// price is deliberately left unset: that is what the first describe block
// below is about.
process.env.STRIPE_PRICE_MONTHLY = "price_test_monthly";

const { POST } = await import("./route");

function checkoutRequest(plan: string, method = "card", country?: string): NextRequest {
  const form = new FormData();
  form.set("plan", plan);
  form.set("lang", "es");
  form.set("method", method);
  // Real requests always carry headers; the country one is what the OXXO
  // gate reads (src/lib/country.ts). Absent here unless a test names it,
  // which is exactly the shape of a request off a deployment.
  const headers = new Headers(country ? { "x-vercel-ip-country": country } : {});
  return {
    url: "https://rusofacilapp.com/api/checkout",
    headers,
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

/**
 * What the buyer sees when Stripe refuses the request.
 *
 * Before this, the exception escaped the handler: Next answered 500,
 * `onRequestError` filed it in Sentry as unhandled, and the person trying to
 * pay got a browser error page. That is not hypothetical — it is what every
 * "buy Premium" press did between 2026-08-24 and 2026-08-31, when
 * STRIPE_PRICE_LIFETIME held the id of an archived price and Stripe answered
 * `400 — The price specified is inactive` (PROGRESS.md 7.66).
 */
describe("POST /api/checkout — Stripe refuses to open the session", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;

  /** The shape Stripe's SDK raises: `.type` is what identifies it, and the
   * message quotes the offending value back at us. */
  function stripeInvalidRequest(): Error & { type: string; param: string } {
    const error = new Error(
      "The price specified is inactive. price_1U86EtDP0jFvlr1mH1ANUlOE"
    ) as Error & { type: string; param: string };
    error.type = "StripeInvalidRequestError";
    error.param = "line_items[0][price]";
    return error;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: "user_1", email: "a@b.c", stripeCustomerId: "cus_1" });
    process.env.VERCEL_ENV = "production";
  });

  afterEach(() => {
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  });

  function stripeThatRefuses(create: () => never) {
    return {
      customers: { create: async () => ({ id: "cus_1" }) },
      checkout: { sessions: { create } },
    };
  }

  it("answers 503 with a message in the visitor's language instead of throwing", async () => {
    getStripe.mockReturnValue(
      stripeThatRefuses(() => {
        throw stripeInvalidRequest();
      })
    );

    const response = await POST(checkoutRequest("monthly"));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(response.status).not.toBe(500);
    // Spanish, because the request said lang=es. And it says the one thing
    // the buyer needs: no money moved.
    expect(body).toContain("No se te cobró nada");

    // Nothing from Stripe reaches the page: not the message, not the id it
    // quotes back, not the parameter name.
    expect(body).not.toContain("price_1U86EtDP0jFvlr1mH1ANUlOE");
    expect(body).not.toContain("The price specified is inactive");
    expect(body).not.toContain("line_items");

    // And no free plan was handed out on the way past.
    expect(create).not.toHaveBeenCalled();
  });

  it("uses the Russian copy for a ru request", async () => {
    getStripe.mockReturnValue(
      stripeThatRefuses(() => {
        throw stripeInvalidRequest();
      })
    );

    const form = new FormData();
    form.set("plan", "monthly");
    form.set("lang", "ru");
    const request = {
      url: "https://rusofacilapp.com/api/checkout",
      formData: async () => form,
    } as unknown as NextRequest;

    const body = await (await POST(request)).text();
    expect(body).toContain("С вас ничего не списано");
  });

  it("files the refusal in Sentry as handled, tagged checkout-blocked", async () => {
    getStripe.mockReturnValue(
      stripeThatRefuses(() => {
        throw stripeInvalidRequest();
      })
    );

    await POST(checkoutRequest("monthly"));

    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, context] = captureException.mock.calls[0] as [
      Error,
      { tags: Record<string, string> },
    ];
    // Captured deliberately — which is what makes it handled — rather than
    // left to onRequestError, which marks it handled: false.
    expect(error.message).toContain("inactive");
    expect(context.tags.defect).toBe("checkout-blocked");
  });

  // NEGATIVE CONTROL: only Stripe's own refusals become a polite page. A
  // fault of ours must keep rising, or the 503 becomes a place bugs go to
  // hide.
  it("does not swallow an error that is not a Stripe invalid-request", async () => {
    getStripe.mockReturnValue(
      stripeThatRefuses(() => {
        throw new Error("database is on fire");
      })
    );

    await expect(POST(checkoutRequest("monthly"))).rejects.toThrow("database is on fire");
  });
});

/**
 * The cash branch creates an OXXO voucher, and an OXXO voucher is paid at
 * a shop in Mexico or not at all. /pricing stopped offering the tab
 * elsewhere on 07.09.2026 — but a hidden control is not a closed door:
 * this endpoint takes a plain form POST, and the tab was the only thing in
 * the way. See PROGRESS.md 7.117.
 */
describe("POST /api/checkout — cash is refused outside Mexico", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;
  const sessionCreate = vi.fn();

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

  afterEach(() => {
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  });

  it("turns a Spanish buyer's cash request back with a reason, and creates nothing", async () => {
    const response = await POST(checkoutRequest("monthly", "oxxo", "ES"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/es/pricing?checkout=cash_unavailable");
    // The point of the gate: no Stripe object of any kind was made. A
    // created-then-abandoned voucher is a real object in a real account.
    expect(sessionCreate).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses when a deployment did not say where the buyer is", async () => {
    await POST(checkoutRequest("monthly", "oxxo"));
    expect(sessionCreate).not.toHaveBeenCalled();
  });

  // POSITIVE CONTROL for the two assertions above: with everything else
  // identical and only the country changed, the voucher IS created. Without
  // this, "sessionCreate was not called" would pass just as well against a
  // route that never reaches Stripe at all.
  it("still sells a voucher to a Mexican buyer", async () => {
    const response = await POST(checkoutRequest("monthly", "oxxo", "MX"));

    expect(sessionCreate).toHaveBeenCalledTimes(1);
    const [args] = sessionCreate.mock.calls[0] as [{ payment_method_types: string[] }];
    expect(args.payment_method_types).toEqual(["oxxo"]);
    expect(response.headers.get("location")).toBe("https://checkout.stripe.com/c/pay/test");
  });

  // The card branch is not gated by country and must not become gated:
  // dynamic payment-method selection (no payment_method_types at all) is
  // what shows a buyer their own local methods, and it works everywhere.
  it("leaves the card branch alone, in every country", async () => {
    for (const country of ["ES", "MX", "CO"]) {
      sessionCreate.mockClear();
      await POST(checkoutRequest("monthly", "card", country));
      expect(sessionCreate).toHaveBeenCalledTimes(1);
      const [args] = sessionCreate.mock.calls[0] as [Record<string, unknown>];
      expect(args).not.toHaveProperty("payment_method_types");
    }
  });
});
