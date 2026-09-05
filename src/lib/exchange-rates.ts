import "server-only";
import { cacheGet, cacheSet } from "./cache";

/**
 * One number: how many units of a currency one Mexican peso buys today.
 *
 * WHY THIS SOURCE. open.er-api.com (ExchangeRate-API's open endpoint) was
 * picked over the two obvious alternatives, and the reason is coverage, not
 * convenience:
 *
 *  * Frankfurter / the ECB reference rates are the cleanest free feed there
 *    is, and they are unusable HERE: the ECB publishes about 30 currencies
 *    and none of ARS, COP, CLP, PEN, UYU, PYG, BOB, CRC, GTQ, DOP. That is
 *    most of this site's audience — a Spanish-language Russian course sells
 *    to Latin America first. A feed that answers for Germany and not for
 *    Argentina answers the wrong question.
 *  * The keyed feeds (exchangerate.host, Fixer, and ExchangeRate-API's own
 *    paid tier) would add a secret to Vercel, to `.env`, to the e2e run and
 *    to every future contributor's setup, in exchange for a number that is
 *    decorative by design. The open endpoint needs no key at all.
 *
 * Measured 08.09.2026: it answers `GET /v6/latest/MXN` with 166 currencies,
 * every one of the 44 in COUNTRY_CURRENCY among them, and states its own
 * refresh cadence (`time_next_update_unix`) — once a day.
 *
 * WHAT HAPPENS WHEN IT IS DOWN. Nothing visible. Every failure path —
 * refusal, timeout, malformed body, a currency the feed does not carry —
 * returns null, and null means the page prints the peso price and no second
 * figure. The rate is never on the critical path of a render: a pricing page
 * that 500s because a third party is down would be a far worse bug than the
 * one this feature fixes.
 */

const ENDPOINT = "https://open.er-api.com/v6/latest/MXN";
const CACHE_KEY = "fx:mxn";

/**
 * Six hours. The feed itself moves once a day, so this is not about
 * freshness — it is about how many times an hour this app is willing to
 * depend on somebody else's uptime. Four calls a day per running instance,
 * against a rate that a "≈" already disclaims.
 */
const TTL_MS = 6 * 60 * 60 * 1000;

/** How long a render is willing to wait. Deliberately short: the figure is
 * secondary, the page is not, and a hung third party must not become this
 * site's time-to-first-byte. */
const TIMEOUT_MS = 2_500;

/**
 * A fixed rate table, as JSON, for runs that must not touch the network:
 * the e2e suite (playwright.config.ts sets it) and anyone reproducing a
 * measurement. When it is set the feed is never called at all — which is
 * also what makes the browser tests deterministic instead of quoting
 * whatever the market did that morning.
 */
const OVERRIDE_ENV = "FX_RATES_MXN";

function fromOverride(): Record<string, number> | null {
  const raw = process.env[OVERRIDE_ENV];
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : null;
  } catch {
    return null;
  }
}

async function fetchRates(): Promise<Record<string, number> | null> {
  try {
    const response = await fetch(ENDPOINT, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Next's own fetch cache as a second layer in front of the in-process
      // one: it is shared between the instances of a deployment, while the
      // Map in cache.ts is not (see its own note about that limit).
      next: { revalidate: TTL_MS / 1000 },
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") return null;
    const rates = (body as { rates?: unknown }).rates;
    if (!rates || typeof rates !== "object") return null;
    return rates as Record<string, number>;
  } catch {
    // Refused, timed out, or answered with something that is not JSON.
    // All three mean the same thing to the caller: no second figure.
    return null;
  }
}

/**
 * Units of `currency` per one peso, or null.
 *
 * Null on every failure, and null is a supported answer everywhere it is
 * read — see the module note above.
 */
export async function getPesoRate(currency: string): Promise<number | null> {
  const override = fromOverride();
  const rates = override ?? cacheGet<Record<string, number>>(CACHE_KEY) ?? (await fetchRates());
  if (!rates) return null;
  if (!override && !cacheGet(CACHE_KEY)) cacheSet(CACHE_KEY, rates, TTL_MS);

  const rate = rates[currency];
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : null;
}
