import { afterEach, describe, expect, it, vi } from "vitest";

// entitlement.ts is server-only and pulls in auth → db → better-sqlite3.
// tierOfAccount and hasAnyAccess are pure, so the whole chain is mocked out
// and this stays a unit test (check:no-db-in-tests keeps it honest).
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ db: {} }));
vi.mock("./auth", () => ({ getCurrentUser: async () => null }));

const { tierOfAccount, hasAnyAccess, canAccessLevel, isPremiumTier } = await import("./entitlement");

/**
 * The whole access rule, as a table — every `plan` × `status` ×
 * `currentPeriodEnd` this app can store.
 *
 * Written 08.09.2026 with the "one decision point" refactor. Before it, the
 * question "does this person have access" was answered in ten places and
 * tested in one: `subscription.test.ts` covered five hand-picked rows. The
 * cases below are generated instead of listed, and the expected answer is
 * computed from the SPEC — not from the code under test — so a change of
 * behaviour cannot quietly become a change of expectation.
 *
 * THE SPEC, in three sentences:
 *
 *  1. Staff (owner, admin) are premium, whatever they hold.
 *  2. A row is LIVE when its status is `active` or `trialing` and its
 *     `currentPeriodEnd` is strictly in the future. Every other status —
 *     including `past_due`, `unpaid`, `paused`, `incomplete` — is not.
 *  3. The tier is the best live row: `lifetime` gives premium, any other
 *     plan gives standard, nothing live gives free.
 */
const PLANS = ["monthly", "annual", "lifetime", "manual", "referral", "unknown"] as const;
const STATUSES = [
  "active",
  "trialing",
  "canceled",
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
  "incomplete_expired",
] as const;
const DAY = 86_400_000;
/** Past, the exact boundary, and future — the boundary is its own column
 * because "expired the moment the period ends" is a rule about `<=`, and
 * an off-by-one there is a day of free access or a day stolen. */
const PERIODS = [
  { name: "истёк вчера", at: () => new Date(Date.now() - DAY) },
  { name: "истекает ровно сейчас", at: () => new Date(Date.now()) },
  { name: "истекает завтра", at: () => new Date(Date.now() + DAY) },
] as const;

/** The spec above, written out independently of src/lib/subscription.ts. */
function expectedTier(plan: string, status: string, endsAt: Date, now: number): string {
  const statusCanBeLive = status === "active" || status === "trialing";
  const live = statusCanBeLive && endsAt.getTime() > now;
  if (!live) return "free";
  return plan === "lifetime" ? "premium" : "standard";
}

const STUDENT = { role: "student" };

describe("tierOfAccount — every plan × status × currentPeriodEnd", () => {
  afterEach(() => vi.useRealTimers());

  it("answers all 144 combinations exactly as the spec says", () => {
    // Время заморожено, и это не украшение (10.09.2026, заход 7.163).
    // Столбец «истекает ровно сейчас» сравнивает две РАЗНЫЕ отметки
    // времени: тест берёт `now` до `period.at()`, а `tierOfAccount`
    // читает `Date.now()` ещё позже. Пока всё три чтения попадают в одну
    // миллисекунду, случай проходит; под нагрузкой полного `verify`
    // миллисекунда успевает смениться, и правило `<=` даёт «free» там,
    // где тест ждал «standard». Красный был у самого правила замера, а не
    // у продукта: тот же файл в одиночку зелен 8 прогонов из 8 и на
    // чистом `main` тоже. Заморозка делает границу границей.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T00:00:00.000Z"));
    let checked = 0;
    let free = 0;
    let standard = 0;
    let premium = 0;
    for (const plan of PLANS) {
      for (const status of STATUSES) {
        for (const period of PERIODS) {
          const now = Date.now();
          const row = { plan, status, currentPeriodEnd: period.at() };
          const expected = expectedTier(plan, status, row.currentPeriodEnd, now);
          expect(
            tierOfAccount(STUDENT, [row]),
            `${plan} / ${status} / ${period.name}`
          ).toBe(expected);
          checked += 1;
          if (expected === "free") free += 1;
          else if (expected === "standard") standard += 1;
          else premium += 1;
        }
      }
    }
    // The counts are asserted so a table that silently shrinks (a plan
    // dropped, a status list edited) fails instead of passing on fewer
    // cases. 6 × 8 × 3 = 144; live only for 2 of 8 statuses and 1 of 3
    // periods, i.e. 6 × 2 × 1 = 12 live rows, of which the lifetime plan is
    // 2 and the other five plans are 10.
    expect(checked).toBe(144);
    expect(premium).toBe(2);
    expect(standard).toBe(10);
    expect(free).toBe(132);
  });

  it("the expiry boundary is exclusive: the period end itself is already expired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T12:00:00.000Z"));
    const at = (iso: string) => [{ plan: "monthly", status: "active", currentPeriodEnd: new Date(iso) }];

    expect(tierOfAccount(STUDENT, at("2026-09-08T12:00:00.001Z"))).toBe("standard");
    expect(tierOfAccount(STUDENT, at("2026-09-08T12:00:00.000Z"))).toBe("free");
    expect(tierOfAccount(STUDENT, at("2026-09-08T11:59:59.999Z"))).toBe("free");
  });

  it("takes the BEST live row, not the newest one", () => {
    const live = (plan: string) => ({ plan, status: "active", currentPeriodEnd: new Date(Date.now() + DAY) });
    const dead = (plan: string) => ({ plan, status: "canceled", currentPeriodEnd: new Date(Date.now() + DAY) });
    expect(tierOfAccount(STUDENT, [live("monthly"), live("lifetime")])).toBe("premium");
    expect(tierOfAccount(STUDENT, [live("lifetime"), live("monthly")])).toBe("premium");
    // A dead Premium row does not outrank a live monthly one — the rule is
    // "best LIVE row", and a cancelled lifetime purchase is not a ground.
    expect(tierOfAccount(STUDENT, [dead("lifetime"), live("monthly")])).toBe("standard");
    expect(tierOfAccount(STUDENT, [])).toBe("free");
  });

  it("staff are premium with no stored row at all, and an anonymous visitor is free", () => {
    expect(tierOfAccount({ role: "owner" }, [])).toBe("premium");
    expect(tierOfAccount({ role: "admin" }, [])).toBe("premium");
    // …and the bypass does not leak to a plain account: same empty rows.
    expect(tierOfAccount({ role: "student" }, [])).toBe("free");
    expect(tierOfAccount(null, [])).toBe("free");
    expect(tierOfAccount(undefined, [])).toBe("free");
  });

  it("staff keep premium even holding only an expired standard row", () => {
    // The staff bypass is checked BEFORE the rows, so a dead row cannot
    // demote an owner. Written out because the opposite order reads just as
    // plausibly and would be wrong.
    const expiredMonthly = [{ plan: "monthly", status: "canceled", currentPeriodEnd: new Date(Date.now() - DAY) }];
    expect(tierOfAccount({ role: "owner" }, expiredMonthly)).toBe("premium");
  });
});

describe("hasAnyAccess is a reading of that answer, not a second rule", () => {
  it("is true for exactly the tiers that are not free", () => {
    expect(hasAnyAccess("free")).toBe(false);
    expect(hasAnyAccess("standard")).toBe(true);
    expect(hasAnyAccess("premium")).toBe(true);
  });

  it("agrees with tierOfAccount on all 144 combinations", () => {
    // The binary question used to have its own implementation
    // (userHasActiveSubscription: "some row is live"). This is the case
    // that says the replacement is the same predicate and not merely a
    // similar one.
    for (const plan of PLANS) {
      for (const status of STATUSES) {
        for (const period of PERIODS) {
          const row = { plan, status, currentPeriodEnd: period.at() };
          const someRowLive =
            (status === "active" || status === "trialing") && row.currentPeriodEnd.getTime() > Date.now();
          expect(hasAnyAccess(tierOfAccount(STUDENT, [row])), `${plan}/${status}/${period.name}`).toBe(someRowLive);
        }
      }
    }
  });
});

describe("the tier readers on top of it", () => {
  it("C1 is the only level reserved for Premium", () => {
    for (const level of ["A1", "A2", "B1", "B2"]) {
      expect(canAccessLevel("free", level)).toBe(true);
      expect(canAccessLevel("standard", level)).toBe(true);
    }
    expect(canAccessLevel("standard", "C1")).toBe(false);
    expect(canAccessLevel("premium", "C1")).toBe(true);
  });

  it("standard does not pass the Premium-only check", () => {
    expect(isPremiumTier("free")).toBe(false);
    expect(isPremiumTier("standard")).toBe(false);
    expect(isPremiumTier("premium")).toBe(true);
  });
});
