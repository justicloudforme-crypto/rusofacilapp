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

/** The only ASCII characters that can never carry syntax in a pattern. */
const INERT_ASCII = /[A-Za-z0-9_]/;

/** Non-ASCII whitespace and line separators. Legal unescaped, but a
 * pattern is also a string that gets logged and diffed, and U+2028/U+2029
 * inside one are worth seeing rather than losing to a line break. */
const NEEDS_UNICODE_ESCAPE = /\s/u;

/** Escapes `value` so it matches itself literally, under every flag set
 * this codebase uses or might use — no flags, `u`, `v` — and both inside
 * and outside a character class.
 *
 * **Why a whitelist and not a list of metacharacters.** The blacklist form
 * (`value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`) has now been wrong
 * twice, and both times the wrongness was invisible until a specific row
 * reached production:
 *
 *  - `-` was added to the class, which emits `\-`. Valid with no flags,
 *    an **invalid escape** under `u`, so `new RegExp` throws at
 *    construction. That is incident №1 (29.08.2026): three glossary terms
 *    with a hyphen took all 120 lessons in both locales — 240 URLs — down
 *    to "Something went wrong", every one of them still answering HTTP 200
 *    with complete HTML.
 *  - The fix for it (`-` → `\x2d`) is correct under `u` but still leaves
 *    `/` unescaped, which is a **reserved** character inside a class under
 *    the `v` flag, and leaves ASCII double punctuators (`&&`, `::`, `~~`,
 *    `<<`…) intact, which `v` also rejects inside a class. Measured, not
 *    assumed: see regex.test.ts.
 *
 * A blacklist asks "which characters are special?", and the answer changes
 * with the flag set and with each edition of the specification. A
 * whitelist asks "which characters are provably inert?", and that answer
 * does not change. So: ASCII letters, digits and `_` pass through, and
 * **every other ASCII character** becomes a hex escape — `\x` plus two
 * digits — which is legal in every flag set, in and out of a class, and
 * cannot combine with a neighbour into a range or a double punctuator.
 * Non-ASCII characters are literal everywhere and are left as they are, so
 * that «чем... тем...», `-ся` and `señor` still read as themselves in a
 * pattern one has to debug by eye; the two exceptions are non-ASCII
 * whitespace and lone surrogates, which are escaped by code point because
 * a pattern is also a string that gets logged, concatenated and compared.
 *
 * This is the same rule as the ES2025 `RegExp.escape`. It is spelled out
 * here rather than delegated to it, because the output must be identical
 * on every runtime this pattern can be built on — Node on the server, and
 * whatever browser a student happens to bring — and `RegExp.escape` is not
 * in all of them yet. */
export function escapeRegExp(value: string): string {
  let out = "";
  for (const char of value) {
    const codePoint = char.codePointAt(0) as number;
    if (codePoint < 0x80) {
      out += INERT_ASCII.test(char) ? char : "\\x" + codePoint.toString(16).padStart(2, "0");
    } else if (NEEDS_UNICODE_ESCAPE.test(char) || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      out += "\\u" + codePoint.toString(16).padStart(4, "0");
    } else {
      out += char;
    }
  }
  return out;
}
