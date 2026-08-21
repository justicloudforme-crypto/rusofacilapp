// No `import "server-only"` and relative (not `@/`) imports — dual-use
// module, also loaded directly by `tsx` from prisma/generate-media-
// subtitles.ts, which is a plain Node process with neither the webpack
// `server-only` shim nor tsconfig path-alias resolution. See
// youtubeCaptions.ts's file header for the same reasoning.
import type { CaptionLine } from "../video-lesson/youtubeCaptions";
import type { SubtitleLine } from "../video-lesson/types";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";

const SUBTITLES_TOOL_SCHEMA = {
  name: "emit_subtitles",
  description: "Emit the cleaned, bilingual subtitle lines.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["subtitles"],
    properties: {
      subtitles: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "start", "end", "ru", "es"],
          properties: {
            id: { type: "string" },
            start: { type: "number" },
            end: { type: "number" },
            // Russian speech in this segment, or "" if this segment is the
            // teacher's Spanish narration with no Russian in it at all.
            ru: { type: "string" },
            // The teacher's own Spanish explanation (verbatim, cleaned up)
            // when `ru` is "", OR the natural Spanish translation of `ru`
            // when this segment IS Russian speech. NEVER empty, for either
            // case — minLength enforces this structurally rather than
            // relying on the prompt alone (a real, confirmed failure: one
            // video's opening line had `ru` set correctly but `es` left "").
            es: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
};

function buildPrompt(title: string, captions: CaptionLine[]): string {
  const transcript = captions
    .map((line) => `[${line.start.toFixed(1)}-${line.end.toFixed(1)}] ${line.text}`)
    .join("\n");

  return `Eres un metodólogo de ruso como lengua extranjera para hispanohablantes, encargado de preparar subtítulos que se publicarán de forma PERMANENTE (no se van a revisar automáticamente después) para un video educativo de gramática.

Te doy la transcripción automática (con marcas de tiempo en segundos) de un fragmento de un video titulado "${title || "desconocido"}". Es un profesor hispanohablante que EXPLICA gramática rusa EN ESPAÑOL y pronuncia ejemplos EN RUSO — la transcripción cruda mezcla ambos idiomas sin distinguirlos.

Transcripción cruda (puede tener errores de reconocimiento de voz — corrígelos si es evidente por el contexto):
"""
${transcript}
"""

REGLA ABSOLUTA 1 — fidelidad, cero invención: no inventes ni "completes" nombres, nacionalidades, cifras, lugares o cualquier otro hecho que no esté literalmente presente en la transcripción. Si una palabra o frase es ininteligible o ambigua, transcribe la mejor lectura literal posible o deja [inaudible] — NUNCA sustituyas por algo plausible inventado. Esto es más importante que sonar fluido.

REGLA ABSOLUTA 2 — cobertura bilingüe completa, no se pierde nada: el objetivo es que un estudiante pueda leer TODA la clase en texto (la explicación en español Y los ejemplos en ruso), no solo fragmentos rusos sueltos sin contexto. Recorre el video de principio a fin y construye una línea de subtítulo por cada segmento de habla, alternando según el idioma real:
  - Segmento hablado en RUSO (ejemplo, palabra, frase) → "ru" = el ruso limpio, "es" = su traducción natural al español.
  - Segmento hablado en ESPAÑOL (la explicación/narración del profesor) → "ru" = "" (cadena vacía), "es" = ese español tal cual lo dijo, limpiado (NO es una traducción — es el contenido real de la explicación).
  - Agrupa fragmentos crudos consecutivos del MISMO idioma en una frase natural completa en vez de una línea por cada palabra suelta — pero no mezcles español y ruso dentro de la misma línea.
  - NUNCA pongas texto en español dentro del campo "ru", bajo ninguna circunstancia.
  - NUNCA hagas lo contrario tampoco: si un segmento está hablado en RUSO, jamás pongas ese ruso dentro de "es" (ni con una anotación tipo "(Traducción: ...)" pegada) dejando "ru" vacío. Un segmento en ruso SIEMPRE va en "ru" con su traducción real en "es" — nunca al revés, ni siquiera en la primera línea del video (el saludo/presentación inicial del profesor también puede empezar en ruso).

Llama a la herramienta emit_subtitles con la lista de líneas de subtítulos resultante: cubre TODO este fragmento de principio a fin (tanto la narración en español como los ejemplos en ruso), sin omitir ninguna parte del contenido real. Conserva start/end en segundos de la transcripción cruda correspondiente.`;
}

// A proportional "did the last subtitle's timestamp reach near the chunk's
// end" heuristic used to guard against truncation here — but that heuristic
// assumed every raw caption line should produce a subtitle line 1:1, which
// stopped being true once the prompt started deliberately DROPPING
// Spanish-narration-only fragments (see REGLA ABSOLUTA 2 above): a
// perfectly correct, complete generation can legitimately end well before
// the chunk's raw caption end if the tail of the chunk is all Spanish
// narration with no more Russian speech. The real, unambiguous signal for
// "Claude stopped mid-generation because it ran out of tokens" is the
// API's own `stop_reason` field — checked in generateChunk below instead.

// Long videos (grammar lectures can run 20-40+ minutes) were being sent to
// Claude as a single call, which either got truncated by max_tokens or, in
// the web route, killed outright by Vercel's platform-level wall-clock
// limit before max_tokens was ever reached — see the file header comment
// history / rusofasil_media session notes. Splitting the raw transcript
// into independent chunks and generating each one separately removes both
// failure modes: each chunk is small enough to comfortably finish well
// under any single-call limit, and this only ever runs from the local CLI
// script now (prisma/generate-media-subtitles.ts), so there's no overall
// wall-clock ceiling across chunks either. Chunked at caption-LINE
// boundaries (never mid-line) so a sentence is never split across a chunk
// boundary in a way that loses context.
const MAX_CHARS_PER_CHUNK = 6000;

function chunkCaptions(captions: CaptionLine[]): CaptionLine[][] {
  const chunks: CaptionLine[][] = [];
  let current: CaptionLine[] = [];
  let currentChars = 0;

  for (const line of captions) {
    const lineChars = line.text.length;
    if (current.length > 0 && currentChars + lineChars > MAX_CHARS_PER_CHUNK) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(line);
    currentChars += lineChars;
  }
  if (current.length > 0) chunks.push(current);

  return chunks;
}

async function generateChunk(title: string, captions: CaptionLine[], apiKey: string): Promise<SubtitleLine[]> {
  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      // A single subtitle line costs ~4 JSON fields (id/start/end/ru/es);
      // 32000 covers even the largest single chunk (MAX_CHARS_PER_CHUNK)
      // with plenty of room to spare — chunking is what actually
      // guarantees completion for long videos, this is just a ceiling
      // that should never realistically be hit per chunk.
      max_tokens: 32000,
      tools: [SUBTITLES_TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "emit_subtitles" },
      messages: [{ role: "user", content: buildPrompt(title, captions) }],
    }),
    signal: AbortSignal.timeout(350_000),
  });

  if (!response.ok) {
    throw new Error(`anthropic_error_${response.status}`);
  }

  // A dropped/truncated connection can leave `response.ok` true but the body
  // empty or cut short — parse defensively instead of letting JSON.parse
  // throw a raw "Unexpected end of JSON input" past this function.
  const rawBody = await response.text();
  let data: { content?: { type: string }[]; stop_reason?: string };
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error("claude_invalid_response");
  }

  // The unambiguous truncation signal: Claude ran out of max_tokens mid
  // tool-call. Checked BEFORE trying to read the (likely malformed/partial)
  // tool input at all.
  if (data.stop_reason === "max_tokens") {
    throw new Error("incomplete_subtitles");
  }

  const toolUse = (data.content ?? []).find(
    (block: { type: string }) => block.type === "tool_use",
  ) as { input?: { subtitles?: SubtitleLine[] } } | undefined;

  if (!toolUse?.input?.subtitles) {
    throw new Error("no_tool_output");
  }

  assertNoMalformedLines(toolUse.input.subtitles);
  return toolUse.input.subtitles;
}

const CYRILLIC = /[а-яА-ЯёЁ]/;

/**
 * Catches two real, confirmed failure modes the prompt alone didn't
 * prevent — both on the SAME tricky opening line (a 13-second continuous
 * self-introduction) across two separate generations of the same video:
 * (1) Claude put the actual Russian speech INTO the "es" field with a
 * "(Traducción: ...)" annotation appended, leaving "ru" empty — backwards
 * from the schema. (2) On the next attempt, "ru" was correctly filled but
 * "es" was left empty (no translation at all) — the tool schema's own
 * `minLength: 1` on "es" should prevent this going forward, but this
 * check stays as a second, independent layer. A prompt instruction is not
 * a guarantee, so both are enforced in code: fail the whole chunk loudly
 * rather than silently save a known-bad line. The chunk-level withRetry
 * in prisma/generate-media-subtitles.ts will simply try again.
 */
function assertNoMalformedLines(subtitles: SubtitleLine[]): void {
  for (const line of subtitles) {
    const isNarrationOnly = line.ru.trim().length === 0;

    if (isNarrationOnly) {
      const cyrillicChars = (line.es.match(CYRILLIC) ?? []).length;
      const looksLikeMisplacedRussian = cyrillicChars > line.es.length * 0.2;
      const hasTranslationAnnotation = /\(traducci[oó]n/i.test(line.es);
      if (looksLikeMisplacedRussian || hasTranslationAnnotation) {
        throw new Error("malformed_bilingual_line");
      }
    } else if (line.es.trim().length === 0) {
      throw new Error("malformed_bilingual_line");
    }
  }
}

export async function generateSubtitlesWithClaude({
  title,
  captions,
}: {
  title: string;
  captions: CaptionLine[];
}): Promise<SubtitleLine[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("missing_api_key");
  }

  const chunks = chunkCaptions(captions);
  const allSubtitles: SubtitleLine[] = [];
  for (const chunk of chunks) {
    const chunkSubtitles = await generateChunk(title, chunk, apiKey);
    allSubtitles.push(...chunkSubtitles);
  }

  // Claude assigns ids independently per chunk, so the same id (e.g. "1")
  // can legitimately appear in two different chunks' output — re-key
  // sequentially across the FULL concatenated result so every id is
  // globally unique (SubtitleTrack/MediaLiveCaption use `id` as a React
  // key and as the DOM data-line-id lookup for the active-line scroll —
  // a collision there breaks both).
  return allSubtitles.map((line, index) => ({ ...line, id: `line-${index}` }));
}
