import { plural, type PluralForms } from "@/lib/plural";
import type { Locale } from "@/i18n/config";

/** The four forms of the "you've learned N of M" line printed under every
 * study mode's result panel. */
export interface LearnedProgressDict {
  /** Nothing is locked: the visitor is on Premium (or staff), so the bank
   * they can open IS the whole bank and there is no second half to say. */
  learnedProgressLabel: PluralForms; // "{known}", "{total}"
  /** Something is locked BY THE PREMIUM PLAN — the C1 slice. Names how
   * many more that plan adds. */
  learnedProgressAvailableLabel: PluralForms; // "{known}", "{total}", "{locked}"
  /** Закрыто БЕСПЛАТНОЙ ПРОБОЙ — заход 7.206. Эти слова открывает любая
   * подписка, и звать за ними в Premium было бы враньём. */
  learnedProgressSubscriptionLabel: PluralForms; // "{known}", "{total}", "{locked}"
  /** Закрыто и тем и другим — случай бесплатного аккаунта и гостя: часть
   * слов открывает подписка, часть (уровень C1) — только Premium. */
  learnedProgressBothLabel: PluralForms; // + "{premium}"
}

/**
 * Одно предложение, собранное из ЧЕТЫРЁХ чисел ответа.
 *
 * ПОЧЕМУ ЧИСЕЛ СТАЛО ЧЕТЫРЕ (заход 7.206, находка 7.204, часть 3).
 * Знаменатель раньше означал «всё, что пускает уровень», а не «всё, что
 * этот человек может открыть»: бесплатному аккаунту отдаётся проба по 10
 * карточек НА ТЕМУ, и по боевому банку 17.09.2026 это 230 слов из 5771, а
 * печаталось 4783 — число подписчика. Знаменатель теперь честный, а
 * закрытое разделено по ПРИЧИНЕ: подписка и Premium — разные покупки, и
 * называть их одним словом значит звать человека не туда.
 *
 * Правило выбора — по числам, а не по тарифу: тарифов UI не знает и знать
 * не должен, а «закрыто ноль» само по себе означает, что вторую половину
 * предложения говорить не о чем. Оттого же ни одна ветка не может
 * напечатать «и ещё 0 с Premium».
 *
 * `available` — знаменатель, и обе формы множественного числа склоняются
 * по нему: это число самого существительного («1 palabra disponible» /
 * «230 palabras disponibles»).
 */
export function learnedProgressText(
  locale: Locale,
  dict: LearnedProgressDict,
  {
    known,
    available,
    locked,
    lockedBySubscription = 0,
  }: { known: number; available: number; locked: number; lockedBySubscription?: number },
): string {
  const premiumLocked = Math.max(0, locked);
  const subscriptionLocked = Math.max(0, lockedBySubscription);

  if (premiumLocked <= 0 && subscriptionLocked <= 0) {
    return plural(locale, available, dict.learnedProgressLabel, { known, total: available });
  }
  if (subscriptionLocked <= 0) {
    return plural(locale, available, dict.learnedProgressAvailableLabel, {
      known,
      total: available,
      locked: premiumLocked,
    });
  }
  if (premiumLocked <= 0) {
    return plural(locale, available, dict.learnedProgressSubscriptionLabel, {
      known,
      total: available,
      locked: subscriptionLocked,
    });
  }
  return plural(locale, available, dict.learnedProgressBothLabel, {
    known,
    total: available,
    locked: subscriptionLocked,
    premium: premiumLocked,
  });
}
