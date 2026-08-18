import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLatestSubscription, invalidateSubscriptionCache } from "@/lib/subscription";
import { getStripe } from "@/lib/stripe";
import { defaultLocale, isLocale } from "@/i18n/config";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/${lang}/login`, request.url), { status: 303 });
  }

  const subscription = await getLatestSubscription(user.id);
  if (subscription) {
    const stripe = getStripe();
    if (stripe && subscription.stripeSubscriptionId) {
      // Best-effort: cancel on Stripe's side too. If this fails (e.g. the
      // subscription was already canceled there), we still revoke local
      // access below — the webhook will reconcile status either way.
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId).catch(() => {});
    }

    await db.subscription.update({
      where: { id: subscription.id },
      data: { status: "canceled" },
    });
    await invalidateSubscriptionCache(user.id);
  }

  return NextResponse.redirect(
    new URL(`/${lang}/profile?subscription=canceled`, request.url),
    { status: 303 }
  );
}
