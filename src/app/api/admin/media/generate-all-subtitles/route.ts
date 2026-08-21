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

  // Write Once, Lock Forever: `force` is intentionally NOT read from the
  // request body here (it used to be — a real gap, since any POST to this
  // route, not just the admin button, could have re-billed the entire
  // catalog). Re-generating an already-saved item is a deliberate CLI
  // action scoped to one id (prisma/generate-media-subtitles.ts --force=id),
  // never something a web request can trigger, blank body or not.
  await request.json().catch(() => null);

  try {
    const results = await generateMissingMediaSubtitles();
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "generation_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
