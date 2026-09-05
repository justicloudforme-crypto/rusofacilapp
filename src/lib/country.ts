// Where the buyer is, and the one decision that hangs on it: whether the
// cash (OXXO) payment method is offered at all.
//
// OXXO is a network of physical shops in Mexico and nowhere else. Stripe's
// own table says it plainly: the method is available to accounts registered
// in MX, for buyers in MX, in MXN. Until 07.09.2026 the cash tab was not
// merely offered to everyone — it was the tab every paid card OPENED on, in
// every country (PROGRESS.md 7.115). A buyer in Madrid met a Mexican corner
// shop first and a card second.
//
// Nothing here is server-only on purpose: the pricing cards are client
// components and need the same constant the server decided with.

/** The country Vercel derives from the request's own IP, attached to every
 * incoming request at the edge. Same family as VERCEL_TIMEZONE_HEADER in
 * src/lib/timezone.ts, which this project has been reading since
 * 02.09.2026. Two facts about it, both MEASURED on a deployment of this
 * project on 07.09.2026 rather than taken from the docs (this was debt 41):
 *
 *  1. it arrives, and it is populated — `MX`, alongside
 *     `x-vercel-ip-country-region=BCN` and `x-vercel-ip-city=Tijuana`,
 *     which is where the request came from;
 *  2. a client CANNOT fake it. The same request sent with
 *     `x-vercel-ip-country: ES` of its own still reached the function as
 *     `MX` — Vercel overwrites the whole `x-vercel-ip-*` family at the
 *     edge. That is what makes it usable as a gate and not merely a hint. */
export const VERCEL_COUNTRY_HEADER = "x-vercel-ip-country";

/** ISO 3166-1 alpha-2 of the only country where an OXXO voucher can be
 * paid. Not a list on purpose — a list would suggest there is a second
 * candidate, and there is not. */
export const CASH_COUNTRY = "MX";

/**
 * May this request be offered the cash method?
 *
 * The `deployed` argument decides the UNKNOWN case, and the two answers
 * are deliberately opposite:
 *
 *  * On a deployment an absent header means the platform did not tell us
 *    where the buyer is, and the safe answer is "no cash". The two failures
 *    are not symmetric: hiding OXXO from a Mexican leaves them a card that
 *    works, while showing OXXO to a Spaniard hands them a voucher no shop
 *    near them will take. One is an inconvenience, the other is a payment
 *    that cannot complete.
 *  * Off a deployment (a laptop, `next start`, the e2e run) the header does
 *    not exist at all and never will, so the same rule would delete the
 *    cash path from local development and from every test that exercises
 *    it. There, unknown means MX — and a test that wants the other side
 *    sends the header itself.
 */
export function isCashAvailableForCountry(country: string | null | undefined, deployed: boolean): boolean {
  if (!country) return !deployed;
  return country.toUpperCase() === CASH_COUNTRY;
}

/** The country of a request, from anything with a `get` — a `Headers`, or
 * Next's own read-only header store. Null when absent or empty. */
export function countryFromHeaders(headers: { get(name: string): string | null } | null | undefined): string | null {
  const value = headers?.get(VERCEL_COUNTRY_HEADER);
  return value ? value : null;
}
