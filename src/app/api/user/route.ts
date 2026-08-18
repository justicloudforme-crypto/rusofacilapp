import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getRateLimiter } from "@/lib/rate-limit";
import { isAvatarId } from "@/lib/avatars";

// Lets the profile page's "personal data" tab update the display name and/or
// avatar shown across the app (header dropdown, dropdown greeting, etc).
// Everything else on User (email, role) is either immutable in this
// demo-auth setup or admin-only, so this route only ever touches these two
// fields, each independently optional so ThemeSwitcher-style single-field
// saves (e.g. clicking an avatar) don't need to resend the name too.
const userUpdateLimiter = getRateLimiter("userUpdate", 60_000, 20);

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (await userUpdateLimiter.check(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const hasName = typeof body?.name === "string";
  const hasAvatarId = typeof body?.avatarId === "string";
  if (!hasName && !hasAvatarId) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const data: { name?: string | null; avatarId?: string } = {};

  if (hasName) {
    const rawName = (body.name as string).trim();
    if (rawName.length > 100) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    data.name = rawName.length > 0 ? rawName : null;
  }

  if (hasAvatarId) {
    if (!isAvatarId(body.avatarId)) {
      return NextResponse.json({ error: "Invalid avatarId" }, { status: 400 });
    }
    data.avatarId = body.avatarId;
  }

  const updated = await db.user.update({ where: { id: user.id }, data });

  return NextResponse.json({ name: updated.name, avatarId: updated.avatarId });
}
