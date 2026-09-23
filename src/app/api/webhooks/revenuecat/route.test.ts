import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const findUnique = vi.fn();
const upsert = vi.fn();
const updateMany = vi.fn();
const userFindUnique = vi.fn();
const eventFindUnique = vi.fn();
const eventCreate = vi.fn();
const invalidateSubscriptionCache = vi.fn();
const captureException = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    subscription: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      upsert: (...args: unknown[]) => upsert(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
    revenueCatEvent: {
      findUnique: (...args: unknown[]) => eventFindUnique(...args),
      create: (...args: unknown[]) => eventCreate(...args),
    },
  },
}));

vi.mock("@/lib/subscription", () => ({
  invalidateSubscriptionCache: (...args: unknown[]) => invalidateSubscriptionCache(...args),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: (...args: unknown[]) => captureException(...args) }));

const { POST } = await import("./route");

function fakeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return {
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    json: async () => body,
  } as unknown as NextRequest;
}

function rcEvent(type: string, overrides: Record<string, unknown> = {}) {
  return {
    event: {
      type,
      app_user_id: "user_123",
      original_transaction_id: "txn_abc",
      product_id: "com.rusofacilapp.monthly",
      store: "APP_STORE",
      expiration_at_ms: Date.now() + 1000 * 60 * 60 * 24 * 30,
      ...overrides,
    },
  };
}

describe("POST /api/webhooks/revenuecat", () => {
  const originalSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const originalMonthly = process.env.REVENUECAT_PRODUCT_MONTHLY;
  const originalLifetime = process.env.REVENUECAT_PRODUCT_LIFETIME;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVENUECAT_WEBHOOK_SECRET = "rc_test_secret";
    process.env.REVENUECAT_PRODUCT_MONTHLY = "com.rusofacilapp.monthly";
    process.env.REVENUECAT_PRODUCT_LIFETIME = "com.rusofacilapp.lifetime";
    findUnique.mockResolvedValue(null);
    eventFindUnique.mockResolvedValue(null);
    eventCreate.mockResolvedValue({});
    // Default for every pre-existing case: the app_user_id resolves to a
    // real user, which is what those cases always silently assumed.
    userFindUnique.mockResolvedValue({ id: "user_123" });
  });

  afterEach(() => {
    process.env.REVENUECAT_WEBHOOK_SECRET = originalSecret;
    process.env.REVENUECAT_PRODUCT_MONTHLY = originalMonthly;
    process.env.REVENUECAT_PRODUCT_LIFETIME = originalLifetime;
  });

  it("responds 503 when RevenueCat is not configured", async () => {
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
    const response = await POST(fakeRequest(rcEvent("INITIAL_PURCHASE")));
    expect(response.status).toBe(503);
  });

  it("responds 401 when the Authorization header is missing", async () => {
    const response = await POST(fakeRequest(rcEvent("INITIAL_PURCHASE")));
    expect(response.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("responds 401 when the Authorization header doesn't match the secret", async () => {
    const response = await POST(
      fakeRequest(rcEvent("INITIAL_PURCHASE"), { authorization: "Bearer wrong" })
    );
    expect(response.status).toBe(401);
  });

  it("responds 400 on malformed JSON", async () => {
    const badRequest = {
      headers: { get: (key: string) => (key === "authorization" ? "Bearer rc_test_secret" : null) },
      json: async () => {
        throw new Error("bad json");
      },
    } as unknown as NextRequest;
    const response = await POST(badRequest);
    expect(response.status).toBe(400);
  });

  it("responds 400 when the event is missing type or app_user_id", async () => {
    const response = await POST(
      fakeRequest({ event: { type: "INITIAL_PURCHASE" } }, { authorization: "Bearer rc_test_secret" })
    );
    expect(response.status).toBe(400);
  });

  it("upserts an active subscription on INITIAL_PURCHASE, keyed by original_transaction_id", async () => {
    const response = await POST(
      fakeRequest(rcEvent("INITIAL_PURCHASE"), { authorization: "Bearer rc_test_secret" })
    );
    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rcOriginalTransactionId: "txn_abc" },
        create: expect.objectContaining({
          userId: "user_123",
          plan: "monthly",
          status: "active",
          provider: "revenuecat",
          rcOriginalTransactionId: "txn_abc",
          rcStore: "APP_STORE",
        }),
      })
    );
    expect(invalidateSubscriptionCache).toHaveBeenCalledWith("user_123");
  });

  it("grants a never-expiring lifetime subscription on NON_RENEWING_PURCHASE", async () => {
    await POST(
      fakeRequest(
        rcEvent("NON_RENEWING_PURCHASE", {
          product_id: "com.rusofacilapp.lifetime",
          expiration_at_ms: null,
        }),
        { authorization: "Bearer rc_test_secret" }
      )
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          plan: "lifetime",
          status: "active",
          currentPeriodEnd: new Date("2099-12-31T00:00:00.000Z"),
        }),
      })
    );
  });

  it("keeps status active on CANCELLATION (auto-renew off, access continues to period end)", async () => {
    await POST(fakeRequest(rcEvent("CANCELLATION"), { authorization: "Bearer rc_test_secret" }));
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          status: "active",
          currentPeriodEnd: expect.any(Date),
          rcEnvironment: null,
          canceledAt: expect.any(Date),
        },
      })
    );
  });

  /* ОТМЕТКА «ПРОДЛЕНИЯ НЕ БУДЕТ» — заход 7.226.
   *
   * Замер боевой базы 23.09.2026: CANCELLATION дошёл (расписка
   * 2AAEB200-…, 19:36:20 UTC), а `canceledAt` у строки остался NULL, и
   * кабинет печатал «Активна» подписке, которая уже не продлится. Ниже —
   * ровно то, чего не хватало, и обратный ход тоже. */
  describe("отметка об отключённом продлении (долг 190 для магазинной подписки)", () => {
    it("CANCELLATION ставит дату отмены по часам события", async () => {
      const at = Date.UTC(2026, 8, 23, 19, 36, 20);
      await POST(
        fakeRequest(rcEvent("CANCELLATION", { event_timestamp_ms: at }), {
          authorization: "Bearer rc_test_secret",
        })
      );
      const call = upsert.mock.calls[0][0] as { update: { canceledAt: Date | null } };
      expect(call.update.canceledAt).toEqual(new Date(at));
    });

    it("повторная доставка CANCELLATION не двигает дату отмены вперёд", async () => {
      const first = new Date("2026-09-23T19:36:20.000Z");
      findUnique.mockResolvedValue({ plan: "monthly", canceledAt: first });
      await POST(
        fakeRequest(rcEvent("CANCELLATION", { event_timestamp_ms: Date.UTC(2026, 8, 24, 10, 0, 0) }), {
          authorization: "Bearer rc_test_secret",
        })
      );
      const call = upsert.mock.calls[0][0] as { update: { canceledAt: Date | null } };
      expect(call.update.canceledAt).toEqual(first);
    });

    it("UNCANCELLATION снимает дату отмены", async () => {
      findUnique.mockResolvedValue({ plan: "monthly", canceledAt: new Date("2026-09-23T19:36:20.000Z") });
      await POST(fakeRequest(rcEvent("UNCANCELLATION"), { authorization: "Bearer rc_test_secret" }));
      const call = upsert.mock.calls[0][0] as { update: { canceledAt: Date | null } };
      expect(call.update.canceledAt).toBeNull();
    });

    it.each(["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE"])(
      "%s оставляет строку без отметки об отмене",
      async (type) => {
        findUnique.mockResolvedValue({ plan: "monthly", canceledAt: new Date("2026-09-23T19:36:20.000Z") });
        await POST(fakeRequest(rcEvent(type), { authorization: "Bearer rc_test_secret" }));
        const call = upsert.mock.calls[0][0] as { update: { canceledAt: Date | null } };
        expect(call.update.canceledAt).toBeNull();
      }
    );

    it("новая строка от CANCELLATION тоже получает дату (create, а не только update)", async () => {
      const at = Date.UTC(2026, 8, 23, 19, 36, 20);
      await POST(
        fakeRequest(rcEvent("CANCELLATION", { event_timestamp_ms: at }), {
          authorization: "Bearer rc_test_secret",
        })
      );
      const call = upsert.mock.calls[0][0] as { create: { canceledAt: Date | null } };
      expect(call.create.canceledAt).toEqual(new Date(at));
    });
  });

  it("closes access on EXPIRATION", async () => {
    findUnique.mockResolvedValue({ userId: "user_123", plan: "monthly" });
    await POST(fakeRequest(rcEvent("EXPIRATION"), { authorization: "Bearer rc_test_secret" }));
    expect(updateMany).toHaveBeenCalledWith({
      where: { rcOriginalTransactionId: "txn_abc", plan: { not: "lifetime" } },
      data: { status: "canceled" },
    });
    expect(invalidateSubscriptionCache).toHaveBeenCalledWith("user_123");
  });

  it("marks past_due on BILLING_ISSUE", async () => {
    findUnique.mockResolvedValue({ userId: "user_123" });
    await POST(fakeRequest(rcEvent("BILLING_ISSUE"), { authorization: "Bearer rc_test_secret" }));
    expect(updateMany).toHaveBeenCalledWith({
      where: { rcOriginalTransactionId: "txn_abc" },
      data: { status: "past_due" },
    });
  });

  it("acknowledges unhandled event types without touching the database", async () => {
    const response = await POST(
      fakeRequest(rcEvent("TEST"), { authorization: "Bearer rc_test_secret" })
    );
    expect(response.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("does nothing when original_transaction_id is missing", async () => {
    await POST(
      fakeRequest(rcEvent("INITIAL_PURCHASE", { original_transaction_id: null }), {
        authorization: "Bearer rc_test_secret",
      })
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // Долг 31, конец первый: чужой app_user_id не роняет маршрут
  //
  // Until this run the create path wrote userId: event.app_user_id into a
  // foreign key onto User without asking whether that user exists, so an
  // event naming an unknown id made Prisma throw → 500 → RevenueCat
  // redelivered the same event forever. The contract asserted here is: the
  // user is looked up FIRST, nothing is written, and the answer is 200 with
  // an explicit marker so "ignored" is distinguishable from "stored".
  // ------------------------------------------------------------------

  it("debt 31, end one: an unknown app_user_id is answered 200, writes nothing, and is reported", async () => {
    userFindUnique.mockResolvedValue(null);
    const response = await POST(
      fakeRequest(rcEvent("INITIAL_PURCHASE", { app_user_id: "user_does_not_exist" }), {
        authorization: "Bearer rc_test_secret",
      })
    );

    // 200, not 500: this is what stops the redelivery loop.
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, ignored: "unknown-app-user-id" });

    // Nothing written — the foreign key is never given a chance to throw.
    expect(upsert).not.toHaveBeenCalled();
    expect(invalidateSubscriptionCache).not.toHaveBeenCalled();

    // The user was checked BEFORE the write, not after a failure.
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: "user_does_not_exist" },
      select: { id: true },
    });

    // Silence is the failure mode this guard could have introduced, so the
    // report is part of the contract, not a nicety.
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ name: "RevenueCatUnknownAppUserId" }),
      expect.objectContaining({
        level: "warning",
        extra: expect.objectContaining({ appUserId: "user_does_not_exist" }),
      })
    );
  });

  it("debt 31, end one: a known app_user_id is still stored (the guard does not block real purchases)", async () => {
    userFindUnique.mockResolvedValue({ id: "user_123" });
    const response = await POST(
      fakeRequest(rcEvent("INITIAL_PURCHASE"), { authorization: "Bearer rc_test_secret" })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("debt 31, end one: an existing row is updated without re-checking the user", async () => {
    // An existing row already carries a valid userId — asking User again
    // would be a read per renewal event for no gain.
    findUnique.mockResolvedValue({ plan: "monthly", userId: "user_123" });
    await POST(fakeRequest(rcEvent("RENEWAL"), { authorization: "Bearer rc_test_secret" }));
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // Долг 31, конец второй: EXPIRATION не гасит пожизненную покупку
  //
  // The revocation named no plan at all, so a lifetime purchase (stored
  // with currentPeriodEnd 2099 precisely so nothing expires it) was closed
  // by the same updateMany as a lapsed monthly subscription.
  // ------------------------------------------------------------------

  it("debt 31, end two: EXPIRATION on a lifetime row writes nothing and is reported", async () => {
    findUnique.mockResolvedValue({ userId: "user_123", plan: "lifetime" });
    const response = await POST(
      fakeRequest(
        rcEvent("EXPIRATION", { product_id: "com.rusofacilapp.lifetime", expiration_at_ms: null }),
        { authorization: "Bearer rc_test_secret" }
      )
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, ignored: "expiration-on-lifetime" });
    expect(updateMany).not.toHaveBeenCalled();
    expect(invalidateSubscriptionCache).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ name: "RevenueCatExpirationOnLifetime" }),
      expect.objectContaining({ level: "warning" })
    );
  });

  it("debt 31, end two: the lifetime guard is in the where clause, so a monthly row still closes", async () => {
    findUnique.mockResolvedValue({ userId: "user_123", plan: "monthly" });
    await POST(fakeRequest(rcEvent("EXPIRATION"), { authorization: "Bearer rc_test_secret" }));
    expect(updateMany).toHaveBeenCalledWith({
      where: { rcOriginalTransactionId: "txn_abc", plan: { not: "lifetime" } },
      data: { status: "canceled" },
    });
    expect(invalidateSubscriptionCache).toHaveBeenCalledWith("user_123");
  });
});

/**
 * ЗАХОД 7.224 — КАЖДОЕ СОБЫТИЕ × КАЖДЫЙ ТОВАР.
 *
 * Товары здесь — БОЕВЫЕ, те самые, что владелец завёл в Google Play и
 * импортировал в RevenueCat 22.09.2026. Переменные окружения
 * `REVENUECAT_PRODUCT_*` в этом блоке намеренно сняты: проверяется
 * УМОЛЧАНИЕ, записанное в `src/lib/revenuecat-config.ts`, потому что
 * именно оно работает у владельца, который ничего в Vercel не вписал.
 *
 * ПОДСАДКА ЖИВЁТ ВНУТРИ ЭТОГО БЛОКА. Сломай перепись товаров — и
 * `premium_lifetime` перестанет давать план `lifetime`; первый же пример
 * ниже покраснеет, потому что он спрашивает именно план, а не «строка
 * записалась».
 */
describe("POST /api/webhooks/revenuecat — боевые товары Google Play", () => {
  const saved = {
    secret: process.env.REVENUECAT_WEBHOOK_SECRET,
    monthly: process.env.REVENUECAT_PRODUCT_MONTHLY,
    annual: process.env.REVENUECAT_PRODUCT_ANNUAL,
    lifetime: process.env.REVENUECAT_PRODUCT_LIFETIME,
  };

  const AUTH = { authorization: "Bearer rc_test_secret" };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVENUECAT_WEBHOOK_SECRET = "rc_test_secret";
    delete process.env.REVENUECAT_PRODUCT_MONTHLY;
    delete process.env.REVENUECAT_PRODUCT_ANNUAL;
    delete process.env.REVENUECAT_PRODUCT_LIFETIME;
    findUnique.mockResolvedValue(null);
    eventFindUnique.mockResolvedValue(null);
    eventCreate.mockResolvedValue({});
    userFindUnique.mockResolvedValue({ id: "user_123" });
  });

  afterEach(() => {
    process.env.REVENUECAT_WEBHOOK_SECRET = saved.secret;
    process.env.REVENUECAT_PRODUCT_MONTHLY = saved.monthly;
    process.env.REVENUECAT_PRODUCT_ANNUAL = saved.annual;
    process.env.REVENUECAT_PRODUCT_LIFETIME = saved.lifetime;
  });

  function playEvent(type: string, productId: string, overrides: Record<string, unknown> = {}) {
    return {
      event: {
        id: `evt_${type}_${productId}`,
        type,
        app_user_id: "user_123",
        original_transaction_id: `txn_${productId}`,
        product_id: productId,
        store: "PLAY_STORE",
        environment: "PRODUCTION",
        expiration_at_ms: Date.now() + 1000 * 60 * 60 * 24 * 30,
        ...overrides,
      },
    };
  }

  const PRODUCTS: Array<[string, string, string]> = [
    ["standard:monthly", "monthly", "standard"],
    ["standard:annual", "annual", "standard"],
    ["premium_lifetime", "lifetime", "premium"],
  ];

  // Пять событий, после которых доступ обязан БЫТЬ. CANCELLATION здесь же
  // и намеренно: отмена автопродления — это не конец доступа, магазин
  // держит его до конца оплаченного срока.
  const GRANTING = [
    "INITIAL_PURCHASE",
    "RENEWAL",
    "PRODUCT_CHANGE",
    "UNCANCELLATION",
    "NON_RENEWING_PURCHASE",
    "CANCELLATION",
  ];

  for (const [productId, plan, tier] of PRODUCTS) {
    for (const type of GRANTING) {
      it(`${type} × ${productId} → план ${plan} (уровень ${tier}), provider revenuecat`, async () => {
        const response = await POST(fakeRequest(playEvent(type, productId), AUTH));
        expect(response.status).toBe(200);
        expect(upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { rcOriginalTransactionId: `txn_${productId}` },
            create: expect.objectContaining({
              userId: "user_123",
              plan,
              status: "active",
              provider: "revenuecat",
              rcStore: "PLAY_STORE",
              rcEnvironment: "PRODUCTION",
            }),
          })
        );
      });
    }
  }

  it("покупка навсегда не получает срока в год: currentPeriodEnd 2099", async () => {
    await POST(fakeRequest(playEvent("NON_RENEWING_PURCHASE", "premium_lifetime", { expiration_at_ms: null }), AUTH));
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: "lifetime", currentPeriodEnd: new Date("2099-12-31T00:00:00.000Z") }),
      })
    );
  });

  it("товар разложен на два поля (standard + base_plan_id) — план тот же", async () => {
    await POST(
      fakeRequest(playEvent("INITIAL_PURCHASE", "standard", { base_plan_id: "annual" }), AUTH)
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ plan: "annual" }) })
    );
  });

  it("покупка тестировщика помечена SANDBOX и доступ всё равно открывает", async () => {
    await POST(fakeRequest(playEvent("INITIAL_PURCHASE", "standard:monthly", { environment: "SANDBOX" }), AUTH));
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: "active", rcEnvironment: "SANDBOX" }),
      })
    );
  });

  it("незнакомый товар: доступ открыт, но о нём сказано в Sentry", async () => {
    await POST(fakeRequest(playEvent("INITIAL_PURCHASE", "standard:weekly"), AUTH));
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ plan: "unknown" }) })
    );
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ name: "RevenueCatUnknownProduct" }),
      expect.anything()
    );
  });

  it("повтор доставки того же события не делает ничего", async () => {
    eventFindUnique.mockResolvedValue({ id: "evt_INITIAL_PURCHASE_standard:monthly" });
    const response = await POST(fakeRequest(playEvent("INITIAL_PURCHASE", "standard:monthly"), AUTH));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, ignored: "duplicate-event" });
    expect(upsert).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("расписка о прочтении пишется ПОСЛЕ работы", async () => {
    await POST(fakeRequest(playEvent("INITIAL_PURCHASE", "standard:monthly"), AUTH));
    expect(eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "evt_INITIAL_PURCHASE_standard:monthly",
        type: "INITIAL_PURCHASE",
        appUserId: "user_123",
        environment: "PRODUCTION",
      }),
    });
  });

  it("EXPIRATION закрывает подписку и не трогает покупку навсегда", async () => {
    findUnique.mockResolvedValue({ userId: "user_123", plan: "monthly" });
    updateMany.mockResolvedValue({ count: 1 });
    await POST(fakeRequest(playEvent("EXPIRATION", "standard:monthly"), AUTH));
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "canceled" } })
    );
  });

  it("BILLING_ISSUE переводит строку в past_due", async () => {
    findUnique.mockResolvedValue({ userId: "user_123" });
    updateMany.mockResolvedValue({ count: 1 });
    await POST(fakeRequest(playEvent("BILLING_ISSUE", "standard:annual"), AUTH));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "past_due" } }));
  });

  it("TRANSFER переносит строки на нового пользователя сайта", async () => {
    userFindUnique.mockResolvedValue({ id: "user_new" });
    updateMany.mockResolvedValue({ count: 1 });
    await POST(
      fakeRequest(
        playEvent("TRANSFER", "standard:monthly", {
          transferred_from: ["user_old"],
          transferred_to: ["user_new"],
        }),
        AUTH
      )
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { rcAppUserId: { in: ["user_old"] }, provider: "revenuecat" },
      data: { userId: "user_new", rcAppUserId: "user_new" },
    });
    expect(invalidateSubscriptionCache).toHaveBeenCalledWith("user_old");
    expect(invalidateSubscriptionCache).toHaveBeenCalledWith("user_new");
  });

  it("TRANSFER на неизвестного получателя: 200, ничего не переписано, след в Sentry", async () => {
    userFindUnique.mockResolvedValue(null);
    const response = await POST(
      fakeRequest(
        playEvent("TRANSFER", "standard:monthly", {
          transferred_from: ["user_old"],
          transferred_to: ["ghost"],
        }),
        AUTH
      )
    );
    expect(response.status).toBe(200);
    expect(updateMany).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ name: "RevenueCatUnknownAppUserId" }),
      expect.anything()
    );
  });

  it("событие с неизвестным app_user_id не падает и не пишет строку", async () => {
    userFindUnique.mockResolvedValue(null);
    const response = await POST(fakeRequest(playEvent("INITIAL_PURCHASE", "standard:monthly"), AUTH));
    expect(response.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ name: "RevenueCatUnknownAppUserId" }),
      expect.anything()
    );
  });

  it("неверный заголовок авторизации — 401 при любом боевом товаре", async () => {
    for (const [productId] of PRODUCTS) {
      const response = await POST(
        fakeRequest(playEvent("INITIAL_PURCHASE", productId), { authorization: "Bearer wrong" })
      );
      expect(response.status).toBe(401);
    }
    expect(upsert).not.toHaveBeenCalled();
  });
});

/**
 * ЖИВАЯ ПОДПИСКА STRIPE НЕ ЗАДЕВАЕТСЯ НИ ОДНИМ СОБЫТИЕМ МАГАЗИНА.
 *
 * Зачем отдельным блоком. На проде живёт подписка ученика со сроком
 * продления 30.09.2026, оплаченная картой через Stripe, и заход 7.224 не
 * имеет права её тронуть. Доказательство — не рассуждение, а перепись
 * ОБРАЩЕНИЙ К БАЗЕ: каждое из них обязано быть привязано либо к ключу
 * магазинной покупки (`rcOriginalTransactionId`, у строк Stripe он NULL),
 * либо к `provider: "revenuecat"`. Обращение без такой привязки — это
 * ровно тот запрос, который однажды закрыл бы чужую подписку.
 */
describe("события магазина не трогают строки Stripe", () => {
  const savedSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const AUTH = { authorization: "Bearer rc_test_secret" };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVENUECAT_WEBHOOK_SECRET = "rc_test_secret";
    findUnique.mockResolvedValue(null);
    eventFindUnique.mockResolvedValue(null);
    eventCreate.mockResolvedValue({});
    userFindUnique.mockResolvedValue({ id: "user_123" });
    updateMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    process.env.REVENUECAT_WEBHOOK_SECRET = savedSecret;
  });

  const TYPES = [
    "INITIAL_PURCHASE",
    "RENEWAL",
    "PRODUCT_CHANGE",
    "UNCANCELLATION",
    "NON_RENEWING_PURCHASE",
    "CANCELLATION",
    "EXPIRATION",
    "BILLING_ISSUE",
    "TRANSFER",
  ];

  for (const type of TYPES) {
    it(`${type}: ни один запрос не адресует строку по-стриповски`, async () => {
      findUnique.mockResolvedValue(type === "EXPIRATION" ? { userId: "user_123", plan: "monthly" } : null);
      await POST(
        fakeRequest(
          {
            event: {
              id: `evt_stripe_guard_${type}`,
              type,
              app_user_id: "user_123",
              original_transaction_id: "txn_play",
              product_id: "standard:monthly",
              store: "PLAY_STORE",
              environment: "PRODUCTION",
              expiration_at_ms: Date.now() + 1000,
              transferred_from: ["user_old"],
              transferred_to: ["user_123"],
            },
          },
          AUTH
        )
      );

      const wheres = [...upsert.mock.calls, ...updateMany.mock.calls, ...findUnique.mock.calls]
        .map((call) => (call[0] as { where?: Record<string, unknown> })?.where)
        .filter((where): where is Record<string, unknown> => Boolean(where));

      for (const where of wheres) {
        const keys = Object.keys(where);
        expect(keys).not.toContain("stripeSubscriptionId");
        expect(keys).not.toContain("stripeCustomerId");
        const scoped =
          "rcOriginalTransactionId" in where ||
          "rcAppUserId" in where ||
          where.provider === "revenuecat" ||
          // Единственное чтение НЕ по строке доступа — поиск пользователя
          // по id, и он ничего не меняет.
          keys.join() === "id";
        expect(scoped, `запрос без привязки к магазину: ${JSON.stringify(where)}`).toBe(true);
      }
    });
  }
});
