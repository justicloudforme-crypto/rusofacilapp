import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isOwner } from "@/lib/roles";
import { getLatestSubscription, invalidateSubscriptionCache } from "@/lib/subscription";
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

  const subscription = await getLatestSubscription(targetUserId);
  if (subscription) {
    const stripe = getStripe();
    if (stripe && subscription.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId).catch(() => {});
    }
    await db.subscription.update({
      where: { id: subscription.id },
      data: { status: "canceled" },
    });
    await invalidateSubscriptionCache(targetUserId);
  }

  return NextResponse.redirect(new URL(`/${lang}/admin/subscriptions`, request.url), {
    status: 303,
  });
}
