/**
 * ПОДПИСЬ ТАРИФА НАЗЫВАЕТ ПОСЛЕДНЕЕ СОБЫТИЕ — ДОЛГ 102 (заход 7.217).
 *
 * Сторож `check:plan-signature` читает КОД и отвечает на вопрос «стоит ли
 * там запись `plan`». Здесь — ПОВЕДЕНИЕ: что именно уходит в базу, когда
 * одно событие ложится продлением на строку, заведённую другим.
 *
 * База подменена целиком: `extendOrGrantSubscription` — единственная точка
 * выдачи доступа во всём приложении, и проверять её на настоящем файле
 * значило бы завести медленный тест, который ещё и пишет.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rows: Array<{
  id: string;
  userId: string;
  plan: string;
  status: string;
  currentPeriodEnd: Date;
  stripeSubscriptionId: string | null;
  rcOriginalTransactionId: string | null;
  stripePaymentIntentId: string | null;
}> = [];
const updates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
const creates: Array<Record<string, unknown>> = [];

vi.mock("./db", () => ({
  db: {
    subscription: {
      findMany: async () => rows,
      update: async (arg: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push(arg);
        return { ...rows[0], ...arg.data };
      },
      create: async (arg: { data: Record<string, unknown> }) => {
        creates.push(arg.data);
        return { id: "created", ...arg.data };
      },
    },
    subscriptionPayment: { upsert: async () => ({}) },
  },
}));
vi.mock("./subscription-cache", () => ({ invalidateSubscriptionCache: async () => {} }));

const { extendOrGrantSubscription } = await import("./subscription");

function liveGrant(plan: string) {
  return {
    id: "row_live",
    userId: "u1",
    plan,
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 10 * 86_400_000),
    stripeSubscriptionId: null,
    rcOriginalTransactionId: null,
    stripePaymentIntentId: null,
  };
}

beforeEach(() => {
  rows.length = 0;
  updates.length = 0;
  creates.length = 0;
});

describe("долг 102: продление переписывает подпись тарифа", () => {
  it("код, погашенный поверх живой ручной выдачи, даёт подпись access_code", async () => {
    rows.push(liveGrant("manual"));
    await extendOrGrantSubscription("u1", 90, "access_code");
    expect(updates).toHaveLength(1);
    expect(updates[0].data.plan).toBe("access_code");
  });

  it("ручная выдача поверх кода даёт подпись manual — правило симметрично", async () => {
    rows.push(liveGrant("access_code"));
    await extendOrGrantSubscription("u1", 30, "manual");
    expect(updates[0].data.plan).toBe("manual");
  });

  it("ОПЛАЧЕННЫЙ месяц поверх выдачи перестаёт быть подписан выдачей — это про деньги, а не про слово", async () => {
    // Ровно случай OXXO: подписки в кассе нет по построению, поэтому
    // `isGrantSubscription` судила такую строку выдачей — платёж не
    // попадал в «Historial de pagos», а кнопка отмены показывалась там,
    // где отменять нечего.
    rows.push(liveGrant("manual"));
    await extendOrGrantSubscription("u1", 30, "monthly", "pi_oxxo");
    expect(updates[0].data.plan).toBe("monthly");
  });

  it("срок продлевается тем же числом дней, что и раньше — правка подписи ничего не отняла", async () => {
    const row = liveGrant("manual");
    rows.push(row);
    await extendOrGrantSubscription("u1", 7, "access_code");
    const end = updates[0].data.currentPeriodEnd as Date;
    expect(end.getTime() - row.currentPeriodEnd.getTime()).toBe(7 * 86_400_000);
    expect(updates[0].data.status).toBe("active");
  });

  it("КОНТРОЛЬ: живой строки нет — заводится новая, и подпись у неё та же самая", async () => {
    await extendOrGrantSubscription("u1", 90, "access_code");
    expect(updates).toHaveLength(0);
    expect(creates).toHaveLength(1);
    expect(creates[0].plan).toBe("access_code");
  });

  it("КОНТРОЛЬ ПРЕМИАЛЬНОСТИ: строка Premium не продлевается непремиальной выдачей и подписи не теряет", async () => {
    // Без этого случая правка могла бы переписывать план строке другой
    // премиальности — то есть менять РЕШЕНИЕ О ДОСТУПЕ, а не подпись.
    rows.push(liveGrant("lifetime"));
    await extendOrGrantSubscription("u1", 90, "access_code");
    expect(updates).toHaveLength(0);
    expect(creates).toHaveLength(1);
  });

  it("КОНТРОЛЬ: строка подписки Stripe не трогается вовсе", async () => {
    rows.push({ ...liveGrant("monthly"), stripeSubscriptionId: "sub_A" });
    await extendOrGrantSubscription("u1", 30, "manual");
    expect(updates).toHaveLength(0);
    expect(creates).toHaveLength(1);
  });
});
