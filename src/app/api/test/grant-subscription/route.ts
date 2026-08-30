import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { extendOrGrantSubscription } from "@/lib/subscription";

/**
 * Test-only: grants the signed-in caller a short-lived active
 * subscription so e2e specs can reach the now-gated Vocabulary/Stories/
 * Media/Word games sections (see proxy.ts's protectContentRoute)
 * without driving a real Stripe checkout. 404s unless E2E_TEST_SEED is
 * set — only true for the server playwright.config.ts's webServer spawns
 * for a test run (see its `env`), never on a real deployment. A plain
 * NODE_ENV check can't do this job: `next start` always forces
 * NODE_ENV=production regardless of how the build was made, and the e2e
 * suite deliberately runs against a production build.
 */
export async function POST(request: Request) {
  if (process.env.E2E_TEST_SEED !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Which plan matters, and it did not used to. The three-tier model
  // (src/lib/entitlement.ts) reads Subscription.plan: only "lifetime"
  // resolves to "premium", and ★ (curved) puzzles, premiumOnly rows and C1
  // content need premium specifically. The old fixed "e2e-test" plan
  // resolves to "standard", so e2e/word-games.spec.ts's ★ test was being
  // redirected to /pricing every single run — invisibly, because the test
  // ahead of it in a serial file failed first and Playwright never got to
  // it. Callers ask for what they need; the default stays "standard", so a
  // spec that means to test standard-tier access still does.
  const body = (await request.json().catch(() => null)) as { plan?: unknown } | null;
  const plan = body?.plan === "lifetime" ? "lifetime" : "e2e-test";

  await extendOrGrantSubscription(user.id, 1, plan);
  return NextResponse.json({ granted: true, plan });
}
