import "server-only";
import type { CaptionLine } from "@/lib/video-lesson/youtubeCaptions";
import type { SubtitleLine } from "@/lib/video-lesson/types";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";

const SUBTITLES_TOOL_SCHEMA = {
  name: "emit_subtitles",
  description: "Emit the cleaned, translated subtitle lines.",
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
            ru: { type: "string" },
            es: { type: "string" },
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

  return `Eres un metodólogo de ruso como lengua extranjera para hispanohablantes.

Te doy la transcripción automática en ruso (con marcas de tiempo en segundos) de un video titulado "${title || "desconocido"}".

Transcripción cruda (puede tener errores de reconocimiento de voz — corrígelos si es evidente):
"""
${transcript}
"""

Llama a la herramienta emit_subtitles con la lista de líneas de subtítulos: cubre TODA la transcripción de principio a fin, sin omitir ni resumir ninguna parte — el último "end" debe llegar hasta aproximadamente ${captions[captions.length - 1]?.end.toFixed(1) ?? "?"} segundos. No te detengas después de las primeras frases. Agrupa la transcripción cruda en frases naturales (conserva start/end en segundos), y añade su traducción al español natural en "es".`;
}

/**
 * Guards against Claude only transcribing the first part of a long video —
 * if the generated subtitles stop well short of where the raw captions end,
 * treat it as a failed generation rather than silently saving a partial
 * transcript.
 */
function assertFullCoverage(subtitles: SubtitleLine[], captions: CaptionLine[]): void {
  const captionEnd = captions[captions.length - 1]?.end ?? 0;
  const subtitlesEnd = subtitles[subtitles.length - 1]?.end ?? 0;
  if (captionEnd > 20 && subtitlesEnd < captionEnd * 0.85) {
    throw new Error("incomplete_subtitles");
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
      tools: [SUBTITLES_TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "emit_subtitles" },
      messages: [{ role: "user", content: buildPrompt(title, captions) }],
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
  ) as { input?: { subtitles?: SubtitleLine[] } } | undefined;

  if (!toolUse?.input?.subtitles) {
    throw new Error("no_tool_output");
  }

  assertFullCoverage(toolUse.input.subtitles, captions);
  return toolUse.input.subtitles;
}
