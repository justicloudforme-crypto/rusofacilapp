import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, createSession } from "@/lib/auth";
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "@/lib/password";
import { getRateLimiter } from "@/lib/rate-limit";

// For a signed-in user who still remembers their current password — unlike
// reset-password (which proves identity via an emailed link instead), this
// keeps the CURRENT device signed in: sessionVersion still bumps (every
// other device gets signed out, same as any password change should do),
// but this request immediately re-issues a fresh cookie for itself with
// the new version, rather than making the user re-login on the device they
// just used to make the change.
const changePasswordLimiter = getRateLimiter("changePassword", 60_000, 10);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (changePasswordLimiter.check(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!user.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "invalid_current_password" }, { status: 400 });
  }
  if (!isPasswordStrongEnough(newPassword)) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  const updated = await db.user.update({
    where: { id: user.id },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  });

  await createSession(updated.id, updated.sessionVersion);

  return NextResponse.json({ ok: true });
}
