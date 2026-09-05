import { describe, expect, it } from "vitest";
import { CASH_COUNTRY, VERCEL_COUNTRY_HEADER, countryFromHeaders, isCashAvailableForCountry } from "./country";

/**
 * The rule that decides who is offered an OXXO voucher.
 *
 * Its whole point is the asymmetry of the UNKNOWN case: on a deployment
 * "we don't know" must mean "no cash", and off one it must mean the
 * opposite, or local development and the e2e suite lose the cash path
 * entirely. Both directions are asserted below, because a rule that only
 * ever answered "false" would pass half of them.
 */
describe("isCashAvailableForCountry", () => {
  it("offers cash in Mexico", () => {
    expect(isCashAvailableForCountry("MX", true)).toBe(true);
    expect(isCashAvailableForCountry(CASH_COUNTRY, true)).toBe(true);
  });

  it("does not offer cash anywhere else", () => {
    // ES and CO are the two the survey named by name: Spain, and the
    // Spanish-speaking country with the largest audience after Mexico.
    for (const country of ["ES", "CO", "AR", "US", "RU", "BR"]) {
      expect(isCashAvailableForCountry(country, true)).toBe(false);
    }
  });

  it("does not care how the platform cases the code", () => {
    expect(isCashAvailableForCountry("mx", true)).toBe(true);
  });

  it("refuses cash on a deployment that did not say where the buyer is", () => {
    expect(isCashAvailableForCountry(null, true)).toBe(false);
    expect(isCashAvailableForCountry("", true)).toBe(false);
    expect(isCashAvailableForCountry(undefined, true)).toBe(false);
  });

  // NEGATIVE CONTROL, and the reason the `deployed` argument exists at
  // all. There is no such header on a laptop or in the e2e run, and
  // applying the deployment rule there would delete the cash tab from
  // every local page and from e2e/checkout.spec.ts, which pays with it.
  it("keeps cash off a deployment, where the header cannot exist", () => {
    expect(isCashAvailableForCountry(null, false)).toBe(true);
    // ...but an explicit country still wins, which is how a test asks for
    // the other side of the rule without deploying anything.
    expect(isCashAvailableForCountry("ES", false)).toBe(false);
  });
});

describe("countryFromHeaders", () => {
  it("reads the header Vercel attaches, and nothing else", () => {
    expect(countryFromHeaders(new Headers({ [VERCEL_COUNTRY_HEADER]: "MX" }))).toBe("MX");
    expect(countryFromHeaders(new Headers())).toBe(null);
    expect(countryFromHeaders(new Headers({ "x-country": "MX" }))).toBe(null);
    expect(countryFromHeaders(undefined)).toBe(null);
  });
});
