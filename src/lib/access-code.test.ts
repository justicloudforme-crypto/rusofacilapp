import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Правило кодов доступа, проверенное без базы (PROGRESS.md 7.146).
 *
 * Здесь проверяется РЕШЕНИЕ: в каком порядке задаются вопросы, какая причина
 * отказа называется человеку и — главное — что выдача уходит ровно одним
 * вызовом `extendOrGrantSubscription`, а не собирается на месте.
 *
 * Чего здесь НЕТ и быть не может: доказательства одноразовости под гонкой.
 * Подставной `updateMany` возвращает то, что ему велели вернуть, а
 * одноразовость — это свойство настоящего UPDATE в настоящей базе. Она
 * доказывается в `scripts/scenarios/access-code.scenario.ts` двумя
 * одновременными запросами, и ссылка отсюда туда стоит намеренно: тест,
 * который делает вид, что доказал это, был бы хуже отсутствующего.
 */

type Row = {
  code: string;
  tier: string;
  durationDays: number;
  expiresAt: Date | null;
  redeemedAt: Date | null;
  revokedAt: Date | null;
};

const updateMany = vi.fn<(args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }>>();
const findUnique = vi.fn<(args: { where: { code: string } }) => Promise<Row | null>>();
const extendOrGrantSubscription = vi.fn(async () => {});
const getEntitlementTierFor = vi.fn(async () => "free" as "free" | "standard" | "premium");
const captureException = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    accessCode: {
      updateMany: (args: never) => updateMany(args),
      findUnique: (args: never) => findUnique(args),
    },
  },
}));
// Только выдача — спай. Всё остальное из subscription.ts настоящее: если бы
// был подменён модуль целиком, «выдача идёт через общий путь» проверялось бы
// против самого себя.
vi.mock("@/lib/subscription", async () => {
  const actual = await vi.importActual<typeof import("@/lib/subscription")>("@/lib/subscription");
  return { ...actual, extendOrGrantSubscription: (...args: unknown[]) => extendOrGrantSubscription(...(args as [])) };
});
vi.mock("@/lib/entitlement", async () => {
  const actual = await vi.importActual<typeof import("@/lib/entitlement")>("@/lib/entitlement");
  return { ...actual, getEntitlementTierFor: () => getEntitlementTierFor() };
});
vi.mock("@sentry/nextjs", () => ({ captureException: (...args: unknown[]) => captureException(...args) }));

const { redeemAccessCode, revokeAccessCode, normalizeAccessCode, ACCESS_CODE_PLAN, isAccessCodeTier } =
  await import("./access-code");

const USER = { id: "u1", role: "student" };

function row(overrides: Partial<Row> = {}): Row {
  return {
    code: "AMIGOK7M2QW9F",
    tier: "standard",
    durationDays: 90,
    expiresAt: null,
    redeemedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  updateMany.mockReset();
  findUnique.mockReset();
  extendOrGrantSubscription.mockReset();
  captureException.mockReset();
  getEntitlementTierFor.mockReset();
  getEntitlementTierFor.mockResolvedValue("free");
});

describe("normalizeAccessCode — одна нормализация на записи и на чтении", () => {
  it.each([
    ["amigo-k7m2-qw9f", "AMIGOK7M2QW9F"],
    ["  AMIGO K7M2 QW9F  ", "AMIGOK7M2QW9F"],
    ["AMIGOK7M2QW9F", "AMIGOK7M2QW9F"],
    ["Amigo-K7m2-Qw9f", "AMIGOK7M2QW9F"],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeAccessCode(raw)).toBe(expected);
  });

  it("пустая строка остаётся пустой, а не превращается во что-то вводимое", () => {
    expect(normalizeAccessCode("   -- ")).toBe("");
  });
});

describe("уровень кода", () => {
  it("premium через код не выдаётся вовсе: в таблице планов его нет", () => {
    expect(Object.keys(ACCESS_CODE_PLAN)).toEqual(["standard"]);
    expect(isAccessCodeTier("premium")).toBe(false);
    expect(isAccessCodeTier("standard")).toBe(true);
  });

  it("план standard-кода — не премиальный, значит tierOfStoredSubscription прочтёт его как standard", async () => {
    const { isPremiumPlan } = await import("./subscription");
    expect(isPremiumPlan(ACCESS_CODE_PLAN.standard)).toBe(false);
  });

  it("план кода — своё слово, а не «manual»: иначе ученик читает в кабинете про чужое событие (7.151)", async () => {
    expect(ACCESS_CODE_PLAN.standard).toBe("access_code");
    // Ровно то, ради чего значение разведено: подпись у двух выдач не через
    // кассу разная. Совпади они — этот случай упал бы.
    expect(ACCESS_CODE_PLAN.standard).not.toBe("manual");
    // И это НЕ про доступ: обе строки читаются одинаково.
    const { isPremiumPlan } = await import("./subscription");
    expect(isPremiumPlan("manual")).toBe(isPremiumPlan(ACCESS_CODE_PLAN.standard));
  });
});

describe("redeemAccessCode — порядок вопросов", () => {
  it("у кого доступ уже есть, тот код НЕ тратит: отказ раньше любого UPDATE", async () => {
    getEntitlementTierFor.mockResolvedValue("standard");

    const result = await redeemAccessCode(USER, "AMIGO-K7M2-QW9F");

    expect(result).toEqual({ ok: false, reason: "already_has_access" });
    // Главное утверждение этого случая: строка кода не тронута.
    expect(updateMany).not.toHaveBeenCalled();
    expect(extendOrGrantSubscription).not.toHaveBeenCalled();
  });

  it("персонал — то же самое: правило 7.145 делает его premium, код не сгорает", async () => {
    getEntitlementTierFor.mockResolvedValue("premium");
    const result = await redeemAccessCode({ id: "u1", role: "owner" }, "AMIGO-K7M2-QW9F");
    expect(result).toEqual({ ok: false, reason: "already_has_access" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("пустой код — отказ без обращения к базе", async () => {
    const result = await redeemAccessCode(USER, "   ");
    expect(result).toEqual({ ok: false, reason: "unknown" });
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("redeemAccessCode — успех", () => {
  it("выдаёт доступ РОВНО ОДНИМ вызовом общей выдачи, на срок из строки кода", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findUnique.mockResolvedValue(row({ durationDays: 90 }));

    const result = await redeemAccessCode(USER, "amigo-k7m2-qw9f");

    expect(result).toEqual({ ok: true, days: 90, tier: "standard" });
    expect(extendOrGrantSubscription).toHaveBeenCalledTimes(1);
    expect(extendOrGrantSubscription).toHaveBeenCalledWith("u1", 90, "access_code");
    // Ни одной ссылки на платёж: код никто не оплачивал через Stripe, и
    // возврат денег (7.145, долг 29) не должен на него натыкаться.
    expect(extendOrGrantSubscription.mock.calls[0]).toHaveLength(3);
  });

  it("срок берётся из строки, а не из умолчания", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findUnique.mockResolvedValue(row({ durationDays: 14 }));
    await redeemAccessCode(USER, "AMIGOK7M2QW9F");
    expect(extendOrGrantSubscription).toHaveBeenCalledWith("u1", 14, "access_code");
  });

  it("код, ВСТАВЛЕННЫЙ из мессенджера, доходит до того же WHERE, что и набранный руками (7.151)", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findUnique.mockResolvedValue(row());
    // Типографское тире, неразрывный дефис, мягкий перенос, нулевая ширина в
    // хвосте и кириллическая А в начале — ровно то, что приносит вставка.
    await redeemAccessCode(USER, "\u00ADАMIGO\u2013K7M2\u2011qw9f\u200B");
    expect(updateMany.mock.calls[0][0].where.code).toBe("AMIGOK7M2QW9F");
    expect(extendOrGrantSubscription).toHaveBeenCalledTimes(1);
  });

  it("условие UPDATE — это и есть одноразовость: погашен, отозван, просрочен", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findUnique.mockResolvedValue(row());
    await redeemAccessCode(USER, "AMIGO-K7M2-QW9F");

    const where = updateMany.mock.calls[0][0].where;
    expect(where.code).toBe("AMIGOK7M2QW9F");
    expect(where.redeemedAt).toBeNull();
    expect(where.revokedAt).toBeNull();
    // Просрочка проверяется в том же UPDATE, а не отдельным чтением до него.
    expect(where.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]);
    // И запись помечает, КТО погасил, — иначе «кто и когда» в модели пусто.
    expect(updateMany.mock.calls[0][0].data).toMatchObject({ redeemedById: "u1" });
  });

  it("строка с незнакомым уровнем не выдаёт ничего и уходит в Sentry", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findUnique.mockResolvedValue(row({ tier: "premium" }));

    const result = await redeemAccessCode(USER, "AMIGOK7M2QW9F");

    expect(result).toEqual({ ok: false, reason: "unknown" });
    expect(extendOrGrantSubscription).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ name: "AccessCodeUnknownTier" }),
      expect.objectContaining({ tags: expect.objectContaining({ area: "access-code" }) })
    );
  });
});

describe("redeemAccessCode — отказы называются своим именем", () => {
  const now = Date.now();
  const cases: Array<[string, Row | null, string]> = [
    ["код неизвестен", null, "unknown"],
    ["код уже погашен", row({ redeemedAt: new Date(now - 1000) }), "already_redeemed"],
    ["код отозван", row({ revokedAt: new Date(now - 1000) }), "revoked"],
    ["срок годности кода вышел", row({ expiresAt: new Date(now - 1000) }), "expired"],
  ];

  it.each(cases)("%s -> %s", async (_name, stored, reason) => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(stored);

    const result = await redeemAccessCode(USER, "AMIGO-K7M2-QW9F");

    expect(result).toEqual({ ok: false, reason });
    expect(extendOrGrantSubscription).not.toHaveBeenCalled();
  });

  it("КОНТРОЛЬ: заведомо несуществующий код по-прежнему unknown, и это не тавтология", async () => {
    // Половина первая — утверждение. Строки в базе нет, отказ обязан быть
    // именно `unknown`, а не «просрочен» и не «уже погашен».
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(null);
    const result = await redeemAccessCode(USER, "AMIGO-XXXX-XXXX");
    expect(result).toEqual({ ok: false, reason: "unknown" });
    expect(extendOrGrantSubscription).not.toHaveBeenCalled();

    // Половина вторая, без которой первая ничего не значит: этот случай
    // ОБЯЗАН отличать несуществующий код от существующего. Тот же вход при
    // строке в базе даёт другой ответ — значит проверка не проходит просто
    // потому, что «отказ всегда unknown».
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(row({ redeemedAt: new Date() }));
    const other = await redeemAccessCode(USER, "AMIGO-XXXX-XXXX");
    expect(other).toEqual({ ok: false, reason: "already_redeemed" });
  });

  it("строка и с отзывом, и с погашением называется отозванной — отзыв разбирается первым", async () => {
    // Такая строка означает, что отзыв прошёл ДО погашения (после
    // погашения он бы не прошёл вовсе), а значит человек держит в руках
    // именно аннулированную бумажку. Порядок разбора закреплён здесь,
    // чтобы он не съехал молча.
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(row({ redeemedAt: new Date(now - 2000), revokedAt: new Date(now - 1000) }));
    const result = await redeemAccessCode(USER, "AMIGOK7M2QW9F");
    expect(result).toEqual({ ok: false, reason: "revoked" });
  });

  it("каждый отказ помечен тегом в Sentry", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(row({ redeemedAt: new Date() }));

    await redeemAccessCode(USER, "AMIGOK7M2QW9F");

    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ name: "AccessCodeRefused" }),
      expect.objectContaining({ tags: { area: "access-code", refusal: "already_redeemed" } })
    );
    // И значение кода в отчёт не уходит — только длина.
    const extra = captureException.mock.calls[0][1].extra as Record<string, unknown>;
    expect(Object.values(extra)).not.toContain("AMIGOK7M2QW9F");
    expect(extra.codeLength).toBe(13);
  });

  it("отчёт в Sentry, который сам упал, не роняет погашение", async () => {
    captureException.mockImplementation(() => {
      throw new Error("Sentry down");
    });
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(null);

    await expect(redeemAccessCode(USER, "AMIGOK7M2QW9F")).resolves.toEqual({
      ok: false,
      reason: "unknown",
    });
  });
});

describe("revokeAccessCode", () => {
  it("отзывает только НЕ погашенный и НЕ отозванный — условие стоит в самом UPDATE", async () => {
    updateMany.mockResolvedValue({ count: 1 });

    const result = await revokeAccessCode("amigo-k7m2-qw9f", "owner-1");

    expect(result).toEqual({ ok: true });
    const call = updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ code: "AMIGOK7M2QW9F", redeemedAt: null, revokedAt: null });
    expect(call.data).toMatchObject({ revokedById: "owner-1" });
  });

  it("погашенный код отозвать нельзя", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(row({ redeemedAt: new Date() }));
    await expect(revokeAccessCode("AMIGOK7M2QW9F", null)).resolves.toEqual({
      ok: false,
      reason: "already_redeemed",
    });
  });

  it("уже отозванный — тоже отказ, но со своей причиной", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(row({ revokedAt: new Date() }));
    await expect(revokeAccessCode("AMIGOK7M2QW9F", null)).resolves.toEqual({
      ok: false,
      reason: "already_revoked",
    });
  });

  it("несуществующий код", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(null);
    await expect(revokeAccessCode("NOPE", null)).resolves.toEqual({ ok: false, reason: "unknown" });
  });
});
