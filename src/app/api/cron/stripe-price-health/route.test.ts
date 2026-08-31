import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const runStripePriceHealth = vi.fn();
const captureMessage = vi.fn();

vi.mock("@/lib/stripe-price-health-server", () => ({
  runStripePriceHealth: (...args: unknown[]) => runStripePriceHealth(...args),
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: (...args: unknown[]) => captureMessage(...args) }));

const { GET } = await import("./route");

function request(auth?: string): NextRequest {
  const headers = new Headers();
  if (auth !== undefined) headers.set("authorization", auth);
  return {
    url: "https://rusofacilapp.com/api/cron/stripe-price-health",
    headers,
  } as unknown as NextRequest;
}

const OK_RESULT = {
  plan: "lifetime",
  envVar: "STRIPE_PRICE_LIFETIME",
  verdict: "OK",
  expectedUsdCents: 12_299,
  expectedCurrency: "usd",
  actual: null,
  detail: "STRIPE_PRICE_LIFETIME: live Price, 122.99 USD, as advertised.",
};

describe("GET /api/cron/stripe-price-health — the hourly watch", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.CRON_SECRET = "cron-secret-value";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("refuses an unauthenticated call and checks nothing", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer wrong-secret-val"))).status).toBe(401);
    expect(runStripePriceHealth).not.toHaveBeenCalled();
  });

  it("says nothing to Sentry while every plan is healthy", async () => {
    runStripePriceHealth.mockResolvedValue({ ok: true, failing: [], results: [OK_RESULT] });

    const response = await GET(request("Bearer cron-secret-value"));

    expect(response.status).toBe(200);
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("raises an error-level Sentry message, tagged, when a price is archived", async () => {
    runStripePriceHealth.mockResolvedValue({
      ok: false,
      failing: ["STRIPE_PRICE_LIFETIME"],
      results: [
        {
          ...OK_RESULT,
          verdict: "INACTIVE",
          detail: "The Price in STRIPE_PRICE_LIFETIME exists but is ARCHIVED.",
        },
      ],
    });

    await GET(request("Bearer cron-secret-value"));

    expect(captureMessage).toHaveBeenCalledTimes(1);
    const [message, context] = captureMessage.mock.calls[0] as [
      string,
      { level: string; tags: Record<string, string>; extra: Record<string, unknown> },
    ];
    expect(message).toContain("STRIPE_PRICE_LIFETIME");
    expect(message).toContain("INACTIVE");
    expect(context.level).toBe("error");
    expect(context.tags.defect).toBe("stripe-price-health");
    // Names and verdicts only. A price id or an env value in a Sentry event
    // is the failure mode this whole area is about.
    expect(JSON.stringify(context.extra)).not.toContain("price_");
  });

  it("alerts on a product mismatch too — the plan is sellable and still wrong", async () => {
    // The cross-plan verdict reaches Sentry by the same road as every other
    // one: `ok: false`. Asserted rather than assumed, because this is the
    // one verdict no single plan could have produced.
    runStripePriceHealth.mockResolvedValue({
      ok: false,
      failing: ["STRIPE_PRICE_LIFETIME"],
      results: [
        {
          ...OK_RESULT,
          verdict: "PRODUCT_MISMATCH",
          detail:
            "STRIPE_PRICE_LIFETIME points at a live, correctly priced Price of product " +
            "prod_other, while the other plans sell prod_one.",
        },
      ],
    });

    await GET(request("Bearer cron-secret-value"));

    expect(captureMessage).toHaveBeenCalledTimes(1);
    const [message, context] = captureMessage.mock.calls[0] as [
      string,
      { level: string; tags: Record<string, string>; extra: Record<string, unknown> },
    ];
    expect(message).toContain("PRODUCT_MISMATCH");
    expect(context.level).toBe("error");
    expect(context.tags.defect).toBe("stripe-price-health");
    expect(JSON.stringify(context.extra)).not.toContain("price_");
  });
});
