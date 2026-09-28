import type { Subscription } from "@/generated/prisma/client";
import { getDisplayStatus } from "@/lib/subscription-status";

/**
 * ЕСТЬ ЛИ У ЧЕЛОВЕКА ПОДПИСКА GOOGLE PLAY, КОТОРАЯ ПРОДОЛЖИТ СПИСЫВАТЬ
 * ДЕНЬГИ ПОСЛЕ УДАЛЕНИЯ АККАУНТА — заход 7.242, долг 344.
 *
 * Удаление аккаунта (`/api/auth/confirm-account-deletion`) отменяет только
 * подписки Stripe: подписку из Google Play может отменить лишь сам Google,
 * у сервера такого права нет. Аудит 7.241 (Р3) измерил, что форма удаления
 * и страница подтверждения об этом молчали, а подтверждение ещё и писало
 * «se eliminará tu suscripción». Этот признак решает, кому показывать
 * предупреждение «сначала отмените подписку в Google Play».
 *
 * Правило: строка из магазина (`provider = "revenuecat"`), которая сейчас
 * ПРОДЛЕВАЕТСЯ — «активна» или «пробный период». Не входят:
 *   * `canceling` — человек уже отменил продление в Google Play, списаний
 *     больше не будет, предупреждать не о чем;
 *   * Premium (`lifetime`) — разовая покупка, продлевать её нечему;
 *   * подписки сайта (Stripe) — их удаление отменяет само.
 *
 * Модуль чистый (без `server-only` и без базы): его читают страница
 * профиля, страница подтверждения, письмо и тест.
 */
export const STORE_PROVIDER = "revenuecat";

/** Тот же литерал, что `PREMIUM_PLAN_ID` в `subscription.ts`; тот модуль
 *  серверный, и тянуть его сюда значило бы тянуть базу в чистую функцию. */
const LIFETIME_PLAN = "lifetime";

type Row = Pick<Subscription, "provider" | "plan" | "status" | "currentPeriodEnd"> &
  Partial<Pick<Subscription, "canceledAt">>;

export function hasRenewingStoreSubscription(rows: readonly Row[] | null | undefined): boolean {
  return (rows ?? []).some((row) => {
    if (row.provider !== STORE_PROVIDER) return false;
    if (row.plan === LIFETIME_PLAN) return false;
    const status = getDisplayStatus(row);
    return status === "active" || status === "trialing";
  });
}
