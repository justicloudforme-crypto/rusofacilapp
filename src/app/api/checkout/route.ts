import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { invalidateSubscriptionCache } from "@/lib/subscription";
import { isPlanId, plans } from "@/lib/plans";
import { defaultLocale, isLocale } from "@/i18n/config";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const planRaw = String(formData.get("plan") ?? "");
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;

  if (!isPlanId(planRaw)) {
    return NextResponse.redirect(new URL(`/${lang}/pricing`, request.url), { status: 303 });
  }

  const user = await getCurrentUser();
  if (!user) {
    const url = new URL(`/${lang}/login`, request.url);
    url.searchParams.set("redirectTo", `/${lang}/pricing`);
    return NextResponse.redirect(url, { status: 303 });
  }

  const plan = plans[planRaw];
  const stripe = getStripe();

  if (stripe && plan.priceId) {
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;
      await db.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      });
    }

    const origin = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: user.id,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      subscription_data: { metadata: { userId: user.id, plan: plan.id } },
      success_url: `${origin}/${lang}/profile?checkout=success`,
      cancel_url: `${origin}/${lang}/pricing?checkout=cancel`,
    });

    if (!session.url) {
      return NextResponse.redirect(new URL(`/${lang}/pricing`, request.url), { status: 303 });
    }
    return NextResponse.redirect(session.url, { status: 303 });
  }

  // Stripe isn't configured for this environment (no secret key / price id):
  // activate the subscription directly so the access-control flow can still
  // be exercised end-to-end in local/dev use without real Stripe credentials.
  // Deliberately does NOT call awardReferralRewardSafely — unlike the real
  // Stripe path, nothing here proves money changed hands, so treating it as
  // a qualifying "first checkout" would let anyone farm unlimited referral
  // rewards for free with throwaway accounts. Only the checkout.session.completed
  // webhook (a real payment) grants the reward.
  const currentPeriodEnd = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);
  await db.subscription.create({
    data: {
      userId: user.id,
      plan: plan.id,
      status: "active",
      currentPeriodEnd,
    },
  });
  await invalidateSubscriptionCache(user.id);

  return NextResponse.redirect(
    new URL(`/${lang}/profile?checkout=mock`, request.url),
    { status: 303 }
  );
}
