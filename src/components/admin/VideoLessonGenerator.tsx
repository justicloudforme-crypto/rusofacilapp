"use client";

import { useState } from "react";
import { mediaLevels } from "@/lib/media/types";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "saved" };

type SaveStatus = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

const ERROR_MESSAGES: Record<string, string> = {
  invalid_video_id: "El ID de video no parece válido (debe ser el código de 11 caracteres del enlace de YouTube).",
  invalid_level: "Nivel inválido.",
  missing_api_key: "Falta configurar ANTHROPIC_API_KEY en el servidor.",
  missing_ytdlp: "Falta instalar yt-dlp en el servidor (pip install yt-dlp).",
  captions_fetch_failed: "No se pudo descargar la página del video de YouTube.",
  no_russian_captions: "Este video no tiene subtítulos en ruso (ni manuales ni automáticos).",
  no_tool_output: "Claude no devolvió una lección válida. Intenta de nuevo.",
  incomplete_subtitles:
    "Claude solo transcribió una parte del video (no llegó hasta el final). Intenta de nuevo — a veces ayuda reintentar directamente.",
  invalid_json: "El JSON editado no es válido.",
  claude_invalid_response: "La respuesta de Claude llegó incompleta o corrupta. Intenta de nuevo.",
};

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES[code.split(":")[0]] ?? `Error inesperado (${code}).`;
}

export default function VideoLessonGenerator() {
  const [videoId, setVideoId] = useState("");
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<(typeof mediaLevels)[number]>("A2");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [resultJson, setResultJson] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setStatus({ kind: "loading" });
    setSaveStatus({ kind: "idle" });
    setCopied(false);
    try {
      const res = await fetch("/api/admin/video-lessons/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: videoId.trim(), title: title.trim(), level }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "error", message: errorMessage(data.error ?? "unknown") });
        return;
      }
      setResultJson(JSON.stringify(data.lesson, null, 2));
      setLessonId(data.lesson.id);
      setStatus({ kind: "saved" });
    } catch {
      setStatus({ kind: "error", message: "No se pudo conectar con el servidor." });
    }
  }

  async function handleSaveEdits() {
    setSaveStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/admin/video-lessons/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonJson: resultJson }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveStatus({ kind: "error", message: errorMessage(data.error ?? "unknown") });
        return;
      }
      setSaveStatus({ kind: "saved" });
    } catch {
      setSaveStatus({ kind: "error", message: "No se pudo conectar con el servidor." });
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(resultJson);
    setCopied(true);
  }

  return (
    <div>
      <p className="text-sm text-foreground/60">
        Introduce el ID de un video de YouTube con subtítulos en ruso (manuales o automáticos). El
        sistema descargará la transcripción, generará con Claude un JSON de lección completo
        (subtítulos con traducción, glosario, contexto histórico, vocabulario y cuestionario) y lo{" "}
        <strong>guardará automáticamente</strong> en{" "}
        <code className="font-mono text-xs">src/lib/video-lesson/lessons.json</code>.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="video-id" className="text-sm font-medium">
            ID del video de YouTube
          </label>
          <input
            id="video-id"
            value={videoId}
            onChange={(event) => setVideoId(event.target.value)}
            placeholder="p. ej. 9YMU2wmSj0U"
            className="mt-2 w-full rounded-xl border border-black/15 bg-transparent p-3 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
          />
        </div>
        <div>
          <label htmlFor="level" className="text-sm font-medium">
            Nivel
          </label>
          <select
            id="level"
            value={level}
            onChange={(event) => setLevel(event.target.value as (typeof mediaLevels)[number])}
            className="mt-2 w-full rounded-xl border border-black/15 bg-transparent p-3 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
          >
            {mediaLevels.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="title" className="text-sm font-medium">
          Título aproximado (opcional, ayuda al contexto histórico)
        </label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 w-full rounded-xl border border-black/15 bg-transparent p-3 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
        />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={status.kind === "loading" || !videoId.trim()}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status.kind === "loading" ? "Generando…" : "Generar y guardar con Claude"}
        </button>
        {status.kind === "loading" && (
          <span className="text-xs text-foreground/50">
            Descargando subtítulos y llamando a Claude, puede tardar hasta un minuto…
          </span>
        )}
      </div>

      {status.kind === "error" && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {status.message}
        </p>
      )}
      {status.kind === "saved" && (
        <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          Guardado como &quot;{lessonId}&quot; en lessons.json ✓
        </p>
      )}

      {resultJson && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <label htmlFor="result-json" className="text-sm font-medium">
              Lección guardada (editable)
            </label>
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs font-medium text-foreground/60 underline hover:text-foreground"
            >
              {copied ? "Copiado ✓" : "Copiar JSON"}
            </button>
          </div>
          <p className="mt-1 text-xs text-foreground/50">
            Revisa el contenido (traducciones, hechos históricos). Ya está guardado; si editas el JSON
            aquí, usa &quot;Guardar cambios&quot; para actualizar el archivo.
          </p>
          <textarea
            id="result-json"
            value={resultJson}
            onChange={(event) => setResultJson(event.target.value)}
            spellCheck={false}
            rows={24}
            className="mt-2 w-full rounded-xl border border-black/15 bg-transparent p-3 font-mono text-xs leading-5 outline-none focus:border-foreground/50 dark:border-white/20"
          />

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveEdits}
              disabled={saveStatus.kind === "saving"}
              className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[.06]"
            >
              {saveStatus.kind === "saving" ? "Guardando…" : "Guardar cambios"}
            </button>
            {saveStatus.kind === "saved" && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Cambios guardados ✓
              </span>
            )}
            {saveStatus.kind === "error" && (
              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                {saveStatus.message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
