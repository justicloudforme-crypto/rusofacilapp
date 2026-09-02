import { plural, type PluralForms } from "@/lib/plural";
import type { Locale } from "@/i18n/config";

/** The two forms of the "you've learned N of M" line printed under every
 * study mode's result panel. */
export interface LearnedProgressDict {
  /** Nothing is locked: the visitor is on Premium (or staff), so the bank
   * they can open IS the whole bank and there is no second half to say. */
  learnedProgressLabel: PluralForms; // "{known}", "{total}"
  /** Something is locked: the denominator is what this visitor can open,
   * and the tail names how many more the Premium plan adds. Both numbers
   * come from the API — see PROGRESS.md 7.76 for why printing only the
   * first one would be its own untruth. */
  learnedProgressAvailableLabel: PluralForms; // "{known}", "{total}", "{locked}"
}

/**
 * One sentence, built from the API's two numbers.
 *
 * The rule is `locked === 0`, not "is this visitor premium": the UI never
 * has to know about tiers, and a future third tier, a promotional unlock,
 * or a bank that simply has no C1 cards at all all fall out correctly —
 * nothing is locked, so nothing is mentioned. It also means the short
 * sentence can never render as "and 0 more with Premium".
 *
 * `available` is the denominator, never the whole bank. Both plural forms
 * inflect with it, not with `known`: it is the noun's number ("1 palabra
 * disponible" / "4787 palabras disponibles").
 */
export function learnedProgressText(
  locale: Locale,
  dict: LearnedProgressDict,
  { known, available, locked }: { known: number; available: number; locked: number },
): string {
  if (locked <= 0) {
    return plural(locale, available, dict.learnedProgressLabel, { known, total: available });
  }
  return plural(locale, available, dict.learnedProgressAvailableLabel, {
    known,
    total: available,
    locked,
  });
}
