import "server-only";
import { headers } from "next/headers";
import { isDeployedEnvironment } from "./deploy-environment";
import { countryFromHeaders, isCashAvailableForCountry } from "./country";
import { currencyForCountry, type LocalPriceContext } from "./currency";
import { getPesoRate } from "./exchange-rates";

/** ISO country code of the current request, or null when the platform did
 * not attach one (which is every request outside a Vercel deployment). */
export async function getRequestCountry(): Promise<string | null> {
  return countryFromHeaders(await headers());
}

/** The single question the pricing page asks: does this visitor get the
 * cash tab at all. See src/lib/country.ts for why "unknown" answers
 * differently on a deployment than on a laptop. */
export async function isCashAvailableForRequest(): Promise<boolean> {
  return isCashAvailableForCountry(await getRequestCountry(), isDeployedEnvironment());
}

/**
 * The visitor's currency and today's rate for it, or null when there is
 * nothing to show: no country header, a country outside the allowlist in
 * src/lib/currency.ts, Mexico itself, or a rate feed that did not answer.
 *
 * Note what does NOT happen when the country is unknown: the rate feed is
 * not called. That is deliberate and load-bearing — a statically prerendered
 * page has no request headers, so a build can never reach the network
 * through this function, and neither can a laptop render.
 *
 * Unlike isCashAvailableForRequest, there is no `deployed` asymmetry here.
 * Cash has to default to SOMETHING because a payment method is either
 * offered or not; a second price figure has a third option — say nothing —
 * and "we do not know where you are" is exactly when saying nothing is
 * right.
 */
export async function getLocalPriceContext(): Promise<LocalPriceContext | null> {
  const currency = currencyForCountry(await getRequestCountry());
  if (!currency) return null;
  const rate = await getPesoRate(currency);
  return rate === null ? null : { currency, rate };
}
