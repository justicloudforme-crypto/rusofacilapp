/**
 * One place for building a regular expression out of runtime data.
 *
 * Why it is worth a module. Three files had their own identical copy of
 * escapeRegExp (the flashcards search route, the word-game clue matcher and
 * GlossaryText), and a fourth place — isPlausibleShortCode — interpolated
 * data into a pattern with no escaping at all and went unnoticed for
 * months, because the way it failed was silent: `"A-F"` inside a character
 * class becomes a RANGE and starts accepting `B`, `C`, `D`, `E` without any
 * error anywhere. Four copies is three chances for the next one to be
 * written without the escape.
 *
 * The rule this module exists to make easy: **anything that comes from the
 * database, a dictionary file, a URL or a person goes through escapeRegExp
 * before it is put in a pattern.** A hand-written pattern fragment does
 * not — see src/lib/story-insights.ts, whose `ru()` helper is handed real
 * regex source on purpose.
 */

/** Escapes every character with a special meaning in a regular expression,
 * so `value` matches itself literally. Covers the character-class specials
 * too (`^`, `]`, `\`, `-`), which matters because the failure mode inside
 * `[...]` is a silently wrong match rather than a thrown error. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\\-]/g, "\\$&");
}
