import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { getMediaById, setManualOverride } from "@/lib/media/data";

/**
 * Toggles MediaOverride.manualOverride for one item — protects (or
 * unprotects) it from being silently rewritten by the next automated
 * embed-status check (see check-embeds/route.ts and the schema comment on
 * MediaOverride). Staff use this from the admin panel when a direct user
 * report contradicts what the YouTube Data API says, or to release the
 * protection once a replacement source has been verified.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const manualOverride = typeof body?.manualOverride === "boolean" ? body.manualOverride : null;
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : undefined;
  if (!id || manualOverride === null) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const item = await getMediaById(id);
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await setManualOverride(id, manualOverride, note);
  return NextResponse.json({ ok: true, id, manualOverride });
}
