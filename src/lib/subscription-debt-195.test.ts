/**
 * БОЕВАЯ СТРОКА ДОЛГА 195 ПОСЛЕ МИГРАЦИИ — 7.196, часть 6.
 *
 * ====================================================================
 * ЧТО БЫЛО ЗАПИСАНО В ПРОД 14.09.2026
 * ====================================================================
 *
 * Строка `cmszbb7fg000104lb96t5obn4` (план `monthly`), единственная из
 * шести строк `Subscription`, подпадавшая под правило:
 *
 *   поле              было                     стало
 *   status            canceled                 active
 *   canceledAt        NULL                     2026-08-19T00:07:52.622Z
 *   currentPeriodEnd  2026-09-18T23:47:02Z     не тронуто
 *   plan              monthly                  не тронуто
 *   createdAt         2026-08-18T23:47:10.300Z не тронуто
 *
 * Затронутых строк 1, всех остальных — 0.
 *
 * ====================================================================
 * ЧТО ЗДЕСЬ ПРОВЕРЯЕТСЯ И ПОЧЕМУ ПОДСАДКОЙ ДАТЫ
 * ====================================================================
 *
 * Требование владельца: доступ обязан вернуться СЕГОДНЯ и честно
 * закрыться ПОСЛЕ 18.09.2026 — и проверить это надо подсадкой даты, а не
 * ожиданием. Правила доступа читают `Date.now()`, поэтому здесь
 * подменяются часы, а строка берётся ровно та, что лежит на проде.
 *
 * Три момента, и третий — тот, ради которого всё написано:
 *   14.09.2026 — период идёт: доступ есть, экран говорит «активна до …»;
 *   18.09.2026 23:00 UTC — за 47 минут до конца: доступ ещё есть;
 *   19.09.2026 — период кончился: доступа нет, экран говорит «истекла»,
 *                и никакой записи для этого не потребовалось.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDisplayStatus, isSubscriptionActive, subscriptionDateLine } from "./subscription-status";

/** Строка ровно в том виде, в каком она лежит на проде ПОСЛЕ миграции. */
const PROD_ROW = {
  status: "active",
  currentPeriodEnd: new Date("2026-09-18T23:47:02.000Z"),
  canceledAt: new Date("2026-08-19T00:07:52.622Z"),
  updatedAt: new Date("2026-09-14T20:18:35.277Z"),
};

/** И она же ДО миграции — для позитивного контроля. */
const BEFORE_MIGRATION = {
  ...PROD_ROW,
  status: "canceled",
  canceledAt: null,
};

function at(iso: string, run: () => void) {
  vi.setSystemTime(new Date(iso));
  run();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("доступ по датам — подсадкой часов, а не ожиданием", () => {
  it("14.09.2026: доступ есть, состояние «отменена, период идёт»", () => {
    at("2026-09-14T12:00:00.000Z", () => {
      expect(isSubscriptionActive(PROD_ROW)).toBe(true);
      expect(getDisplayStatus(PROD_ROW)).toBe("canceling");
      const line = subscriptionDateLine(PROD_ROW);
      expect(line.kind).toBe("expires");
      expect(line.iso).toBe("2026-09-18T23:47:02.000Z");
    });
  });

  it("18.09.2026 23:00 UTC — за 47 минут до конца: доступ ещё есть", () => {
    at("2026-09-18T23:00:00.000Z", () => {
      expect(isSubscriptionActive(PROD_ROW)).toBe(true);
      expect(getDisplayStatus(PROD_ROW)).toBe("canceling");
    });
  });

  it("19.09.2026: доступ закрыт сам, по дате, и экран говорит «истекла»", () => {
    at("2026-09-19T00:00:00.000Z", () => {
      expect(isSubscriptionActive(PROD_ROW)).toBe(false);
      expect(getDisplayStatus(PROD_ROW)).toBe("expired");
      const line = subscriptionDateLine(PROD_ROW);
      expect(line.kind).toBe("expired");
      // И главный запрет долга 194: «истекла» рядом с датой в ПРОШЛОМ.
      expect(new Date(line.iso).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});

describe("позитивный контроль: до миграции всё это было неправдой", () => {
  it("14.09.2026 на строке ДО миграции доступа нет, и экран называет дату отмены", () => {
    at("2026-09-14T12:00:00.000Z", () => {
      expect(isSubscriptionActive(BEFORE_MIGRATION)).toBe(false);
      expect(getDisplayStatus(BEFORE_MIGRATION)).toBe("canceled");
      // Дата на экране — отмены (19.08), а не конца оплаченного периода:
      // конец периода к делу уже не относился, потому что доступа не было.
      expect(subscriptionDateLine(BEFORE_MIGRATION).kind).toBe("canceledOn");
    });
  });

  it("а 19.09.2026 обе строки сходятся: период кончился, и это «истекла»", () => {
    at("2026-09-19T00:00:00.000Z", () => {
      expect(getDisplayStatus(BEFORE_MIGRATION)).toBe("expired");
      expect(getDisplayStatus(PROD_ROW)).toBe("expired");
    });
  });
});
