import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const create = vi.fn();
const userUpdate = vi.fn();
const getCurrentUser = vi.fn();
const getStripe = vi.fn();
const captureException = vi.fn();
const invalidateSubscriptionCache = vi.fn();
const limiterCheck = vi.fn(async () => false);
const getEntitlementTierFor = vi.fn(async () => "free" as string);
const getOpenPendingCheckout = vi.fn(async () => null as { id: string } | null);
const openPendingCheckout = vi.fn<(args: unknown) => Promise<unknown>>(async () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    subscription: { create: (...args: unknown[]) => create(...args) },
    user: { update: (...args: unknown[]) => userUpdate(...args) },
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: (...args: unknown[]) => getCurrentUser(...args) }));
vi.mock("@/lib/stripe", () => ({ getStripe: (...args: unknown[]) => getStripe(...args) }));
// Partial: `invalidateSubscriptionCache` is a spy, but `higherTier` (which
// the real planAddsNothing reads) has to come through — a mocked tier ladder
// would make the debt-33 cases below agree with themselves.
vi.mock("@/lib/subscription", async () => {
  const actual = await vi.importActual<typeof import("@/lib/subscription")>("@/lib/subscription");
  return {
    ...actual,
    invalidateSubscriptionCache: (...args: unknown[]) => invalidateSubscriptionCache(...args),
  };
});
vi.mock("@/lib/rate-limit", () => ({ getRateLimiter: () => ({ check: limiterCheck }) }));
vi.mock("@/lib/pending-checkout", () => ({
  getOpenPendingCheckout: () => getOpenPendingCheckout(),
  openPendingCheckout: (args: unknown) => openPendingCheckout(args),
}));
// Only the TIER is substituted. `planAddsNothing` — the rule that decides
// whether a purchase would add anything — comes through for real, so these
// cases test the rule and not a restatement of it.
vi.mock("@/lib/entitlement", async () => {
  const actual = await vi.importActual<typeof import("@/lib/entitlement")>("@/lib/entitlement");
  return { ...actual, getEntitlementTierFor: () => getEntitlementTierFor() };
});
vi.mock("@sentry/nextjs", () => ({ captureException: (...args: unknown[]) => captureException(...args) }));

// src/lib/plans.ts reads the price ids at MODULE LOAD, so every plan under
// test has to have one before the route is imported — otherwise the paid
// branch is skipped and a case that means to exercise Stripe would silently
// exercise the free-grant fallback instead.
//
// The first describe block below is about that fallback, and it still gets
// it: it makes `getStripe()` answer null, which skips the paid branch for
// every plan whatever the price ids say. Before 08.09.2026 it relied on
// STRIPE_PRICE_LIFETIME being absent instead — which worked, but only
// because of the null Stripe, and it left the debt-33 cases at the bottom of
// this file unable to buy annual or Premium at all.
process.env.STRIPE_PRICE_MONTHLY = "price_test_monthly";
process.env.STRIPE_PRICE_ANNUAL = "price_test_annual";
process.env.STRIPE_PRICE_LIFETIME = "price_test_lifetime";

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
    getCurrentUser.mockResolvedValue({ id: "user_1", email: "a@b.c", stripeCustomerId: "cus_1", role: "student" });
    getEntitlementTierFor.mockResolvedValue("free");
    getOpenPendingCheckout.mockResolvedValue(null);
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
    getCurrentUser.mockResolvedValue({ id: "user_1", email: "a@b.c", stripeCustomerId: "cus_1", role: "student" });
    getEntitlementTierFor.mockResolvedValue("free");
    getOpenPendingCheckout.mockResolvedValue(null);
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
    getCurrentUser.mockResolvedValue({ id: "user_1", email: "a@b.c", stripeCustomerId: "cus_1", role: "student" });
    getEntitlementTierFor.mockResolvedValue("free");
    getOpenPendingCheckout.mockResolvedValue(null);
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

/**
 * DEBT 33 — a second full charge for something the buyer already owns.
 *
 * Reproduced 08.09.2026 before it was fixed: with `getEntitlementTierFor`
 * answering "premium" — the holder of a 2 299 MXN one-time purchase whose
 * period runs to 2126 — this route created a Stripe Checkout Session for the
 * SAME plan without asking anything, and Stripe would have taken the money.
 * There is no refund path behind that (debt 29), so the charge was final.
 *
 * The rule is the tier ladder: a purchase is refused when the buyer already
 * stands at or above the tier the plan grants. `planAddsNothing` is NOT
 * mocked in this file — only the tier is — so these cases exercise the rule
 * itself rather than a restatement of it.
 */
describe("POST /api/checkout — a plan the buyer already holds", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;
  const sessionCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: "user_1", email: "a@b.c", stripeCustomerId: "cus_1", role: "student" });
    getStripe.mockReturnValue({
      customers: { create: vi.fn(async () => ({ id: "cus_1" })) },
      checkout: { sessions: { create: sessionCreate } },
    });
    sessionCreate.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/test" });
    process.env.VERCEL_ENV = "production";
  });

  afterEach(() => {
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  });

  const REFUSED: Array<[string, string]> = [
    ["premium", "lifetime"],
    ["premium", "annual"],
    ["premium", "monthly"],
    ["standard", "monthly"],
    ["standard", "annual"],
  ];

  it.each(REFUSED)("refuses a %s holder buying %s, before any Stripe object exists", async (tier, plan) => {
    getEntitlementTierFor.mockResolvedValue(tier);

    const response = await POST(checkoutRequest(plan));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/es/pricing?checkout=already_owned");
    // Not "no session was created" alone: no CUSTOMER either, and no row.
    // The refusal stands in front of every Stripe call this route makes,
    // because a created session is a payable session.
    expect(sessionCreate).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a cash (OXXO) repeat purchase too, not only the card one", async () => {
    getEntitlementTierFor.mockResolvedValue("premium");
    const response = await POST(checkoutRequest("lifetime", "oxxo", "MX"));
    expect(response.headers.get("location")).toContain("checkout=already_owned");
    expect(sessionCreate).not.toHaveBeenCalled();
  });

  it("refuses before the rate limiter, so a repeat buyer never spends their budget on it", async () => {
    getEntitlementTierFor.mockResolvedValue("premium");
    await POST(checkoutRequest("lifetime"));
    expect(limiterCheck).not.toHaveBeenCalled();
  });

  // NEGATIVE CONTROLS. Without these, "no session was created" would pass
  // against a route that refuses everybody — which is the other way to lose
  // all the money.
  const ALLOWED: Array<[string, string]> = [
    ["free", "monthly"],
    ["free", "annual"],
    ["free", "lifetime"],
    ["standard", "lifetime"],
  ];

  it.each(ALLOWED)("still sells %s → %s", async (tier, plan) => {
    getEntitlementTierFor.mockResolvedValue(tier);

    const response = await POST(checkoutRequest(plan));

    expect(sessionCreate).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe("https://checkout.stripe.com/c/pay/test");
  });

  it("a standard subscriber can still upgrade to Premium — that is the one purchase that adds something", async () => {
    getEntitlementTierFor.mockResolvedValue("standard");
    await POST(checkoutRequest("lifetime"));
    const [args] = sessionCreate.mock.calls[0] as [{ mode: string }];
    expect(args.mode).toBe("payment");
  });
});

/**
 * DEBT 30 — two payable barcodes for one person.
 *
 * An OXXO voucher is a barcode paid in cash at a shop, and Stripe leaves it
 * payable for three days. Nothing about it was stored, so this endpoint would
 * print a second one for the same person on request — and BOTH are payable.
 * Take one, lose the tab, come back, press the button again, walk into the
 * shop with two: charged twice, with no refund path behind it (debt 29).
 */
describe("POST /api/checkout — one outstanding OXXO voucher per person", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;
  const sessionCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: "user_1", email: "a@b.c", stripeCustomerId: "cus_1", role: "student" });
    getEntitlementTierFor.mockResolvedValue("free");
    getOpenPendingCheckout.mockResolvedValue(null);
    getStripe.mockReturnValue({
      customers: { create: vi.fn(async () => ({ id: "cus_1" })) },
      checkout: { sessions: { create: sessionCreate } },
    });
    sessionCreate.mockResolvedValue({ id: "cs_new", url: "https://checkout.stripe.com/c/pay/test" });
    process.env.VERCEL_ENV = "production";
  });

  afterEach(() => {
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  });

  it("refuses to print a second barcode and sends the buyer to the one they hold", async () => {
    getOpenPendingCheckout.mockResolvedValue({ id: "pc_open" });

    const response = await POST(checkoutRequest("monthly", "oxxo", "MX"));

    expect(sessionCreate).not.toHaveBeenCalled();
    expect(openPendingCheckout).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    // /profile, not /pricing: the voucher they already have is what they
    // came for, and that is where the banner and the barcode link live.
    expect(response.headers.get("location")).toContain("/es/profile?checkout=oxxo_pending&voucher=existing");
  });

  it("records the voucher it does create, with the same three days Stripe was told", async () => {
    const before = Date.now();
    await POST(checkoutRequest("lifetime", "oxxo", "MX"));

    const [sessionArgs] = sessionCreate.mock.calls[0] as [
      { payment_method_options: { oxxo: { expires_after_days: number } } },
    ];
    expect(sessionArgs.payment_method_options.oxxo.expires_after_days).toBe(3);

    expect(openPendingCheckout).toHaveBeenCalledTimes(1);
    const [record] = openPendingCheckout.mock.calls[0] as [
      { userId: string; plan: string; method: string; stripeSessionId: string; expiresAt: Date },
    ];
    expect(record).toMatchObject({ userId: "user_1", plan: "lifetime", method: "oxxo", stripeSessionId: "cs_new" });
    // The record must not outlive the barcode: same three days, read from
    // the one constant the Stripe call also reads.
    const days = (record.expiresAt.getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(2.99);
    expect(days).toBeLessThan(3.01);
  });

  // NEGATIVE CONTROL. Without it, "no second voucher" would pass against a
  // route that stopped selling vouchers altogether.
  it("still sells a first voucher when nothing is outstanding", async () => {
    const response = await POST(checkoutRequest("monthly", "oxxo", "MX"));
    expect(sessionCreate).toHaveBeenCalledTimes(1);
    expect(openPendingCheckout).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe("https://checkout.stripe.com/c/pay/test");
  });

  // An outstanding CASH voucher must not stop a CARD payment: the card
  // settles at once, and someone who gave up on walking to the shop is
  // exactly the person most likely to reach for it.
  it("leaves the card branch open while a voucher is outstanding", async () => {
    getOpenPendingCheckout.mockResolvedValue({ id: "pc_open" });
    const response = await POST(checkoutRequest("monthly", "card", "MX"));
    expect(sessionCreate).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe("https://checkout.stripe.com/c/pay/test");
  });

  // The record is written only for a voucher Stripe actually made, and only
  // for the cash branch.
  it("records nothing for a card purchase", async () => {
    await POST(checkoutRequest("monthly", "card"));
    expect(openPendingCheckout).not.toHaveBeenCalled();
  });
});
