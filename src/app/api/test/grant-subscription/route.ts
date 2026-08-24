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
export async function POST() {
  if (process.env.E2E_TEST_SEED !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await extendOrGrantSubscription(user.id, 1, "e2e-test");
  return NextResponse.json({ granted: true });
}
