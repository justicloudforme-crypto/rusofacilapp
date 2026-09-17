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
  /**
   * ДОСТУПНОГО НОЛЬ — три формы, и ни в одной нет дроби.
   *
   * Находка владельца 17.09.2026 (видео проверки 7.207): на уровне C1 и у
   * бесплатного аккаунта, и у доступа по коду строка печатала
   * «Llevas 0 de 0 palabras disponibles · 988 más con Premium» /
   * «Вы выучили 0 из 0 доступных · ещё 988 в Premium». Дробь с нулевым
   * знаменателем не значит НИЧЕГО: делить не на что, и «0 из 0» человек
   * читает как «тут пусто» — тот же класс, что убран в 7.204.
   *
   * Правда здесь другая и она произносится словами: на этом разрезе вам
   * не открыто ни одного слова, а закрытое названо числом и ПРИЧИНОЙ, как
   * и в четырёх шаблонах выше.
   */
  learnedProgressNonePremiumLabel: PluralForms; // "{locked}"
  learnedProgressNoneSubscriptionLabel: PluralForms; // "{locked}"
  learnedProgressNoneBothLabel: PluralForms; // "{locked}", "{premium}"
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

  /**
   * НУЛЕВОГО ЗНАМЕНАТЕЛЯ НА ЭКРАНЕ НЕ БЫВАЕТ (находка 17.09.2026).
   *
   * Ветка стоит ПЕРВОЙ намеренно: все четыре шаблона ниже печатают дробь
   * «{known} из {total}», и при `available = 0` она вырождается в «0 из
   * 0» при любой причине закрытого. Условие смотрит на ЗНАМЕНАТЕЛЬ, а не
   * на тариф: тарифов эта функция не знает и знать не должна.
   *
   * Пустая строка, когда закрытого нет вовсе: доступного ноль и закрытого
   * ноль означает, что под этим разрезом в банке нет ни строки — сказать
   * про него нечего, и «0 из 0» было бы единственным, что тут можно
   * соврать. Вызывающие такую строку не рисуют.
   */
  if (available <= 0) {
    if (premiumLocked > 0 && subscriptionLocked > 0) {
      return plural(locale, subscriptionLocked, dict.learnedProgressNoneBothLabel, {
        locked: subscriptionLocked,
        premium: premiumLocked,
      });
    }
    if (premiumLocked > 0) {
      return plural(locale, premiumLocked, dict.learnedProgressNonePremiumLabel, { locked: premiumLocked });
    }
    if (subscriptionLocked > 0) {
      return plural(locale, subscriptionLocked, dict.learnedProgressNoneSubscriptionLabel, {
        locked: subscriptionLocked,
      });
    }
    return "";
  }

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
