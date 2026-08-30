/**
 * What a browser actually records, and what to call the file afterwards.
 *
 * The whole voice pipeline used to say `audio/webm` in four places — the
 * Blob built in VoiceRecorder, the `.webm` filename in the upload route,
 * the `contentType` handed to Vercel Blob, and the fallback in
 * readVoiceSubmission. Three of the four were guesses, and on iOS Safari
 * all four were wrong: MediaRecorder there produces **audio/mp4** (AAC)
 * and cannot produce WebM at all. Labelling MP4 bytes as WebM is what made
 * the student's own recording refuse to decode: the native <audio> element
 * dropped its controls and rendered its own error text — in the language
 * of the phone, which is why a Spanish block showed a Russian "Ошибка"
 * next to the Spanish "Tu grabación".
 *
 * So the format is chosen once, carried with the data, and never assumed.
 */

/**
 * Offered to MediaRecorder in order. Opus in WebM is the best of these
 * (small, and what Chrome/Firefox/Android give anyway); `audio/mp4` is
 * what Safari — desktop and iOS — supports and nothing else does. The
 * empty string at the end means "let the browser pick", which is the only
 * correct answer on a browser that supports none of the named types, and
 * is also what the code did before by accident.
 */
export const PREFERRED_RECORDING_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

/**
 * Accepted on upload, and the extension each one is stored under. The
 * extension matters because `VoiceSubmission` has no column for the MIME
 * type: adding one is a schema change, and a schema change on this project
 * is the owner's decision, not something to slip into a bug fix. The
 * filename already round-trips through the database, so it carries the
 * format for free — as long as nothing writes `.webm` over an MP4 again.
 */
export const VOICE_MIME_TO_EXTENSION: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};

const EXTENSION_TO_MIME: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  mp3: "audio/mpeg",
  aac: "audio/aac",
  wav: "audio/wav",
};

/** `audio/webm;codecs=opus` → `audio/webm`. Codec parameters are part of
 * what MediaRecorder reports and never part of what the store needs. */
export function baseMimeType(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

/** The extension to save a recording under, or null if this is not a
 * format we accept. Null is a rejection, not a default: silently storing
 * an unknown type under `.webm` is the bug this module exists to end. */
export function voiceExtensionFor(mimeType: string): string | null {
  return VOICE_MIME_TO_EXTENSION[baseMimeType(mimeType)] ?? null;
}

/**
 * The type to store an upload under: what the browser declared, or — when
 * it declared nothing — what the filename says. Some browsers hand over a
 * Blob with an empty `type`, and rejecting those would break uploads that
 * used to work. Null only when neither source names a format we accept.
 */
export function resolveUploadMime(declaredType: string, filename: string): string | null {
  const declared = baseMimeType(declaredType || "");
  if (VOICE_MIME_TO_EXTENSION[declared]) return declared;
  const fromName = voiceMimeFromUrlIfKnown(filename);
  return fromName;
}

/** Like voiceMimeFromUrl, but null instead of a guess — the upload path
 * must be able to tell "unknown" from "assume WebM". */
export function voiceMimeFromUrlIfKnown(nameOrUrl: string): string | null {
  const withoutQuery = nameOrUrl.split("?")[0];
  const ext = withoutQuery.slice(withoutQuery.lastIndexOf(".") + 1).toLowerCase();
  return EXTENSION_TO_MIME[ext] ?? null;
}

/** The content type to serve a stored recording with, read back out of its
 * filename. Falls back to `audio/webm` only for rows written before this
 * existed — every one of those really is WebM, because that is all the
 * old code could produce a correct file for. */
export function voiceMimeFromUrl(audioUrl: string): string {
  return voiceMimeFromUrlIfKnown(audioUrl) ?? "audio/webm";
}
