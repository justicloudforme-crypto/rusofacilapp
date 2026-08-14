import "server-only";
import type { CaptionLine } from "./youtubeCaptions";
import type { VideoLessonData } from "./types";
import { partOfSpeechValues } from "./types";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";

const PART_OF_SPEECH_ENUM = [...partOfSpeechValues];

// JSON Schema for the VideoLessonData shape (src/lib/video-lesson/types.ts),
// passed as a forced tool call so Claude's response is always valid JSON
// matching this structure rather than free-form text we'd have to parse.
const LESSON_TOOL_SCHEMA = {
  name: "emit_lesson",
  description: "Emit the complete video lesson as structured data.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "id",
      "title",
      "youtubeVideoId",
      "level",
      "subtitles",
      "glossary",
      "historicalContext",
      "vocabulary",
      "quiz",
    ],
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      youtubeVideoId: { type: "string" },
      level: { type: "string", enum: ["A1", "A2", "B1", "B2"] },
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
            ru: { type: "string" },
            es: { type: "string" },
          },
        },
      },
      glossary: {
        type: "object",
        description:
          "Keyed by the normalized (lowercase, no punctuation) Russian word as it appears in `subtitles`.",
        additionalProperties: {
          type: "object",
          additionalProperties: false,
          required: ["lemma", "translation", "partOfSpeech"],
          properties: {
            lemma: { type: "string" },
            translation: { type: "string" },
            partOfSpeech: { type: "string", enum: PART_OF_SPEECH_ENUM },
            grammarNote: { type: "string" },
          },
        },
      },
      historicalContext: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "bodyEs"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            bodyEs: { type: "string", description: "Paragraphs separated by \\n\\n, in Spanish." },
          },
        },
      },
      vocabulary: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "word", "translation", "partOfSpeech", "exampleRu", "exampleEs"],
          properties: {
            id: { type: "string" },
            word: { type: "string" },
            translation: { type: "string" },
            partOfSpeech: { type: "string", enum: PART_OF_SPEECH_ENUM },
            exampleRu: { type: "string" },
            exampleEs: { type: "string" },
          },
        },
      },
      quiz: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "section", "prompt", "options", "correctOptionId"],
          properties: {
            id: { type: "string" },
            section: { type: "string", enum: ["contexto", "vocabulario"] },
            prompt: { type: "string" },
            options: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "text"],
                properties: { id: { type: "string" }, text: { type: "string" } },
              },
            },
            correctOptionId: { type: "string" },
            explanationEs: { type: "string" },
          },
        },
      },
    },
  },
};

function buildPrompt(videoId: string, title: string, level: string, captions: CaptionLine[]): string {
  const transcript = captions
    .map((line) => `[${line.start.toFixed(1)}-${line.end.toFixed(1)}] ${line.text}`)
    .join("\n");

  return `Eres un metodólogo de ruso como lengua extranjera (RKI) para hispanohablantes.

Te doy la transcripción automática en ruso (con marcas de tiempo en segundos) de un video de YouTube (id: ${videoId}, título aproximado: "${title || "desconocido"}", nivel objetivo: ${level}).

Transcripción cruda (puede tener errores de reconocimiento de voz — corrígelos si es evidente):
"""
${transcript}
"""

Genera la lección completa llamando a la herramienta emit_lesson:
- subtitles: cubre TODA la transcripción de principio a fin, sin omitir ni resumir ninguna parte — el último "end" de "subtitles" debe llegar hasta aproximadamente ${captions[captions.length - 1]?.end.toFixed(1) ?? "?"} segundos (el final de la transcripción cruda). No te detengas después de las primeras frases. Limpia y agrupa las líneas crudas en frases naturales (conserva start/end en segundos, redondeados razonablemente), con su traducción al español en "es". youtubeVideoId debe ser "${videoId}".
- glossary: 10-15 palabras rusas clave de la transcripción, clave = forma normalizada en minúsculas sin puntuación tal como aparece en "subtitles".
- historicalContext: 2-4 secciones en español sobre el contexto histórico/cultural del tema del video.
- vocabulary: 8-12 tarjetas con ejemplo de la transcripción real.
- quiz: 2-3 preguntas de contexto histórico + 3-4 preguntas de vocabulario, con opciones y respuesta correcta.

Todo el texto dirigido al estudiante (subtítulos es, contexto histórico, vocabulario, quiz) debe estar en español natural, no traducido literalmente palabra por palabra.`;
}

export async function generateLessonWithClaude({
  videoId,
  title,
  level,
  captions,
}: {
  videoId: string;
  title: string;
  level: string;
  captions: CaptionLine[];
}): Promise<VideoLessonData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("missing_api_key");
  }

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      // A single subtitle line costs ~4 JSON fields (id/start/end/ru/es), so
      // 16000 was getting exhausted mid-generation even for ~20min videos
      // (confirmed via stop_reason: "max_tokens" with an incomplete tool
      // call) — 32000 covers those with room to spare.
      max_tokens: 32000,
      tools: [LESSON_TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "emit_lesson" },
      messages: [{ role: "user", content: buildPrompt(videoId, title, level, captions) }],
    }),
    // Generating up to max_tokens can legitimately take several minutes for
    // long videos — this must stay above how long a full 32000-token
    // generation actually takes (~250s observed).
    signal: AbortSignal.timeout(350_000),
  });

  if (!response.ok) {
    throw new Error(`anthropic_error_${response.status}`);
  }

  // A dropped/truncated connection can leave `response.ok` true but the body
  // empty or cut short — parse defensively instead of letting JSON.parse
  // throw a raw "Unexpected end of JSON input" past this function.
  const rawBody = await response.text();
  let data: { content?: { type: string }[] };
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error("claude_invalid_response");
  }

  const toolUse = (data.content ?? []).find(
    (block: { type: string }) => block.type === "tool_use",
  ) as { input?: VideoLessonData } | undefined;

  if (!toolUse?.input) {
    throw new Error("no_tool_output");
  }

  assertFullCoverage(toolUse.input.subtitles, captions);
  return toolUse.input;
}

/**
 * Guards against Claude only transcribing the first part of a long video —
 * if the generated subtitles stop well short of where the raw captions end,
 * treat it as a failed generation rather than silently saving a partial
 * transcript (lines after the cutoff would never highlight/seek).
 */
function assertFullCoverage(subtitles: VideoLessonData["subtitles"], captions: CaptionLine[]): void {
  const captionEnd = captions[captions.length - 1]?.end ?? 0;
  const subtitlesEnd = subtitles[subtitles.length - 1]?.end ?? 0;
  if (captionEnd > 20 && subtitlesEnd < captionEnd * 0.85) {
    throw new Error("incomplete_subtitles");
  }
}
