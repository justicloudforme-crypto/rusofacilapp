import type { Locale } from "@/i18n/config";

// Picking the right form of a noun for the number standing next to it.
//
// The defect this exists for: the profile tiles printed "3 дней", "4 дней"
// and "3 слов изучено" — the genitive plural for every count, because each
// of those strings was ONE string in the dictionary and a number was simply
// concatenated in front of it. Spanish had the mirror of the same thing
// ("1 días").
//
// Two languages, two rules, and they are not the same shape:
//
//   Spanish — two forms. 1 is singular, everything else (0 included) plural.
//   Russian — three forms, chosen by the LAST digits, not by the value:
//     · ends in 1, but not in 11        → 1 день,  21 день,  101 день
//     · ends in 2-4, but not in 12-14   → 2 дня,   23 дня,   104 дня
//     · everything else                 → 5 дней, 11 дней, 25 дней, 0 дней
//
//   The teens are the whole trap: 11, 12, 13, 14 take the "many" form even
//   though 1, 2, 3, 4 do not, so any implementation that looks only at
//   `n % 10` is wrong on exactly those four numbers out of every hundred —
//   which is why the test walks 0, 1, 2, 3, 4, 5, 11, 21, 101.
//
// Both dictionaries carry all three keys so the two files keep the same key
// set (src/lib/dictionary-parity.test.ts requires it). Spanish never reads
// `few`; the plural test asserts that every Spanish `few` equals its `many`,
// so a translator inventing a Spanish "few" form is caught rather than
// silently ignored. Where a locale genuinely does not inflect — a Russian
// short neuter form like "усвоено", a label written as "noun: number" — all
// three forms are the same string on purpose, and the test pins that too.

/** The three CLDR categories this project needs. Spanish uses `one` and
 * `many`; Russian uses all three. */
export interface PluralForms {
  one: string;
  few: string;
  many: string;
}

/** True when `value` has the shape of a plural-form group rather than a
 * plain string. Used by the dictionary tests, and by nothing at runtime —
 * every call site knows statically which of the two it is holding. */
export function isPluralForms(value: unknown): value is PluralForms {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PluralForms).one === "string" &&
    typeof (value as PluralForms).few === "string" &&
    typeof (value as PluralForms).many === "string"
  );
}

/** The form of `forms` that belongs with `count` in `locale`.
 *
 * `count` is taken by absolute value and non-integers fall to the plural
 * form: neither can reach these call sites today (every count here is a row
 * count), but a negative or fractional number must pick SOME form rather
 * than fall off the end of the rule. */
export function pluralForm(locale: Locale, count: number, forms: PluralForms): string {
  const n = Math.abs(count);
  if (!Number.isInteger(n)) return forms.many;

  if (locale === "es") return n === 1 ? forms.one : forms.many;

  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms.one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms.few;
  return forms.many;
}

/** The form for `count` with every placeholder filled in.
 *
 * Most of these strings carry the number themselves ("{count} palabras");
 * a few are bare units printed next to a number by the JSX ("días"), and
 * for those `vars` is simply empty and this returns the unit alone. */
export function plural(
  locale: Locale,
  count: number,
  forms: PluralForms,
  vars: Record<string, string | number> = {},
): string {
  let out = pluralForm(locale, count, forms);
  for (const [name, value] of Object.entries(vars)) {
    out = out.split(`{${name}}`).join(String(value));
  }
  return out;
}
