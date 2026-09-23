import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { invalidateSubscriptionCache } from "@/lib/subscription";
import { planFromStoreProductId } from "@/lib/revenuecat-config";
import type { PlanId } from "@/lib/plans";

// RevenueCat webhooks (https://www.revenuecat.com/docs/integrations/webhooks)
// don't sign the body like Stripe does — auth is a plain shared secret sent
// as `Authorization: Bearer <secret>`, configured once in the RevenueCat
// dashboard's webhook settings. Timing-safe compare isn't worth the
// complexity here: this header is a fixed shared secret compared once per
// request, not a password-auth path.
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${expected}`;
}

// RevenueCat's app_user_id is whatever we passed to `Purchases.logIn()` on
// the client — per the hybrid-billing architecture, that's always set to
// our own internal userId directly (unlike Stripe, which needs a metadata
// round-trip because Stripe has no concept of "our" user id at all).
interface RevenueCatEvent {
  /** Идентификатор САМОГО события. Ключ, по которому повтор доставки
   *  различается с первой доставкой, — см. `alreadyProcessed` ниже. */
  id?: string;
  type: string;
  app_user_id: string;
  original_transaction_id?: string | null;
  product_id?: string;
  /** Базовый план Google, если RevenueCat разложил товар на два поля.
   *  Обычно `product_id` уже приходит составным (`standard:monthly`). */
  base_plan_id?: string | null;
  store?: string;
  /** SANDBOX у покупки тестировщика из License testing, PRODUCTION у
   *  покупки ученика. Доступ этим полем НЕ решается — оно только
   *  записывается, чтобы «сколько у нас платящих» можно было спросить
   *  честно. */
  environment?: string | null;
  expiration_at_ms?: number | null;
  purchased_at_ms?: number;
  /** Когда это событие произошло по часам RevenueCat. Нужен ровно одному
   *  месту — дате отмены (`canceledAt`), см. `upsertFromEvent`. */
  event_timestamp_ms?: number | null;
  /** TRANSFER: у кого покупку забрали и кому отдали. Оба поля — списки. */
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
}

interface RevenueCatWebhookBody {
  event: RevenueCatEvent;
}

// "lifetime" is not a Stripe PlanId (see src/lib/plans.ts) — it's sold
// exclusively as a native, non-renewing store product, never through
// Stripe on web, so it's kept out of that Stripe-specific type rather
// than conflated with it.
type RevenueCatPlanId = PlanId | "lifetime";

// Товар магазина → наш план. Сама перепись живёт в
// `src/lib/revenuecat-config.ts` (её читает ещё и экран покупки, и
// сторож), здесь только вызов: «неизвестный товар» обязан называться
// `unknown`, а не превращаться молча в подписку.
function planFromProductId(event: RevenueCatEvent): RevenueCatPlanId | "unknown" {
  return (
    planFromStoreProductId({ productId: event.product_id, basePlanId: event.base_plan_id }) ?? "unknown"
  );
}

// A lifetime purchase is a StoreKit "non-consumable" — it has no renewal,
// no expiration, and RevenueCat's NON_RENEWING_PURCHASE event for it never
// carries an expiration_at_ms at all (unlike a subscription in its grace
// period, which does). Treating that "no expiration" case as short-lived
// would incorrectly cut off access a year after purchase — access is
// meant to never end, so it gets an explicit far-future date instead of
// reusing the (unset) event field.
const LIFETIME_PERIOD_END = new Date("2099-12-31T00:00:00.000Z");

// The one plan id that must never be revoked by a lapse signal. Named once
// so periodEndOf()'s "never expires" branch and the EXPIRATION guard below
// cannot drift apart. Typed as the literal, not widened to string, so it
// stays assignable to RevenueCatPlanId.
const LIFETIME_PLAN = "lifetime" satisfies RevenueCatPlanId;

/* A webhook event we deliberately did NOT act on. Sent to Sentry as an
 * event rather than swallowed, because "we answered 200 and did nothing" is
 * indistinguishable from "we answered 200 and stored the purchase" in an
 * access log, and the difference is somebody's paid access. Reporting must
 * never become a second failure, so it is wrapped — same rule as
 * reportRefundNotApplied in the Stripe webhook. */
async function reportIgnoredEvent(
  name: string,
  message: string,
  extra: Record<string, unknown>
): Promise<void> {
  console.warn(`[revenuecat] ${name}: ${message}`, extra);
  try {
    const error = new Error(message);
    error.name = name;
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error, {
      level: "warning",
      tags: { defect: "revenuecat-event-ignored", anomaly: name },
      extra,
    });
  } catch {
    // Reporting the problem must never become a second problem.
  }
}

function periodEndOf(event: RevenueCatEvent, plan: RevenueCatPlanId | "unknown"): Date {
  if (plan === LIFETIME_PLAN) return LIFETIME_PERIOD_END;
  if (event.expiration_at_ms) return new Date(event.expiration_at_ms);
  // A subscription event without an expiration and without a recognized
  // product mapping — shouldn't happen for a real subscription, but
  // falls back to a short window rather than granting indefinite access
  // for an unmapped product.
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
}

// What the handler actually did with an event, so POST can say so in the
// response body instead of returning an indistinguishable bare 200.
type UpsertOutcome =
  | { stored: true }
  | { stored: false; ignored: "no-transaction-id" | "unknown-app-user-id" };

/**
 * ПРОДЛЕНИЕ ОТКЛЮЧЕНО ИЛИ НЕТ — ВТОРОЙ ФАКТ О СТРОКЕ, заход 7.226.
 *
 * `"renews"` — строка продлится (покупка, продление, смена товара,
 * отзыв отмены); `"canceled"` — автопродление выключено, а оплаченный
 * период ещё идёт.
 *
 * Зачем это здесь. Замер боевой базы 23.09.2026 после настоящей покупки
 * владельца: событие CANCELLATION дошло (расписка
 * `2AAEB200-A075-4430-A896-172C6903AF5F`, 19:36:20 UTC), а у строки
 * `cmuehmp6f000004l2e6p0ts0r` колонка `canceledAt` осталась `NULL` —
 * ветка CANCELLATION писала только `status: "active"`. Кабинет читает
 * `getDisplayStatus` (`src/lib/subscription-status.ts`), а тот считает
 * строку «отменяемой» РОВНО по `canceledAt != null || status ===
 * "canceled"`: ни того, ни другого не было, и экран печатал «Активна» —
 * про подписку, которая уже не продлится.
 *
 * Колонка `canceledAt` заведена долгом 190 и в боевой базе УЖЕ ЕСТЬ
 * (прочитана тем же замером) — миграции здесь не требуется ни одной.
 *
 * Правило то же, что у Stripe (`src/app/api/webhooks/stripe/route.ts`,
 * долг 190): дата ставится ОДИН раз и не переписывается повторной
 * доставкой, а отзыв отмены её снимает. Доступа это поле не решает
 * вовсе — доступ по-прежнему решает `currentPeriodEnd`.
 */
type RenewalIntent = "renews" | "canceled";

async function upsertFromEvent(
  event: RevenueCatEvent,
  status: string,
  intent: RenewalIntent
): Promise<UpsertOutcome> {
  const transactionId = event.original_transaction_id;
  if (!transactionId) return { stored: false, ignored: "no-transaction-id" }; // nothing stable to key this event on

  const existing = await db.subscription.findUnique({
    where: { rcOriginalTransactionId: transactionId },
  });

  // Debt 31, end one. `create` below writes userId: event.app_user_id
  // straight into a column that is a foreign key onto User
  // (prisma/schema.prisma, model Subscription) — so an event carrying an
  // app_user_id we have never seen made Prisma throw, the route answer
  // 500, and RevenueCat redeliver the same event indefinitely. The id is
  // not ours to trust: it is whatever `Purchases.logIn()` was called with
  // on some device, and a reinstall, a sandbox tester, a TEST event from
  // the dashboard or a deleted account all produce one we cannot resolve.
  //
  // So the user is looked up BEFORE the write, and an unresolvable one is
  // answered 200 with an explicit `ignored` marker. The price of that 200
  // is named out loud: a genuine purchase whose user row is merely LATE
  // (signup transaction still committing) is dropped and never retried,
  // because 200 tells RevenueCat to stop. That is the chosen side of the
  // trade — an infinite redelivery loop costs every later event on the
  // same endpoint, while this case is visible in Sentry by name and
  // recoverable by hand. Only the create path needs the check: an
  // existing row already has a valid userId, and update never touches it.
  if (!existing) {
    const user = await db.user.findUnique({
      where: { id: event.app_user_id },
      select: { id: true },
    });
    if (!user) {
      await reportIgnoredEvent(
        "RevenueCatUnknownAppUserId",
        `${event.type}: app_user_id does not match any user — event acknowledged with 200 and deliberately not stored`,
        {
          type: event.type,
          appUserId: event.app_user_id,
          originalTransactionId: transactionId,
          productId: event.product_id ?? null,
          store: event.store ?? null,
        }
      );
      return { stored: false, ignored: "unknown-app-user-id" };
    }
  }

  // Once a Subscription row exists, its plan is trusted as-is (an
  // existing row's `plan` column already went through this same mapping
  // when the row was created) — only a brand-new row needs the product-id
  // lookup.
  const plan = (existing?.plan as RevenueCatPlanId | "unknown" | undefined) ?? planFromProductId(event);

  // Товар, которого нет в переписи, — это НЕ «ничего страшного». Доступ
  // такой строке всё равно открывается (деньги магазин уже взял, и
  // отказать заплатившему хуже), но уровень у неё будет `standard`, и
  // покупатель Premium за 2 299 песо не увидит ни C1, ни звёздных пазлов.
  // Молчать об этом нельзя: снаружи это неотличимо от исправной покупки.
  if (!existing && plan === "unknown") {
    await reportIgnoredEvent(
      "RevenueCatUnknownProduct",
      `${event.type}: товар магазина не найден в переписи — доступ открыт как «standard», уровень мог быть выше`,
      {
        type: event.type,
        appUserId: event.app_user_id,
        productId: event.product_id ?? null,
        basePlanId: event.base_plan_id ?? null,
        store: event.store ?? null,
      }
    );
  }

  const canceledAt =
    intent === "canceled"
      ? (existing?.canceledAt ??
        (event.event_timestamp_ms ? new Date(event.event_timestamp_ms) : new Date()))
      : null;

  await db.subscription.upsert({
    where: { rcOriginalTransactionId: transactionId },
    update: {
      status,
      currentPeriodEnd: periodEndOf(event, plan),
      rcEnvironment: event.environment ?? null,
      canceledAt,
    },
    create: {
      userId: event.app_user_id,
      plan,
      status,
      currentPeriodEnd: periodEndOf(event, plan),
      provider: "revenuecat",
      rcOriginalTransactionId: transactionId,
      rcAppUserId: event.app_user_id,
      rcStore: event.store ?? null,
      rcEnvironment: event.environment ?? null,
      canceledAt,
    },
  });
  await invalidateSubscriptionCache(event.app_user_id);
  return { stored: true };
}

/**
 * Расписка о прочтении. Пишется ПОСЛЕ работы, а не до: событие, на
 * котором обработчик упал, обязано приехать снова.
 *
 * Гонка двух одновременных доставок одного события ловится здесь же —
 * вторая вставка падает на первичном ключе, и это ровно тот исход,
 * который нам нужен. Падение записи расписки НЕ роняет ответ: хуже
 * повтора только 500, после которого RevenueCat пришлёт то же событие
 * ещё раз.
 */
async function rememberEvent(eventId: string | null, event: RevenueCatEvent): Promise<void> {
  if (!eventId) return;
  try {
    await db.revenueCatEvent.create({
      data: {
        id: eventId,
        type: event.type,
        appUserId: event.app_user_id,
        environment: event.environment ?? null,
      },
    });
  } catch {
    // Уже записано другой доставкой — значит расписка есть, и это всё,
    // что от неё требовалось.
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.REVENUECAT_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "RevenueCat is not configured on this server" },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Invalid or missing Authorization header" }, { status: 401 });
  }

  let body: RevenueCatWebhookBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const event = body.event;
  if (!event?.type || !event.app_user_id) {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  /* ИДЕМПОТЕНТНОСТЬ ПО ID СОБЫТИЯ — заход 7.224.
   *
   * RevenueCat повторяет доставку, пока не получит 2xx, и повторяет её же
   * по кнопке «Resend» в консоли. `upsert` по транзакции идемпотентен сам
   * по себе, но соседние ветки — нет: EXPIRATION, доставленный повторно
   * ПОСЛЕ UNCANCELLATION, снова закрыл бы уже восстановленный доступ.
   * Расписка о прочтении делает повтор пустым.
   *
   * Событие без `id` (такое шлёт только рукописная проба) обрабатывается
   * как обычно: отказать ему значило бы отказать и настоящей покупке,
   * если RevenueCat однажды перестанет класть это поле. */
  const eventId = typeof event.id === "string" && event.id.trim() ? event.id.trim() : null;
  if (eventId) {
    const seen = await db.revenueCatEvent.findUnique({ where: { id: eventId }, select: { id: true } });
    if (seen) return NextResponse.json({ received: true, ignored: "duplicate-event" });
  }

  switch (event.type) {
    // First purchase and a manual/store-driven renewal both mean the same
    // thing for us: the subscription is active through the new
    // expiration_at_ms. Handled identically, same as Stripe's
    // customer.subscription.created/updated pair above.
    // NON_RENEWING_PURCHASE is a one-time StoreKit "non-consumable" buy —
    // this is the event type a Lifetime purchase actually fires (it never
    // renews, so RENEWAL/CANCELLATION/EXPIRATION never apply to it).
    // periodEndOf() special-cases the "lifetime" plan to never expire.
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE":
    case "UNCANCELLATION":
    case "NON_RENEWING_PURCHASE": {
      // Любое из этих событий означает «строка живёт и продлится дальше»,
      // поэтому отметка об отключённом продлении с неё снимается —
      // UNCANCELLATION ради этого и стоит в этом списке.
      const outcome = await upsertFromEvent(event, "active", "renews");
      if (!outcome.stored) return NextResponse.json({ received: true, ignored: outcome.ignored });
      break;
    }

    // The user turned off auto-renew (or a refund/chargeback was issued).
    // This is NOT the same as access ending — Apple/Google keep the
    // subscription usable through the already-paid period, and RevenueCat
    // will send EXPIRATION separately when it actually lapses. So this
    // only refreshes the period-end bookkeeping, it does not revoke
    // access early (unlike Stripe's customer.subscription.deleted, which
    // fires exactly at the moment access should end).
    case "CANCELLATION": {
      const outcome = await upsertFromEvent(event, "active", "canceled");
      if (!outcome.stored) return NextResponse.json({ received: true, ignored: outcome.ignored });
      break;
    }

    // The grace period (if any) is over and the subscription has actually
    // lapsed — this is the real "close access now" signal.
    case "EXPIRATION": {
      const transactionId = event.original_transaction_id;
      if (transactionId) {
        const existing = await db.subscription.findUnique({
          where: { rcOriginalTransactionId: transactionId },
          select: { userId: true, plan: true },
        });

        // Debt 31, end two. The revocation used to name no plan at all, so
        // a lifetime purchase — bought once, promised forever, and stored
        // with currentPeriodEnd 2099 precisely so that nothing expires it —
        // was revoked by the same one-line updateMany as a lapsed monthly
        // subscription. A lifetime row has no renewal to lapse, so an
        // EXPIRATION naming it is not a lapse but noise (a store-side
        // refund shows up as CANCELLATION, and a real revocation is the
        // Stripe-side path in debt 29): it is refused and reported, not
        // obeyed. The guard sits in the `where`, not in an early return, so
        // a transaction id that somehow covers both a lifetime row and a
        // renewable one still closes the renewable one.
        if (existing?.plan === LIFETIME_PLAN) {
          await reportIgnoredEvent(
            "RevenueCatExpirationOnLifetime",
            "EXPIRATION named a lifetime purchase — access deliberately left open, nothing written",
            {
              appUserId: event.app_user_id,
              originalTransactionId: transactionId,
              productId: event.product_id ?? null,
              store: event.store ?? null,
            }
          );
          return NextResponse.json({ received: true, ignored: "expiration-on-lifetime" });
        }

        await db.subscription.updateMany({
          where: { rcOriginalTransactionId: transactionId, plan: { not: LIFETIME_PLAN } },
          data: { status: "canceled" },
        });
        if (existing) await invalidateSubscriptionCache(existing.userId);
      }
      break;
    }

    // A renewal payment failed and the store is retrying — mirrors
    // Stripe's invoice.payment_failed handling.
    case "BILLING_ISSUE": {
      const transactionId = event.original_transaction_id;
      if (transactionId) {
        const existing = await db.subscription.findUnique({
          where: { rcOriginalTransactionId: transactionId },
          select: { userId: true },
        });
        await db.subscription.updateMany({
          where: { rcOriginalTransactionId: transactionId },
          data: { status: "past_due" },
        });
        if (existing) await invalidateSubscriptionCache(existing.userId);
      }
      break;
    }

    /* ПОКУПКА ПЕРЕЕХАЛА НА ДРУГОЙ АККАУНТ САЙТА — заход 7.224.
     *
     * Когда это приходит. Один и тот же аккаунт Google купил подписку,
     * сидя под одной учётной записью сайта, а потом вошёл под другой:
     * RevenueCat переносит покупку на нового `app_user_id` и сообщает об
     * этом списками `transferred_from` / `transferred_to`.
     *
     * Почему это нельзя пропустить. Строка доступа привязана к
     * ПОЛЬЗОВАТЕЛЮ САЙТА (`Subscription.userId`), а не к покупке Google.
     * Оставь мы её на прежнем месте — платит один человек, а доступ
     * остаётся у другого, и ни один из них об этом не узнает.
     *
     * Собственного `original_transaction_id` у этого события может не
     * быть, поэтому строки ищутся по `rcAppUserId`. Неизвестный получатель
     * — тот же случай, что и везде здесь: 200, след в Sentry, ничего не
     * переписано. */
    case "TRANSFER": {
      const to = (event.transferred_to ?? []).find((id) => typeof id === "string" && id.trim());
      const from = (event.transferred_from ?? []).filter((id) => typeof id === "string" && id.trim());
      if (!to || from.length === 0) {
        await reportIgnoredEvent(
          "RevenueCatTransferWithoutParties",
          "TRANSFER без отправителя или получателя — переносить нечего и некуда",
          { appUserId: event.app_user_id, from, to: to ?? null }
        );
        break;
      }
      const user = await db.user.findUnique({ where: { id: to }, select: { id: true } });
      if (!user) {
        await reportIgnoredEvent(
          "RevenueCatUnknownAppUserId",
          "TRANSFER: получатель не совпал ни с одним пользователем — событие принято 200 и намеренно не применено",
          { type: event.type, appUserId: to, from }
        );
        break;
      }
      const moved = await db.subscription.updateMany({
        where: { rcAppUserId: { in: from }, provider: "revenuecat" },
        data: { userId: to, rcAppUserId: to },
      });
      for (const previous of from) await invalidateSubscriptionCache(previous);
      await invalidateSubscriptionCache(to);
      if (moved.count === 0) {
        await reportIgnoredEvent(
          "RevenueCatTransferMatchedNothing",
          "TRANSFER: под прежним app_user_id не нашлось ни одной строки доступа",
          { from, to }
        );
      }
      break;
    }

    // TEST fires whenever the "Send test event" button in the RevenueCat
    // dashboard is used to verify the endpoint is reachable;
    // SUBSCRIPTION_PAUSED isn't part of this app's plan model yet. Both
    // acknowledged explicitly rather than falling through silently.
    case "TEST":
    case "SUBSCRIPTION_PAUSED":
      break;

    default:
      break;
  }

  await rememberEvent(eventId, event);
  return NextResponse.json({ received: true });
}
