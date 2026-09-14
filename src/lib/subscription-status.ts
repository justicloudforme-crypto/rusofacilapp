/**
 * ЧИСТЫЕ ПРАВИЛА СОСТОЯНИЯ ПОДПИСКИ — без единого серверного импорта.
 *
 * Вынесено из `src/lib/subscription.ts` 14.09.2026 ровно по той же
 * причине, по которой раньше вынесли `free-trial-limits.ts` и
 * `word-games/free-tier.ts`: правило нужно там, где `import "server-only"`
 * не разрешается вовсе. Новый читатель — сторож
 * `scripts/check-subscription-wording.ts`, который гоняется под `tsx`, вне
 * разрешения модулей Next, и потому не может тянуть `subscription.ts`
 * целиком (там Prisma, кеш и `server-only`).
 *
 * `subscription.ts` перевыставляет отсюда всё, что выставлял раньше,
 * поэтому ни один существующий `from "@/lib/subscription"` не менялся, а
 * определение осталось ровно одно.
 */
import type { Subscription } from "@/generated/prisma/client";

const INACTIVE_STATUSES = new Set(["canceled", "past_due", "incomplete_expired"]);

/**
 * Access is derived from `currentPeriodEnd`, not just from `status`. This
 * means a subscription is automatically treated as expired the moment its
 * period ends, even if the Stripe webhook that flips `status` hasn't
 * arrived yet — the deciding check always happens at read time.
 */
export function isSubscriptionActive(
  subscription: Pick<Subscription, "status" | "currentPeriodEnd"> | null | undefined
): boolean {
  if (!subscription) return false;
  if (INACTIVE_STATUSES.has(subscription.status)) return false;
  if (subscription.currentPeriodEnd.getTime() <= Date.now()) return false;
  return subscription.status === "active" || subscription.status === "trialing";
}

export type DisplayStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  /** Отменена, но оплаченный период ещё идёт: продления не будет, доступ
   *  есть (долг 190). Самостоятельное состояние, потому что и «активна», и
   *  «отменена» про такую строку — полуправда. */
  | "canceling"
  | "expired";

/**
 * UI-facing status: unlike the raw `status` column, this folds in the
 * date-based auto-expiry from `isSubscriptionActive` — a subscription still
 * marked "active" in the database past its `currentPeriodEnd` is shown as
 * "expired", not "active".
 */
export function getDisplayStatus(
  subscription:
    | (Pick<Subscription, "status" | "currentPeriodEnd"> & Partial<Pick<Subscription, "canceledAt">>)
    | null
    | undefined
): DisplayStatus {
  if (!subscription) return "none";
  if (subscription.status === "past_due") return "past_due";
  // ПОРЯДОК ЗДЕСЬ — ЭТО И ЕСТЬ ПРАВИЛО (долг 194).
  //
  // До 14.09.2026 первой строкой стояло `if (status === "canceled") return
  // "canceled"`, то есть экран печатал СЛОВО из колонки, а не положение
  // дел. Владелец снял на телефоне ровно это: «Отменена», под ней «Истекла
  // 19 сентября 2026», а сегодня 14 сентября. Глагол в прошедшем времени
  // рядом с датой в будущем — следствие того, что слово решало раньше даты.
  //
  // Теперь решает ДАТА, а слово — только признак отмены, наравне с
  // `canceledAt`. Кончился период — «истекла», и это верно при любой
  // надписи в колонке. Период идёт — дальше смотрим, отменена ли.
  const periodOver = subscription.currentPeriodEnd.getTime() <= Date.now();
  if (periodOver) return "expired";
  const canceled = subscription.canceledAt != null || subscription.status === "canceled";
  if (canceled) {
    // Период ещё идёт. Две разные вещи, и различает их доступ:
    //   * доступ есть (`cancel_at_period_end`, правка 7.193) — «активна до
    //     …, продление отключено»;
    //   * доступа уже нет (строка, отменённая СТАРЫМ кодом до 13.09.2026,
    //     либо снятая администратором) — «отменена», и датой на экране
    //     будет дата отмены, а не конец оплаченного периода, потому что
    //     этот конец к делу уже не относится.
    return isSubscriptionActive(subscription) ? "canceling" : "canceled";
  }
  return subscription.status === "trialing" ? "trialing" : "active";
}

/**
 * КАКУЮ ДАТУ И С КАКОЙ ПОДПИСЬЮ ПЕЧАТАТЬ — вторая половина долга 194.
 *
 * Подпись под датой раньше выбиралась выражением `isActive ? «Действует
 * до» : «Истекла»`, то есть тем же словом из колонки, только через
 * доступ. Здесь она выбирается СОСТОЯНИЕМ, которое уже вычислено из даты:
 *
 *   `expires`    — период идёт: «Действует до <дата конца>»
 *   `expired`    — период кончился: «Истекла <дата конца>»
 *   `canceledOn` — отменена, доступа нет, а конец периода ещё впереди:
 *                  печатается ДАТА ОТМЕНЫ, потому что дата в будущем рядом
 *                  со словом «истекла» — это и был дефект.
 *
 * Пара, ради которой всё это писалось, читается прямо отсюда:
 *   активная с назначенной отменой → "canceling" + `expires`;
 *   период кончился               → "expired"  + `expired`.
 * Сторож `check:subscription-wording` проверяет ровно её.
 */
export type SubscriptionDateLine = { kind: "expires" | "expired" | "canceledOn"; iso: string };

export function subscriptionDateLine(
  subscription: Pick<Subscription, "status" | "currentPeriodEnd" | "updatedAt"> &
    Partial<Pick<Subscription, "canceledAt">>
): SubscriptionDateLine {
  const status = getDisplayStatus(subscription);
  if (status === "expired") return { kind: "expired", iso: subscription.currentPeriodEnd.toISOString() };
  if (status === "canceled") {
    // `canceledAt` у строк, отменённых старым кодом, пуст — тогда датой
    // отмены служит `updatedAt`: именно эта запись её и поставила.
    const at = subscription.canceledAt ?? subscription.updatedAt;
    return { kind: "canceledOn", iso: new Date(at).toISOString() };
  }
  return { kind: "expires", iso: subscription.currentPeriodEnd.toISOString() };
}
