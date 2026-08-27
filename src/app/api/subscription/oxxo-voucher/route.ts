import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getRateLimiter } from "@/lib/rate-limit";

const voucherLimiter = getRateLimiter("oxxo-voucher", 60_000, 10);

/**
 * The "Open my barcode" button on /profile's oxxo_pending banner. We never
 * store the Stripe-hosted voucher URL ourselves (see /api/checkout's oxxo
 * branch and /api/webhooks/stripe) — it only exists on the PaymentIntent
 * Stripe created for that checkout session, so this looks it up live: find
 * the visitor's most recent OXXO Checkout Session, pull its PaymentIntent,
 * and read `next_action.oxxo_display_details.hosted_voucher_url` off it.
 * That field disappears once the voucher is paid or has expired (3 days,
 * see `expires_after_days` in /api/checkout) — in either case there's
 * nothing useful to show, so this falls back to the profile page with a
 * "check your email instead" flag rather than a dead end.
 */
export async function GET(request: NextRequest) {
  const langRaw = new URL(request.url).searchParams.get("lang") ?? "";
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;
  const fallbackUrl = new URL(`/${lang}/profile?checkout=oxxo_pending&voucher=unavailable`, request.url);

  const user = await getCurrentUser();
  if (!user) {
    const url = new URL(`/${lang}/login`, request.url);
    url.searchParams.set("redirectTo", `/${lang}/profile`);
    return NextResponse.redirect(url, { status: 303 });
  }

  if (await voucherLimiter.check(user.id)) {
    return NextResponse.redirect(fallbackUrl, { status: 303 });
  }

  const stripe = getStripe();
  if (!stripe || !user.stripeCustomerId) {
    return NextResponse.redirect(fallbackUrl, { status: 303 });
  }

  const sessions = await stripe.checkout.sessions.list({
    customer: user.stripeCustomerId,
    limit: 5,
  });
  const oxxoSession = sessions.data.find(
    (session) => session.payment_method_types?.includes("oxxo") && session.payment_intent,
  );
  if (!oxxoSession?.payment_intent) {
    return NextResponse.redirect(fallbackUrl, { status: 303 });
  }

  const paymentIntentId =
    typeof oxxoSession.payment_intent === "string" ? oxxoSession.payment_intent : oxxoSession.payment_intent.id;
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const voucherUrl = paymentIntent.next_action?.oxxo_display_details?.hosted_voucher_url;

  if (!voucherUrl) {
    return NextResponse.redirect(fallbackUrl, { status: 303 });
  }
  return NextResponse.redirect(voucherUrl, { status: 303 });
}
