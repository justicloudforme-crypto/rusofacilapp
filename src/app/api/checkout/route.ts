import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { invalidateSubscriptionCache } from "@/lib/subscription";
import { isCheckoutMethod, isPlanId, plans } from "@/lib/plans";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getRateLimiter } from "@/lib/rate-limit";

const PLAN_LABELS: Record<string, string> = {
  monthly: "Suscripción mensual",
  annual: "Suscripción anual",
};

// Every other mutating route in this app has a rate limiter — this one was
// the exception despite being the highest-stakes: each call creates a real
// Stripe Checkout Session (an API call Stripe itself rate-limits, and for
// the OXXO branch, a real one-time payment object). Generous limit: a
// student retrying after closing the Stripe tab, or comparing monthly vs.
// annual, is normal use — this only stops a runaway retry loop or script.
const checkoutLimiter = getRateLimiter("checkout", 60_000, 10);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const planRaw = String(formData.get("plan") ?? "");
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;
  const methodRaw = String(formData.get("method") ?? "card");
  const method = isCheckoutMethod(methodRaw) ? methodRaw : "card";

  if (!isPlanId(planRaw)) {
    return NextResponse.redirect(new URL(`/${lang}/pricing`, request.url), { status: 303 });
  }

  const user = await getCurrentUser();
  if (!user) {
    const url = new URL(`/${lang}/login`, request.url);
    url.searchParams.set("redirectTo", `/${lang}/pricing`);
    return NextResponse.redirect(url, { status: 303 });
  }

  if (await checkoutLimiter.check(user.id)) {
    return NextResponse.redirect(new URL(`/${lang}/pricing?checkout=rate_limited`, request.url), {
      status: 303,
    });
  }

  const plan = plans[planRaw];
  const stripe = getStripe();
  const origin = new URL(request.url).origin;

  if (stripe && (method === "oxxo" || plan.priceId)) {
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

    if (method === "oxxo") {
      // OXXO is a cash-voucher payment method: the customer gets a barcode
      // (shown on Stripe's own hosted checkout page, and emailed to them)
      // and pays in person at a physical OXXO store, usually within a few
      // days. There is no reusable off-session payment instrument behind
      // it, so — unlike the card branch below — this can never be a
      // recurring Stripe Subscription; it's a one-time payment that grants
      // a fixed period of access once the voucher is actually paid. Access
      // is NOT granted here: see the checkout.session.async_payment_succeeded
      // handler in /api/webhooks/stripe, which fires only once the store
      // payment clears (checkout.session.completed fires immediately on
      // voucher creation, before any money has moved).
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: stripeCustomerId,
        client_reference_id: user.id,
        payment_method_types: ["oxxo"],
        payment_method_options: { oxxo: { expires_after_days: 3 } },
        line_items: [
          {
            price_data: {
              currency: "mxn",
              unit_amount: plan.oxxoAmountMxnCents,
              product_data: { name: `RusoFácilapp — ${PLAN_LABELS[plan.id]}` },
            },
            quantity: 1,
          },
        ],
        metadata: { userId: user.id, plan: plan.id },
        success_url: `${origin}/${lang}/profile?checkout=oxxo_pending`,
        cancel_url: `${origin}/${lang}/pricing?checkout=cancel`,
      });

      if (!session.url) {
        return NextResponse.redirect(new URL(`/${lang}/pricing`, request.url), { status: 303 });
      }
      return NextResponse.redirect(session.url, { status: 303 });
    }

    if (plan.priceId) {
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
