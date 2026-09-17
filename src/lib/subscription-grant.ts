/**
 * ВЫДАННЫЙ ДОСТУП — ЭТО НЕ ПОКУПКА, И ЭКРАН ОБЯЗАН ГОВОРИТЬ ЭТО СЛОВАМИ.
 *
 * Заход 7.206, 17.09.2026. Владелец снял на телефоне, аккаунтом
 * `www.petrov.ru_1992@mail.ru`, две неправды подряд во вкладке
 * «Suscripción»:
 *
 *   1. КНОПКА «Cancelar suscripción». Замер по коду: нажатие уходит на
 *      `POST /api/subscription/cancel`, там строка попадает в
 *      `cancellable` (она активна, не Premium, `canceledAt` пуст),
 *      `stripeSubscriptionId` у неё `null` — значит в Stripe не уходит
 *      НИЧЕГО, — и всё, что делает кнопка, это ставит `canceledAt`
 *      местной строке. Отменять было нечего: доступ выдан не кассой, он
 *      не продлевается и сам истекает в `currentPeriodEnd`. Нажатие
 *      меняло подпись на «отменена» и не меняло ни дня доступа.
 *
 *   2. «Historial de pagos». Та же строка стояла в списке ПЛАТЕЖЕЙ,
 *      подписанная тарифом, — при том, что платежа не было вовсе.
 *
 * ПРИЗНАК ВЫДАЧИ — ДВА УСЛОВИЯ, И ОБА ОБЯЗАТЕЛЬНЫ.
 *
 * Плана мало: значений у колонки `plan` больше, чем перечислено где бы то
 * ни было («manual», «access_code», «referral», «e2e-test», и завтра
 * появится пятое), и правило «всё, что не месяц/год/Premium, — выдача»
 * молча отняло бы кнопку отмены у настоящей подписки с новым именем
 * тарифа. Поэтому спрашивается ЕЩЁ и отсутствие подписки в кассе: у любой
 * строки, заведённой кассой, `stripeSubscriptionId` заполнен, и такая
 * строка отменяема по построению.
 *
 * Проверено по боевой базе 17.09.2026: три живые строки выдачи
 * («manual» ×2, «access_code» ×1) — у всех трёх `stripeSubscriptionId`
 * пуст; две строки «monthly» — у обеих заполнен. Ни одного исключения.
 *
 * Premium («lifetime») выдачей НЕ считается: это разовая покупка, за неё
 * заплачено, и в историю платежей она входит по праву. Кнопки отмены у
 * неё нет и без этого правила (`isPremiumPlan` в `subscription.ts`).
 */

/** Планы, за которые человек ЗАПЛАТИЛ. Всё остальное — кандидат в выдачу,
 *  но кандидатом дело не кончается (см. второе условие ниже). */
export const PURCHASED_PLANS = ["monthly", "annual", "lifetime"] as const;

export interface GrantShapedRow {
  plan: string;
  stripeSubscriptionId: string | null;
}

export function isPurchasedPlan(plan: string): boolean {
  return (PURCHASED_PLANS as readonly string[]).includes(plan);
}

/** Строка доступа, за которую не платили и которую нечем отменять. */
export function isGrantSubscription(row: GrantShapedRow | null | undefined): boolean {
  if (!row) return false;
  if (isPurchasedPlan(row.plan)) return false;
  return !row.stripeSubscriptionId;
}

/**
 * Откуда взялась выдача: человек погасил код или доступ открыли руками.
 *
 * «access_code» отвечает за себя сам — с 08.09.2026 погашение кода пишет
 * именно это значение (PROGRESS.md 7.151). Но строки, заведённые ДО той
 * правки, остались «manual», и одна такая живёт на проде прямо сейчас:
 * `www.petrov.ru_1992@mail.ru` погасил код `AMIGOJY9DTAVG` 09.09.2026 в
 * 03:58:05.498Z, а его строка `Subscription` заведена в 03:58:05.612Z —
 * через 114 мс, тем же погашением. Отличить её от настоящей ручной выдачи
 * планом нечем, а по ВРЕМЕНИ — можно и честно: выдача, заведённая в одну
 * минуту с погашением кода, и есть эта выдача.
 *
 * Окно намеренно широкое (минута) и намеренно не больше: погашение
 * заводит строку в том же запросе, то есть счёт идёт на сотни
 * миллисекунд, а минута покрывает любую медленную запись, не дотягиваясь
 * до следующего события в жизни аккаунта.
 */
export const CODE_MATCH_WINDOW_MS = 60_000;

export type GrantSource = "code" | "manual";

export function grantSource(
  row: { plan: string; createdAt: Date },
  redeemedAtList: readonly Date[],
): GrantSource {
  if (row.plan === "access_code") return "code";
  const created = row.createdAt.getTime();
  const matched = redeemedAtList.some((at) => Math.abs(at.getTime() - created) <= CODE_MATCH_WINDOW_MS);
  return matched ? "code" : "manual";
}
