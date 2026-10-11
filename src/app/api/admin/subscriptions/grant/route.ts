import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isOwner } from "@/lib/roles";
import { extendOrGrantSubscription, MANUAL_GRANT_DAYS } from "@/lib/subscription";
import { defaultLocale, isLocale } from "@/i18n/config";
import { readRequestForm } from "@/lib/request-form";

export async function POST(request: NextRequest) {
  const read = await readRequestForm(request);
  if (!read.ok) return read.response;
  const formData = read.form;
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;
  const targetUserId = String(formData.get("userId") ?? "");

  const actor = await getCurrentUser();
  if (!actor || !isOwner(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await extendOrGrantSubscription(target.id, MANUAL_GRANT_DAYS, "manual");

  return NextResponse.redirect(new URL(`/${lang}/admin/subscriptions`, request.url), {
    status: 303,
  });
}
