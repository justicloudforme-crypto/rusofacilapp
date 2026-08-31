import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runStripePriceHealth } from "@/lib/stripe-price-health-server";

export const dynamic = "force-dynamic";

/** The header the owner (or the hourly cron) presents. Not a query
 * parameter: query strings end up in access logs and in browser history. */
const TOKEN_HEADER = "x-admin-health-token";

/**
 * Why 404 and not 401. An unauthenticated 401 confirms the route exists,
 * which is a free hint to anyone scanning for admin surface. There is
 * nothing to gain from telling them: the only caller that should ever reach
 * this is one that already holds ADMIN_HEALTH_TOKEN. So without the token —
 * or with the token unset on this deployment — the route behaves exactly as
 * if no such file existed.
 */
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.ADMIN_HEALTH_TOKEN;
  if (!expected) return false;

  const presented = request.headers.get(TOKEN_HEADER) ?? "";
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/**
 * Does every plan point at a Price that Stripe will actually sell?
 *
 * Answers with the variable name and a verdict per plan, plus what Stripe
 * said about the Price. It never returns the value of an environment
 * variable, nor the Price id: those are Sensitive on Vercel, and a health
 * endpoint that prints its own secrets is a worse problem than the one it
 * reports. See src/lib/stripe-price-health.ts.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return notFound();

  const report = await runStripePriceHealth();

  return NextResponse.json(
    {
      ok: report.ok,
      failing: report.failing,
      results: report.results.map((r) => ({
        plan: r.plan,
        envVar: r.envVar,
        verdict: r.verdict,
        expectedUsdCents: r.expectedUsdCents,
        expectedCurrency: r.expectedCurrency,
        actual: r.actual,
        detail: r.detail,
      })),
    },
    // A failing report is a real answer to a valid request, not a server
    // error — 200 either way, and `ok` carries the news. A monitor that
    // keys off the status code would otherwise be unable to tell "the
    // prices are wrong" from "the check itself is down".
    { status: 200 }
  );
}
