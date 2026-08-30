import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  getSubscriptionsForUser,
  invalidateSubscriptionCache,
  isPremiumPlan,
  isSubscriptionActive,
} from "@/lib/subscription";
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

  // "Cancel my subscription" means the recurring thing the person is being
  // billed for — every live one of them, since a user can hold more than
  // one row (a card subscription plus an admin grant, say) and cancelling
  // only the newest would leave them still billed on the other. A Premium
  // row is deliberately excluded: it is a one-time purchase that is already
  // paid for and cannot be un-bought, so cancelling a monthly plan must not
  // take it down with it. Someone who wants their account gone entirely
  // uses account deletion, which is a different button with a different
  // confirmation.
  const rows = await getSubscriptionsForUser(user.id);
  const cancellable = rows.filter((row) => isSubscriptionActive(row) && !isPremiumPlan(row.plan));

  if (cancellable.length > 0) {
    const stripe = getStripe();
    for (const row of cancellable) {
      if (stripe && row.stripeSubscriptionId) {
        // Best-effort: cancel on Stripe's side too. If this fails (e.g. the
        // subscription was already canceled there), we still revoke local
        // access below — the webhook will reconcile status either way.
        await stripe.subscriptions.cancel(row.stripeSubscriptionId).catch(() => {});
      }
    }
    await db.subscription.updateMany({
      where: { id: { in: cancellable.map((row) => row.id) } },
      data: { status: "canceled" },
    });
    await invalidateSubscriptionCache(user.id);
  }

  return NextResponse.redirect(
    new URL(`/${lang}/profile?subscription=canceled`, request.url),
    { status: 303 }
  );
}
