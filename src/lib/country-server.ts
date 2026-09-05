import "server-only";
import { headers } from "next/headers";
import { isDeployedEnvironment } from "./deploy-environment";
import { countryFromHeaders, isCashAvailableForCountry } from "./country";

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
