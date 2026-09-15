import type { Dictionary } from "@/i18n/dictionaries";

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
