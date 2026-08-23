/**
 * The single sanitizer every text-to-speech call site in the app must run
 * text through before handing it to a synthesizer — the browser's
 * SpeechSynthesisUtterance (SpeakButton, StoryText's read-aloud player) and
 * the server-side OpenAI TTS script (prisma/generate-story-audio.ts) alike.
 * Plain TS with no browser/Next.js-specific imports, so it's importable
 * from both client components and standalone Node scripts.
 *
 * Strips:
 *  - literal two-character escape sequences (\n, \t, \r, \", \') that leak
 *    in from JSON-stored content that got double-encoded somewhere along
 *    the way — unescaped to their intended meaning (a space, or the plain
 *    quote) rather than just deleting the backslash, which would otherwise
 *    leave a stray "n"/"t"/"r" letter behind for the synthesizer to read.
 *    Repeated up to 3 passes so a double- or triple-escaped string (e.g.
 *    "\\\\n" surviving two rounds of JSON.stringify) still ends up clean,
 *    not just one layer peeled off.
 *  - any backslash that's left over after that (one with no letter after
 *    it, or one from a pattern this function doesn't specifically know
 *    about) — every synthesizer this app uses will otherwise either read
 *    the character aloud as "backslash" or glitch on it.
 *  - every quote-mark character, of any style: Russian guillemets « »,
 *    "curly"/typographic quotes “ ” ‘ ’ and low-9 „ ‟ ‚ ‛, and plain
 *    ASCII " and '. Dialogue lines in reading-comprehension texts and
 *    exam scenarios are written with «...» around each speaker's line for
 *    readability on screen, but speech engines have no concept of a quote
 *    mark — they either read it aloud as noise or glitch on it, so every
 *    style gets removed before synthesis regardless of source formatting.
 *  - stray HTML/markup tags and Markdown emphasis/code markers (*_`~ and
 *    <...>) that can end up in admin-authored text but were never meant to
 *    be spoken.
 *  - newlines/tabs, collapsed to a single space, and any run of repeated
 *    whitespace this produces.
 */
export function sanitizeTextForTTS(text: string): string {
  let unescaped = text;
  for (let pass = 0; pass < 3; pass++) {
    const before = unescaped;
    unescaped = unescaped
      .replace(/\\[nrt]/g, " ")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\+/g, "");
    if (unescaped === before) break;
  }

  return unescaped
    .replace(/<[^>]*>/g, " ")
    .replace(/[*_`~]+/g, "")
    .replace(/[«»"'“”‘’„‟‚‛]+/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Looks up a pre-generated clip in an audioMap (see prisma/generate-lesson-
 * audio.ts, generate-exam-audio.ts, /api/lesson-audio, /api/exam-audio) by
 * the SAME sanitized text the generation script keyed it by — never by the
 * raw source text directly.
 *
 * A real, confirmed bug this fixes: every generate-*-audio.ts script
 * writes AudioAsset.text as `sanitizeTextForTTS(rawText)` (quotes/
 * newlines/backslashes stripped — see sanitizeTextForTTS above), and
 * /api/lesson-audio and /api/exam-audio key their returned map by that
 * same stored `text` column. But every consuming component was looking
 * up `audioMap[rawText]` — the ORIGINAL, unsanitized source text. For any
 * item without quotes/newlines the two strings happened to be identical,
 * so the bug was invisible; but reading-comprehension passages and
 * dialogue-style exercises are full of «guillemets» and \n line breaks,
 * so their lookups always missed and silently fell back to the browser's
 * free synthesis — looking exactly like "the professional voice isn't
 * being used" even though the correct clip was sitting in the map the
 * whole time, just under a different key.
 */
export function lookupAudio(audioMap: Record<string, string> | undefined, rawText: string): string | undefined {
  return audioMap?.[sanitizeTextForTTS(rawText)];
}
