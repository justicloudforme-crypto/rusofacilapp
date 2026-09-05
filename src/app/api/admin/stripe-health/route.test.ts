import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const runStripePriceHealth = vi.fn();

vi.mock("@/lib/stripe-price-health-server", () => ({
  runStripePriceHealth: (...args: unknown[]) => runStripePriceHealth(...args),
}));

const { GET } = await import("./route");

function request(token?: string): NextRequest {
  const headers = new Headers();
  if (token !== undefined) headers.set("x-admin-health-token", token);
  return {
    url: "https://rusofacilapp.com/api/admin/stripe-health",
    headers,
  } as unknown as NextRequest;
}

const CLEAN_REPORT = {
  ok: true,
  failing: [],
  results: [
    {
      plan: "lifetime",
      envVar: "STRIPE_PRICE_LIFETIME",
      verdict: "OK",
      expectedAmountCents: 229_900,
      expectedCurrency: "mxn",
      actual: {
        active: true,
        unitAmount: 229_900,
        currency: "mxn",
        recurringInterval: null,
        product: "prod_x",
      },
      detail: "STRIPE_PRICE_LIFETIME: live Price, $2,299 MXN, as advertised.",
    },
  ],
};

describe("GET /api/admin/stripe-health", () => {
  const original = process.env.ADMIN_HEALTH_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    runStripePriceHealth.mockResolvedValue(CLEAN_REPORT);
    process.env.ADMIN_HEALTH_TOKEN = "correct-horse-battery-staple";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_HEALTH_TOKEN;
    else process.env.ADMIN_HEALTH_TOKEN = original;
  });

  // 404 rather than 401 throughout: a 401 confirms the route exists, and
  // there is nobody it would be useful to confirm that to.
  it("is invisible without the token, and runs nothing", async () => {
    const response = await GET(request());
    expect(response.status).toBe(404);
    expect(runStripePriceHealth).not.toHaveBeenCalled();
  });

  it("is invisible with the wrong token", async () => {
    expect((await GET(request("wrong"))).status).toBe(404);
    // Same length as the real one — the comparison is constant-time and must
    // still reject.
    expect((await GET(request("correct-horse-battery-stapl3"))).status).toBe(404);
    expect(runStripePriceHealth).not.toHaveBeenCalled();
  });

  it("is invisible when the deployment has no token configured at all", async () => {
    delete process.env.ADMIN_HEALTH_TOKEN;
    // Notably also when the caller presents an empty one, which would
    // otherwise "match" an unset variable.
    expect((await GET(request(""))).status).toBe(404);
    expect(runStripePriceHealth).not.toHaveBeenCalled();
  });

  it("answers with a verdict per variable when the token is right", async () => {
    const response = await GET(request("correct-horse-battery-staple"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.results[0]).toMatchObject({
      envVar: "STRIPE_PRICE_LIFETIME",
      verdict: "OK",
    });
  });

  it("answers 200 with ok:false when a price is dead — the check is up, the config is not", async () => {
    runStripePriceHealth.mockResolvedValue({
      ok: false,
      failing: ["STRIPE_PRICE_LIFETIME"],
      results: [{ ...CLEAN_REPORT.results[0], verdict: "INACTIVE" }],
    });

    const response = await GET(request("correct-horse-battery-staple"));
    // 200 on purpose: a monitor must be able to tell "the prices are wrong"
    // from "the endpoint is down", and a 5xx here would conflate them.
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(false);
  });
});
