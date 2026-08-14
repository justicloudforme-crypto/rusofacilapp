import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isOwner, isRole } from "@/lib/roles";
import { defaultLocale, isLocale } from "@/i18n/config";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;
  const targetUserId = String(formData.get("userId") ?? "");
  const newRole = String(formData.get("role") ?? "");

  const usersUrl = new URL(`/${lang}/admin/users`, request.url);

  const actor = await getCurrentUser();
  if (!actor || !isOwner(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isRole(newRole)) {
    return NextResponse.redirect(usersUrl, { status: 303 });
  }

  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    return NextResponse.redirect(usersUrl, { status: 303 });
  }

  // Guard against locking everyone out of the admin dashboard: refuse to
  // demote the last remaining owner, regardless of who's asking.
  if (target.role === "owner" && newRole !== "owner") {
    const ownerCount = await db.user.count({ where: { role: "owner" } });
    if (ownerCount <= 1) {
      usersUrl.searchParams.set("error", "last_owner");
      return NextResponse.redirect(usersUrl, { status: 303 });
    }
  }

  await db.user.update({ where: { id: targetUserId }, data: { role: newRole } });

  return NextResponse.redirect(usersUrl, { status: 303 });
}
