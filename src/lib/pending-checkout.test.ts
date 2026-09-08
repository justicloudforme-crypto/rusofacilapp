import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * DEBT 30 — the voucher that left no trace.
 *
 * An OXXO voucher is payable for three days. Nothing about it was stored, so
 * the only sign a person had one was `?checkout=oxxo_pending` in the URL of
 * the single page Stripe bounced them to. Close the tab, come back to
 * /profile, and the page told somebody holding a payable barcode that they
 * had no subscription, with a buy button under it.
 *
 * These cases are about the record: what it selects as outstanding, and that
 * it can only ever be settled once.
 */
async function withDb(pendingCheckout: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock("./db", () => ({ db: { pendingCheckout } }));
  return import("./pending-checkout");
}

describe("what counts as an outstanding voucher", () => {
  it("asks for this person's unsettled, unexpired vouchers, newest first", async () => {
    const findMany = vi.fn<(args: Record<string, never>) => Promise<unknown[]>>(async () => []);
    const mod = await withDb({ findMany });

    await mod.getOpenPendingCheckouts("user_1");

    const args = findMany.mock.calls[0]![0] as unknown as {
      where: { userId: string; settledAt: null; expiresAt: { gt: Date } };
      orderBy: { createdAt: string };
    };
    expect(args.where.userId).toBe("user_1");
    // All three conditions matter. Without `settledAt: null` a paid voucher
    // would keep telling the buyer to go and pay; without the expiry a dead
    // barcode would do the same for ever.
    expect(args.where.settledAt).toBeNull();
    expect(args.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual({ createdAt: "desc" });
  });

  it("names one voucher for the banner, or null when there is none", async () => {
    const rows = [{ id: "pc_new" }, { id: "pc_old" }];
    let mod = await withDb({ findMany: vi.fn(async () => rows) });
    expect((await mod.getOpenPendingCheckout("user_1"))?.id).toBe("pc_new");

    mod = await withDb({ findMany: vi.fn(async () => []) });
    expect(await mod.getOpenPendingCheckout("user_1")).toBeNull();
  });
});

describe("opening and settling the record", () => {
  it("is idempotent on the Stripe session id", async () => {
    // Stripe can deliver an event twice and a form can be double-submitted.
    // A second record for one session would make "how many vouchers are
    // outstanding" a lie, which is the whole question this table answers.
    const upsert = vi.fn<(args: unknown) => Promise<unknown>>(async () => ({}));
    const mod = await withDb({ upsert });

    await mod.openPendingCheckout({
      userId: "user_1",
      plan: "monthly",
      stripeSessionId: "cs_1",
      expiresAt: new Date("2026-09-11T00:00:00.000Z"),
    });

    const args = upsert.mock.calls[0]![0] as unknown as {
      where: { stripeSessionId: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    };
    expect(args.where).toEqual({ stripeSessionId: "cs_1" });
    expect(args.update).toEqual({});
    expect(args.create).toMatchObject({ userId: "user_1", plan: "monthly", method: "oxxo" });
  });

  it("settles only a voucher that is still open, so a late event cannot rewrite the outcome", async () => {
    const updateMany = vi.fn<(args: unknown) => Promise<{ count: number }>>(async () => ({ count: 1 }));
    const mod = await withDb({ updateMany });

    expect(await mod.settlePendingCheckout("cs_1", "paid")).toBe(1);

    const args = updateMany.mock.calls[0]![0] as unknown as {
      where: { stripeSessionId: string; settledAt: null };
      data: { settledAt: Date; outcome: string };
    };
    expect(args.where).toEqual({ stripeSessionId: "cs_1", settledAt: null });
    expect(args.data.outcome).toBe("paid");
    expect(args.data.settledAt).toBeInstanceOf(Date);
  });

  it("is a no-op, not a throw, for a session this app has no record of", async () => {
    // `updateMany` rather than `update`: a webhook that throws is a webhook
    // Stripe retries for ever, and a voucher created before this table
    // existed is a real case.
    const mod = await withDb({ updateMany: vi.fn(async () => ({ count: 0 })) });
    await expect(mod.settlePendingCheckout("cs_unknown", "expired")).resolves.toBe(0);
  });
});
