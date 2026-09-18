import { describe, expect, it } from "vitest";
import { needBackfill, plannedRow } from "../../scripts/backfill-subscription-payments.mjs";

/**
 * ПЕРЕНОС УЖЕ СОВЕРШЁННЫХ ПЛАТЕЖЕЙ — 7.214, задача 2.
 *
 * Сам перенос в этом заходе НЕ делался (нужен ключ Stripe и запись в
 * боевую базу, и то и другое было запрещено условиями захода). Под
 * тестом здесь ПРАВИЛО отбора: кого переносить, а кого нет. Без него
 * сухой прогон печатал бы список, за который никто не отвечает.
 *
 * Замер на проде 18.09.2026, который эти случаи и описывают: строк
 * `Subscription` 6, из них подписок Stripe 2, строк журнала 0 —
 * значит переносу подлежат 2 из 2.
 */
interface Sub {
  id: string;
  userId: string;
  plan: string;
  stripeSubscriptionId: string | null;
}

const SUBS: Sub[] = [
  { id: "row_canceled", userId: "u1", plan: "monthly", stripeSubscriptionId: "sub_A" },
  { id: "row_live", userId: "u2", plan: "monthly", stripeSubscriptionId: "sub_B" },
  { id: "row_manual", userId: "u3", plan: "manual", stripeSubscriptionId: null },
  { id: "row_code", userId: "u4", plan: "access_code", stripeSubscriptionId: null },
];

describe("кого переносить в журнал платежей", () => {
  it("прод как он есть: журнала нет вовсе — переносу подлежат обе подписки Stripe", () => {
    expect(needBackfill(SUBS, []).map((s: Sub) => s.id)).toEqual(["row_canceled", "row_live"]);
  });

  it("ручная выдача и код доступа не переносятся НИКОГДА — денег Stripe за ними нет", () => {
    const ids = needBackfill(SUBS, []).map((s: Sub) => s.id);
    expect(ids).not.toContain("row_manual");
    expect(ids).not.toContain("row_code");
  });

  it("строка, у которой журнал уже есть, второй раз не переносится", () => {
    expect(needBackfill(SUBS, [{ subscriptionId: "row_live" }]).map((s: Sub) => s.id)).toEqual(["row_canceled"]);
  });

  it("КОНТРОЛЬ: журнал на обе — переносить нечего, список пуст", () => {
    // Без этого случая правило «уже есть журнал → пропустить» могло бы
    // не работать вовсе, а три утверждения выше всё равно проходили бы.
    expect(needBackfill(SUBS, [{ subscriptionId: "row_live" }, { subscriptionId: "row_canceled" }])).toEqual([]);
  });

  it("в строке журнала называются ОБЕ связи — наша строка и подписка Stripe", () => {
    // Ровно те две связи, по которым `revokeAccessForPayment` ищет
    // доступ: без второй возврат по повторяющемуся счёту снова стал бы
    // ненаходимым (долг 84).
    const row = plannedRow(SUBS[1], "pi_backfilled");
    expect(row.subscriptionId).toBe("row_live");
    expect(row.stripeSubscriptionId).toBe("sub_B");
    expect(row.stripePaymentIntentId).toBe("pi_backfilled");
    expect(row.source).toBe("backfill");
  });

  it("без номера платежа строка не притворяется готовой", () => {
    expect(plannedRow(SUBS[0], null).stripePaymentIntentId).toMatch(/нужен ключ Stripe/);
  });
});
