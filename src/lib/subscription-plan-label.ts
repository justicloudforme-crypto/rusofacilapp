import type { Dictionary } from "@/i18n/dictionaries";
import { grantSource, isGrantSubscription } from "./subscription-grant";

/**
 * ПОДПИСЬ ТАРИФА НА ЭКРАНЕ — ОДНА ФУНКЦИЯ, И ОНА ТЕПЕРЬ ПРОВЕРЯЕМА.
 *
 * Вынесена из `src/app/[lang]/profile/page.tsx` 16.09.2026 (заход 7.200)
 * ровно затем, чтобы утверждение «у месячного подписчика тариф назван
 * „Ежемесячный“» можно было доказать ПРОГОНОМ, а не чтением. Владелец
 * увидеть это на телефоне не смог: месячной подписки нет ни у одного из
 * двух аккаунтов на видео, а единственная боевая подписка кончается
 * 19.09.2026 09:47 (GMT+10). Поднимать ради подписи серверную страницу с
 * полутора десятками запросов дороже, чем прогнать саму функцию.
 *
 * Никакого поведения не изменилось: тело перенесено дословно, страница
 * зовёт её по имени.
 */
// Subscription.plan stores the internal identifier ("monthly"/"annual"/
// "lifetime") shared with Stripe/RevenueCat product mapping — display uses
// the already-localized pricing-card names instead so a plan renders as
// "Premium" here (and its own locale) without renaming that identifier.
export function planDisplayLabel(plan: string, dict: Dictionary): string {
  if (plan === "monthly") return dict.pricing.monthly.name;
  if (plan === "annual") return dict.pricing.annual.name;
  if (plan === "lifetime") return dict.pricing.lifetime.name;
  // Две выдачи не через кассу, и подписи у них разные (PROGRESS.md 7.151).
  // "access_code" — человек погасил код-приглашение сам; "manual" — доступ
  // выдал администратор. До 08.09.2026 обе строки были "manual", и ученик с
  // приглашением читал у себя «Доступ выдан вручную» — фразу про чужое
  // событие. Строки, записанные ДО этой правки, так и остались "manual" и
  // подписаны как ручная выдача: отличить их задним числом нечем, а
  // переписывать боевые строки ради подписи — цена выше пользы.
  if (plan === "access_code") return dict.profile.planAccessCodeLabel;
  if (plan === "manual") return dict.profile.planManualLabel;
  return plan;
}

/**
 * ПОДПИСЬ СТРОКИ ДОСТУПА — ОДИН ПРИЗНАК НА ОБА МЕСТА (долг 248, 7.207).
 *
 * ЧТО СНЯЛ ВЛАДЕЛЕЦ 17.09.2026, аккаунтом `www.petrov.ru_1992@mail.ru`.
 * Вкладка «Suscripción» спорила сама с собой на расстоянии трёх строк:
 *
 *     Plan:  Acceso otorgado a mano
 *     ...    Tu acceso está abierto con un código y no se renueva…
 *
 * Причина не в словах, а в том, что ОТВЕЧАЛИ на вопрос «откуда этот
 * доступ» два разных куска кода. Строка истории платежей уже спрашивала
 * `grantSource` (7.206), а строка «Plan» смотрела только колонку `plan` —
 * а в ней у этого аккаунта стоит `manual`, потому что строка заведена
 * погашением кода ДО правки 08.09.2026 (7.151), и отличить её планом
 * нечем. По времени — можно: погашение `AMIGOJY9DTAVG` 09.09.2026 в
 * 03:58:05.498Z, строка `Subscription` — в 03:58:05.612Z, разница 114 мс.
 *
 * Теперь признак спрашивается ЗДЕСЬ, один раз, и оба места зовут эту
 * функцию. `planDisplayLabel` ниже она не отменяет — та по-прежнему
 * отвечает за настоящие тарифы.
 *
 * СЛОВА У ДВУХ МЕСТ РАЗНЫЕ НАМЕРЕННО, и это не второй признак. «Plan:
 * Acceso otorgado a mano» — про то, ЧТО у человека сейчас; строка истории
 * «Acceso abierto a mano» — про СОБЫТИЕ, которое когда-то случилось.
 * Общим у них обязано быть одно: ответ на вопрос «код это или рука».
 */
export type LabelPlace = "plan" | "history";

export function subscriptionRowLabel(
  row: { plan: string; stripeSubscriptionId: string | null; createdAt: Date },
  dict: Dictionary,
  redeemedCodeDates: readonly Date[],
  place: LabelPlace,
): string {
  if (!isGrantSubscription(row)) return planDisplayLabel(row.plan, dict);
  if (grantSource(row, redeemedCodeDates) === "code") return dict.profile.historyGrantCode;
  return place === "plan" ? dict.profile.planManualLabel : dict.profile.historyGrantManual;
}
