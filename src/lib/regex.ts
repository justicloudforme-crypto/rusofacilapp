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
 * `[...]` is a silently wrong match rather than a thrown error.
 *
 * `-` is escaped as `\x2d`, not as `\-`, and that detail is the whole point
 * of incident №1 (29.08.2026). Under the `u` flag a backslash may only
 * precede a character the spec actually lists; `-` is not one of them
 * outside a character class, so `\-` is an *invalid escape* and the whole
 * `new RegExp(...)` throws at construction. Without `u` it is accepted and
 * means the same thing, which is why this survived from the initial commit:
 * every unit test of this function used the default flags.
 *
 * What it cost. Three of the 119 glossary terms in production contain a
 * hyphen — "oración indefinido-personal", "verbo reflexivo (con -ся)",
 * "«-то» frente a «-нибудь»". GlossaryText builds ONE alternation over all
 * 119 with flags "giu", so any one of them poisoned the whole pattern, and
 * with it every page that auto-links glossary terms: all 240 lesson pages
 * in both locales rendered nothing but "Something went wrong". Every one of
 * them answered HTTP 200 with complete, correct HTML the entire time — the
 * failure was in the browser, after hydration, which is why an anonymous
 * crawl of 1908 URLs reported them all healthy.
 *
 * `\x2d` is a hex escape: valid under both flag sets, and valid inside a
 * character class too, so it keeps the range-injection protection above.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/-/g, "\\x2d");
}
