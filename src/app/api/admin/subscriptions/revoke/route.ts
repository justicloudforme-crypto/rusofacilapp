import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isOwner } from "@/lib/roles";
import {
  getSubscriptionsForUser,
  invalidateSubscriptionCache,
  isSubscriptionActive,
} from "@/lib/subscription";
import { getStripe } from "@/lib/stripe";
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

  // Every live row, not just the newest one. Revoke is the owner saying
  // "this account should not have access" — leaving a second live row
  // behind (an admin grant under a cancelled monthly plan, a Premium
  // purchase under a referral bonus) would make the button silently not do
  // what it says, and the access check reads every row.
  const rows = await getSubscriptionsForUser(targetUserId);
  const live = rows.filter((row) => isSubscriptionActive(row));
  if (live.length > 0) {
    const stripe = getStripe();
    for (const row of live) {
      if (stripe && row.stripeSubscriptionId) {
        await stripe.subscriptions.cancel(row.stripeSubscriptionId).catch(() => {});
      }
    }
    await db.subscription.updateMany({
      where: { id: { in: live.map((row) => row.id) } },
      data: { status: "canceled" },
    });
    await invalidateSubscriptionCache(targetUserId);
  }

  return NextResponse.redirect(new URL(`/${lang}/admin/subscriptions`, request.url), {
    status: 303,
  });
}
