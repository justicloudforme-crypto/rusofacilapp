import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { invalidateSubscriptionCache } from "@/lib/subscription";
import { BASE_CURRENCY, isCheckoutMethod, isPlanId, plans } from "@/lib/plans";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getRateLimiter } from "@/lib/rate-limit";
import { isDeployedEnvironment } from "@/lib/deploy-environment";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";

const PLAN_LABELS: Record<string, string> = {
  monthly: "Suscripción mensual",
  annual: "Suscripción anual",
  lifetime: "Premium (acceso de por vida)",
};

// Every other mutating route in this app has a rate limiter — this one was
// the exception despite being the highest-stakes: each call creates a real
// Stripe Checkout Session (an API call Stripe itself rate-limits, and for
// the OXXO branch, a real one-time payment object). Generous limit: a
// student retrying after closing the Stripe tab, or comparing monthly vs.
// annual, is normal use — this only stops a runaway retry loop or script.
const checkoutLimiter = getRateLimiter("checkout", 60_000, 10);

/**
 * Is this the Stripe API refusing the request we sent it?
 *
 * Checked by `type` rather than with `instanceof Stripe.errors.*` so this
 * file does not have to import the Stripe SDK's error classes, and so a test
 * can plant the error without constructing one. Stripe sets `.type` on every
 * error it raises; `StripeInvalidRequestError` is the 4xx family — "no such
 * price", "the price specified is inactive", a parameter we got wrong. It is
 * the shape of failure the 2026-08-24 defect produced for six days, and it is
 * a configuration fault on our side, never the buyer's.
 */
function isStripeInvalidRequest(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { type?: unknown }).type === "StripeInvalidRequestError"
  );
}

/**
 * What a person sees when Stripe refuses to open the payment.
 *
 * Until now nothing caught this: the exception escaped the route handler,
 * Next answered 500, `onRequestError` filed it in Sentry as UNHANDLED, and
 * the buyer got a browser error page. 503 says "shut, not broken forever",
 * the message is in the visitor's own language, and it states the one fact
 * that matters to them — nothing was charged.
 *
 * Deliberately a self-contained page rather than a redirect to /pricing: a
 * redirect answers 303, and a checkout that cannot charge anybody must not
 * be recorded as a successful request.
 *
 * The body carries NO detail from Stripe — not the message, not the Price id,
 * not the parameter name. Stripe quotes the offending value back inside its
 * error text, and that value comes from an environment variable.
 */
async function checkoutBlockedResponse(lang: Locale, origin: string): Promise<NextResponse> {
  const dict = await getDictionary(lang);
  const message = dict.pricing.checkoutUnavailable;
  const backLabel = dict.nav.pricing;
  const escape = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `<!doctype html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escape(backLabel)}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:2rem;line-height:1.6;max-width:36rem}</style>
</head>
<body>
<p>${escape(message)}</p>
<p><a href="${origin}/${lang}/pricing">${escape(backLabel)}</a></p>
</body>
</html>`;

  return new NextResponse(html, {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

/** Files the refusal in Sentry as HANDLED — we caught it, we answered it, and
 * the buyer was told. The tag is what an alert keys off. */
async function reportCheckoutBlocked(error: unknown, plan: string, method: string): Promise<void> {
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error, {
      level: "error",
      tags: { defect: "checkout-blocked" },
      extra: { plan, method },
    });
  } catch {
    // Reporting the problem must never become a second problem.
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const planRaw = String(formData.get("plan") ?? "");
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;
  const methodRaw = String(formData.get("method") ?? "card");
  const method = isCheckoutMethod(methodRaw) ? methodRaw : "card";
  // Where to send the visitor back to after a successful card checkout —
  // e.g. the word-game or story page that triggered the paywall — instead
  // of always landing on /profile. Restricted to a same-locale in-app path
  // so this can't be turned into an open redirect via a crafted form post.
  const nextRaw = String(formData.get("next") ?? "");
  const nextPath = nextRaw.startsWith(`/${lang}/`) && !nextRaw.startsWith("//") ? nextRaw : null;

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
    try {
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
        // a fixed period of access once the voucher is actually paid.
        //
        // The amount is the plan's own `amountMxnCents` and the currency is
        // the same BASE_CURRENCY the card Price is in — since 2026-09-06
        // there is one price per plan, not a peso figure for cash beside a
        // dollar figure for cards (PROGRESS.md 7.116). Access
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
                currency: BASE_CURRENCY,
                unit_amount: plan.amountMxnCents,
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
        // subscription_data.metadata only applies to mode: "subscription" —
        // Stripe rejects it on a mode: "payment" session, so the lifetime
        // (one-time) plan carries its metadata on the session itself instead,
        // same place the OXXO one-time branch above puts it.
        const session = await stripe.checkout.sessions.create({
          mode: plan.mode,
          customer: stripeCustomerId,
          client_reference_id: user.id,
          line_items: [{ price: plan.priceId, quantity: 1 }],
          ...(plan.mode === "subscription"
            ? { subscription_data: { metadata: { userId: user.id, plan: plan.id } } }
            : { metadata: { userId: user.id, plan: plan.id } }),
          // `plan` rides along so the page a buyer lands on can check that
          // the account actually holds what was just paid for, instead of
          // congratulating them on a purchase that did not take effect —
          // which is what it did throughout the 7.55 defect. See
          // CheckoutOutcomeNotice.
          success_url: `${origin}${nextPath ?? `/${lang}/profile`}${(nextPath ?? "").includes("?") ? "&" : "?"}checkout=success&plan=${plan.id}`,
          cancel_url: `${origin}/${lang}/pricing?checkout=cancel`,
        });

        if (!session.url) {
          return NextResponse.redirect(new URL(`/${lang}/pricing`, request.url), { status: 303 });
        }
        return NextResponse.redirect(session.url, { status: 303 });
      }
    } catch (error) {
      // Only Stripe's own refusals become a page. Anything else — a database
      // write failing, a bug of ours — keeps rising, because dressing an
      // unknown fault up as "try again in a few minutes" would hide it from
      // the one place that would have shown it.
      if (!isStripeInvalidRequest(error)) throw error;
      await reportCheckoutBlocked(error, plan.id, method);
      return checkoutBlockedResponse(lang, origin);
    }
  }

  // Everything below is the no-Stripe fallback, and it grants access
  // without anyone paying. On a laptop that is the point; on a deployment
  // it is the paywall switching itself off.
  //
  // It is reachable there by one missing environment variable — an unset
  // STRIPE_SECRET_KEY skips the whole branch above, and an unset
  // STRIPE_PRICE_LIFETIME skips it for the Premium plan alone (see
  // src/lib/plans.ts: the price ids come from the environment and are
  // `undefined` when absent). Either way the visitor would land here, be
  // handed the plan they asked for, and be redirected to a page reading
  // "subscription activated" — with no payment, no Stripe object, and
  // nothing in any log saying anything unusual happened. Exactly the shape
  // of failure that let 7.55 live for six days: every part reports success.
  //
  // So on a real deployment this is refused instead. The visitor gets the
  // pricing page back with an error flag rather than free Premium, and the
  // misconfiguration reports itself to Sentry, where a checkout that cannot
  // charge anybody is worth waking up for. The gate is VERCEL_ENV, for the
  // reasons in src/lib/deploy-environment.ts — NODE_ENV cannot tell a
  // deployment from `next start` on this laptop, and the e2e suite runs
  // under NODE_ENV=production too.
  if (isDeployedEnvironment()) {
    try {
      const error = new Error(
        `Checkout for plan "${plan.id}" (${method}) fell through to the no-Stripe fallback on a deployment: ` +
          `${stripe ? "STRIPE_SECRET_KEY is set" : "STRIPE_SECRET_KEY is MISSING"}, ` +
          `price id ${plan.priceId ? "present" : "MISSING"}. No payment was taken and no access was granted.`
      );
      error.name = "CheckoutFellThroughToFreeGrant";
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(error, {
        level: "error",
        tags: { defect: "checkout-free-grant-fallback" },
        extra: { plan: plan.id, method, hasStripe: Boolean(stripe), hasPriceId: Boolean(plan.priceId) },
      });
    } catch {
      // Reporting the problem must never become a second problem.
    }
    return NextResponse.redirect(new URL(`/${lang}/pricing?checkout=unavailable`, request.url), {
      status: 303,
    });
  }

  // Local/dev only: activate the subscription directly so the
  // access-control flow can still be exercised end-to-end without real
  // Stripe credentials.
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
    new URL(`${nextPath ?? `/${lang}/profile`}?checkout=mock`, request.url),
    { status: 303 }
  );
}
