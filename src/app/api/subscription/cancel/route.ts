import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  getSubscriptionsForUser,
  invalidateSubscriptionCache,
  isPremiumPlan,
  isSubscriptionActive,
} from "@/lib/subscription";
import { getStripe } from "@/lib/stripe";
import { defaultLocale, isLocale } from "@/i18n/config";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/${lang}/login`, request.url), { status: 303 });
  }

  // "Cancel my subscription" means the recurring thing the person is being
  // billed for — every live one of them, since a user can hold more than
  // one row (a card subscription plus an admin grant, say) and cancelling
  // only the newest would leave them still billed on the other. A Premium
  // row is deliberately excluded: it is a one-time purchase that is already
  // paid for and cannot be un-bought, so cancelling a monthly plan must not
  // take it down with it. Someone who wants their account gone entirely
  // uses account deletion, which is a different button with a different
  // confirmation.
  const rows = await getSubscriptionsForUser(user.id);
  // Строка магазина сюда НЕ попадает — заход 7.224.
  //
  // Отменить подписку Google может только сам Google: наш код может лишь
  // пометить строку отменённой, а списание продолжится. Это худший из
  // возможных исходов — человек нажал «отменить», увидел подтверждение и
  // продолжил платить. Поэтому такие строки исключены здесь, а в кабинете
  // на их месте стоит ссылка в центр подписок магазина
  // (`playSubscriptionCenterUrl`), а не кнопка отмены.
  const cancellable = rows.filter(
    (row) =>
      isSubscriptionActive(row) &&
      !isPremiumPlan(row.plan) &&
      row.canceledAt === null &&
      row.provider !== "revenuecat",
  );

  if (cancellable.length > 0) {
    const stripe = getStripe();
    for (const row of cancellable) {
      if (stripe && row.stripeSubscriptionId) {
        // ОТМЕНА В КОНЦЕ ОПЛАЧЕННОГО ПЕРИОДА, А НЕ СЕЙЧАС — ДОЛГ 190.
        //
        // Здесь стоял `stripe.subscriptions.cancel()`, и он отменяет
        // НЕМЕДЛЕННО: Stripe закрывает подписку в ту же секунду, остаток
        // уже оплаченного периода сгорает, и `customer.subscription.deleted`
        // приходит сразу, а не в конце срока. Вместе со строкой ниже,
        // которая ставила `status: "canceled"` локально, это отрезало
        // доступ человеку, у которого он оплачен ещё на недели вперёд.
        //
        // При `cancel_at_period_end` Stripe присылает сначала
        // `customer.subscription.updated` (подписка ещё active, просто не
        // продлится), а `customer.subscription.deleted` — ровно в тот
        // момент, когда доступ и должен кончиться. Оба обработчика уже
        // написаны так, как надо (`src/app/api/webhooks/stripe/route.ts`),
        // и комментарий у второго — «fires exactly at the moment access
        // should end» — становится правдой только теперь.
        //
        // Ошибка Stripe гасится, как и раньше: отметка об отмене ниже
        // ставится в любом случае, а расхождение приведёт в порядок
        // вебхук. Разница в том, что теперь гасится БЕЗОПАСНЫЙ исход —
        // «подписка продолжит продлеваться», а не «доступ уже отобран».
        await stripe.subscriptions
          .update(row.stripeSubscriptionId, { cancel_at_period_end: true })
          .catch(() => {});
      }
    }
    // `status` НЕ трогаем: строка остаётся действующей до
    // `currentPeriodEnd`, и её закроет тот же датный расчёт в
    // `isSubscriptionActive`, который закрывает любую истёкшую подписку.
    await db.subscription.updateMany({
      where: { id: { in: cancellable.map((row) => row.id) } },
      data: { canceledAt: new Date() },
    });
    await invalidateSubscriptionCache(user.id);
  }

  return NextResponse.redirect(
    new URL(`/${lang}/profile?subscription=canceled`, request.url),
    { status: 303 }
  );
}
