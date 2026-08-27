import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { clearDecision, saveDecision, type AudioReviewDecisionValue } from "@/lib/audio-review";

/**
 * Backs the local-only /admin/audio-review page (see that page's own
 * comment for why this whole tool exists and why it never touches
 * narration data itself). Hard-blocked in production regardless of role —
 * this is a raw internal QA tool, not something meant to ever be reachable
 * on the live site, even by a logged-in owner/admin.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { storyId?: string; itemKey?: string; decision?: AudioReviewDecisionValue | null }
    | null;
  if (!body?.storyId || !body.itemKey) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (body.decision === "ok" || body.decision === "regenerate") {
    await saveDecision(body.storyId, body.itemKey, body.decision);
  } else {
    await clearDecision(body.storyId, body.itemKey);
  }

  return NextResponse.json({ status: "saved" });
}
