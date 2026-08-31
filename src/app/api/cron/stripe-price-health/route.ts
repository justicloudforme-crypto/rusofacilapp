import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runStripePriceHealth } from "@/lib/stripe-price-health-server";
import { formatPriceHealth } from "@/lib/stripe-price-health";

export const dynamic = "force-dynamic";

/**
 * Hourly watch over the same check the owner can run by hand at
 * /api/admin/stripe-health. Scheduled from vercel.json.
 *
 * Why hourly and not daily. The 2026-08-24 defect ran for six days and was
 * found by a person noticing that no Premium row had ever appeared — the
 * shortest path to "the sale is dead" that existed. An hour is the interval
 * at which archiving a price in the Stripe dashboard reports itself before
 * the next buyer meets it.
 */
function isAuthorized(request: NextRequest): boolean {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; the same secret
  // already gates /api/cron/backup, so there is one cron credential, not two.
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const report = await runStripePriceHealth();

  if (!report.ok) {
    // captureMessage, not captureException: nothing threw. This is a
    // measurement that came back wrong, and it should read that way on the
    // Sentry board rather than as a crash nobody can find a stack for.
    try {
      const summary = formatPriceHealth(report);
      console.error(summary);
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureMessage(
        `Stripe price health: ${report.failing.join(", ") || "no plans checked"} — ` +
          report.results
            .filter((r) => r.verdict !== "OK")
            .map((r) => `${r.envVar}=${r.verdict}`)
            .join(", "),
        {
          level: "error",
          tags: { defect: "stripe-price-health" },
          extra: {
            // Names, verdicts and amounts only — never a Price id and never
            // the value of an environment variable.
            verdicts: report.results.map((r) => `${r.envVar}: ${r.verdict}`),
            detail: report.results.filter((r) => r.verdict !== "OK").map((r) => r.detail),
          },
        }
      );
    } catch {
      // Reporting the problem must never become a second problem.
    }
  }

  return NextResponse.json({ ok: report.ok, failing: report.failing });
}
