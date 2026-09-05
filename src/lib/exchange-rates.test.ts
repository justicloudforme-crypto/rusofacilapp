import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COUNTRY_CURRENCY } from "./currency";

/**
 * The rate feed, and — more to the point — every way it is allowed to fail.
 *
 * The claim this suite has to hold up is the one PROGRESS.md 7.118 makes to
 * a reader: "if the source is unreachable, show pesos only, and do not let
 * the page fall over." A third party's uptime is now on this app's render
 * path, which is exactly the kind of dependency that is fine until the day
 * it is not — so each failure shape gets its own test rather than one
 * "handles errors" case.
 *
 * The module caches in process memory, so each test re-imports it fresh
 * (vi.resetModules) — otherwise the first test's answer would be the
 * answer every later one gets, and the failure cases would pass by reading
 * a cache instead of by handling a failure.
 */

const OLD_ENV = process.env.FX_RATES_MXN;

async function load() {
  vi.resetModules();
  return import("./exchange-rates");
}

beforeEach(() => {
  delete process.env.FX_RATES_MXN;
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (OLD_ENV === undefined) delete process.env.FX_RATES_MXN;
  else process.env.FX_RATES_MXN = OLD_ENV;
});

describe("the fixture seam", () => {
  it("answers from FX_RATES_MXN without touching the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    process.env.FX_RATES_MXN = JSON.stringify({ ARS: 89.221548 });
    const { getPesoRate } = await load();

    expect(await getPesoRate("ARS")).toBe(89.221548);
    // The half that matters: the e2e run must be offline, not merely
    // deterministic.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a malformed fixture is ignored rather than crashing the render", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    process.env.FX_RATES_MXN = "{not json";
    const { getPesoRate } = await load();
    expect(await getPesoRate("ARS")).toBeNull();
  });
});

describe("every failure of the source means 'pesos only', never a throw", () => {
  const cases: Array<[string, () => unknown]> = [
    ["the request is refused", () => vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))],
    ["it times out", () => vi.fn().mockRejectedValue(new DOMException("aborted", "TimeoutError"))],
    ["it answers 500", () => vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })],
    [
      "it answers with something that is not JSON",
      () => vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError("<html>"); } }),
    ],
    [
      "it answers JSON with no rates in it",
      () => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: "error" }) }),
    ],
    [
      "it answers with rates that are not numbers",
      () => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { ARS: "89.2" } }) }),
    ],
  ];

  it.each(cases)("%s", async (_name, makeFetch) => {
    vi.stubGlobal("fetch", makeFetch());
    const { getPesoRate } = await load();
    await expect(getPesoRate("ARS")).resolves.toBeNull();
  });

  it("a currency the feed does not carry is null, not undefined or NaN", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { EUR: 0.05 } }) }));
    const { getPesoRate } = await load();
    expect(await getPesoRate("ARS")).toBeNull();
    expect(await getPesoRate("EUR")).toBe(0.05);
  });
});

describe("positive control — the good path must actually work", () => {
  it("without it, every 'returns null' above would pass on a broken module", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { ARS: 89.221548, SGD: 0.074971 } }) })
    );
    const { getPesoRate } = await load();
    expect(await getPesoRate("ARS")).toBe(89.221548);
    expect(await getPesoRate("SGD")).toBe(0.074971);
  });

  it("asks the feed once and serves the rest from memory", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ rates: { ARS: 1, SGD: 2, EUR: 3 } }) });
    vi.stubGlobal("fetch", fetchSpy);
    const { getPesoRate } = await load();
    await getPesoRate("ARS");
    await getPesoRate("SGD");
    await getPesoRate("EUR");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("the source covers what the allowlist promises", () => {
  /**
   * Not a unit test — it calls open.er-api.com for real, and it is skipped
   * unless FX_LIVE=1 is set. It is here because the one thing a mock can
   * never tell you is whether the feed actually carries ARS, COP, PYG and
   * GTQ, which is the whole reason this source was chosen over the ECB's
   * (see exchange-rates.ts). Run it by hand when the allowlist changes.
   */
  it.skipIf(process.env.FX_LIVE !== "1")("carries every currency in COUNTRY_CURRENCY", async () => {
    const { getPesoRate } = await load();
    const wanted = [...new Set(Object.values(COUNTRY_CURRENCY))];
    const missing: string[] = [];
    for (const currency of wanted) {
      if ((await getPesoRate(currency)) === null) missing.push(currency);
    }
    expect(missing).toEqual([]);
  }, 30_000);
});
