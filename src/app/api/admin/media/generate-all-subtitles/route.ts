import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { generateMissingMediaSubtitles } from "@/lib/media/generateAllSubtitles";

// generateMissingMediaSubtitles stops itself with time to spare (see its
// TIME_BUDGET_MS) — this just needs enough headroom above that budget for
// the platform to never kill the function first.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const force = body?.force === true;

  try {
    const results = await generateMissingMediaSubtitles({ force });
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "generation_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
