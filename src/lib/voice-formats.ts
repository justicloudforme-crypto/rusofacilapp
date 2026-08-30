/**
 * What a browser actually records, and what to call the clip afterwards.
 *
 * The whole voice pipeline used to say `audio/webm` in four places — the
 * Blob built in VoiceRecorder, the `.webm` filename in the upload route,
 * the `contentType` handed to Vercel Blob, and the fallback when reading
 * one back. Three of the four were guesses, and on iOS Safari all four
 * were wrong: MediaRecorder there produces **audio/mp4** (AAC) and cannot
 * produce WebM at all. Labelling MP4 bytes as WebM is what made the
 * student's own recording refuse to decode: the native <audio> element
 * dropped its controls and rendered its own error text — in the language
 * of the phone, which is why a Spanish block showed a Russian "Ошибка"
 * next to the Spanish "Tu grabación".
 *
 * Two of those four places no longer exist: since 30.08.2026 a recording
 * is never uploaded and never stored in the cloud (see
 * src/lib/voice-recordings-store.ts). The rule survives them, and is if
 * anything more load-bearing now — the type the recorder reports is what
 * gets written to IndexedDB and what the <audio> element is handed after a
 * reload, so a wrong label breaks playback on the device that recorded it.
 *
 * So the format is chosen once, carried with the data, and never assumed.
 */

/**
 * Offered to MediaRecorder in order. Opus in WebM is the best of these
 * (small, and what Chrome/Firefox/Android give anyway); `audio/mp4` is
 * what Safari — desktop and iOS — supports and nothing else does. Falling
 * off the end means "let the browser pick", which is the only correct
 * answer on a browser that supports none of the named types, and is also
 * what the code did before by accident.
 */
export const PREFERRED_RECORDING_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

/**
 * The formats this app knows how to name, and the extension each one gets.
 * Used for the name a clip is offered under and for reading a legacy
 * filename back — never to decide what a recording *is*, which only the
 * recorder can say.
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
 * what MediaRecorder reports and never part of what a store needs. */
export function baseMimeType(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

/** The extension to name a recording with, or null if this is not a format
 * we know. Null is a rejection, not a default: silently calling an unknown
 * type `.webm` is the bug this module exists to end. */
export function voiceExtensionFor(mimeType: string): string | null {
  return VOICE_MIME_TO_EXTENSION[baseMimeType(mimeType)] ?? null;
}

/** The type a file of this name holds, or null — never a guess. Reads a
 * legacy `VoiceSubmission.audioUrl` (the pre-30.08.2026 rows still in the
 * database, see scripts/delete-cloud-voice-recordings.mjs) and survives a
 * Blob URL's query string. */
export function voiceMimeFromNameIfKnown(nameOrUrl: string): string | null {
  const withoutQuery = nameOrUrl.split("?")[0];
  const ext = withoutQuery.slice(withoutQuery.lastIndexOf(".") + 1).toLowerCase();
  return EXTENSION_TO_MIME[ext] ?? null;
}
