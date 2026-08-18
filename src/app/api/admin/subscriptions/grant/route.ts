import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isOwner } from "@/lib/roles";
import {
  getLatestSubscription,
  invalidateSubscriptionCache,
  isSubscriptionActive,
  MANUAL_GRANT_DAYS,
} from "@/lib/subscription";
import { defaultLocale, isLocale } from "@/i18n/config";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
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

  const extraMs = MANUAL_GRANT_DAYS * 24 * 60 * 60 * 1000;
  const existing = await getLatestSubscription(target.id);

  if (existing && isSubscriptionActive(existing)) {
    // Extend the current period instead of stacking a second row.
    await db.subscription.update({
      where: { id: existing.id },
      data: {
        status: "active",
        currentPeriodEnd: new Date(existing.currentPeriodEnd.getTime() + extraMs),
      },
    });
  } else {
    await db.subscription.create({
      data: {
        userId: target.id,
        plan: "manual",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + extraMs),
      },
    });
  }
  await invalidateSubscriptionCache(target.id);

  return NextResponse.redirect(new URL(`/${lang}/admin/subscriptions`, request.url), {
    status: 303,
  });
}
