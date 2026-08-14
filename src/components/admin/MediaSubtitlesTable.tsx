"use client";

import { useState } from "react";

interface Row {
  id: string;
  title: string;
  hasSubtitles: boolean;
}

type RowStatus = { kind: "idle" } | { kind: "loading" } | { kind: "done" } | { kind: "error"; message: string };
type BulkStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; ok: number; failed: number }
  | { kind: "error"; message: string };

const ERROR_MESSAGES: Record<string, string> = {
  missing_api_key: "Falta configurar ANTHROPIC_API_KEY en el servidor.",
  missing_ytdlp: "Falta instalar yt-dlp en el servidor (pip install yt-dlp).",
  captions_fetch_failed: "No se pudo descargar la página del video de YouTube.",
  no_russian_captions: "Este video no tiene subtítulos en ruso (ni manuales ni automáticos).",
  no_tool_output: "Claude no devolvió subtítulos válidos.",
  incomplete_subtitles:
    "Claude solo transcribió una parte del video (no llegó hasta el final). Intenta de nuevo.",
  claude_invalid_response: "La respuesta de Claude llegó incompleta o corrupta. Intenta de nuevo.",
};

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? `Error inesperado (${code}).`;
}

export default function MediaSubtitlesTable({ rows }: { rows: Row[] }) {
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [bulkStatus, setBulkStatus] = useState<BulkStatus>({ kind: "idle" });

  const pendingCount = rows.filter((row) => !(row.hasSubtitles || done[row.id])).length;

  async function generate(id: string) {
    setStatuses((prev) => ({ ...prev, [id]: { kind: "loading" } }));
    try {
      const res = await fetch("/api/admin/media/generate-subtitles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatuses((prev) => ({ ...prev, [id]: { kind: "error", message: errorMessage(data.error) } }));
        return;
      }
      setStatuses((prev) => ({ ...prev, [id]: { kind: "done" } }));
      setDone((prev) => ({ ...prev, [id]: true }));
    } catch {
      setStatuses((prev) => ({
        ...prev,
        [id]: { kind: "error", message: "No se pudo conectar con el servidor." },
      }));
    }
  }

  async function generateAll() {
    setBulkStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/admin/media/generate-all-subtitles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkStatus({ kind: "error", message: errorMessage(data.error) });
        return;
      }
      const results = data.results as { id: string; status: "generated" | "failed"; error?: string }[];
      const newDone: Record<string, boolean> = {};
      const newStatuses: Record<string, RowStatus> = {};
      for (const result of results) {
        if (result.status === "generated") {
          newDone[result.id] = true;
          newStatuses[result.id] = { kind: "done" };
        } else {
          newStatuses[result.id] = { kind: "error", message: errorMessage(result.error ?? "unknown") };
        }
      }
      setDone((prev) => ({ ...prev, ...newDone }));
      setStatuses((prev) => ({ ...prev, ...newStatuses }));
      const ok = results.filter((r) => r.status === "generated").length;
      setBulkStatus({ kind: "done", ok, failed: results.length - ok });
    } catch {
      setBulkStatus({ kind: "error", message: "No se pudo conectar con el servidor." });
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generateAll}
          disabled={bulkStatus.kind === "loading" || pendingCount === 0}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {bulkStatus.kind === "loading"
            ? "Generando para todos…"
            : `Generar subtítulos para todos los videos (${pendingCount})`}
        </button>
        {bulkStatus.kind === "loading" && (
          <span className="text-xs text-foreground/50">
            Procesa un video a la vez, puede tardar varios minutos para todo el catálogo…
          </span>
        )}
        {bulkStatus.kind === "done" && (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Listo: {bulkStatus.ok} generados{bulkStatus.failed ? `, ${bulkStatus.failed} fallaron` : ""} ✓
          </span>
        )}
        {bulkStatus.kind === "error" && (
          <span className="text-xs font-medium text-red-600 dark:text-red-400">{bulkStatus.message}</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-foreground/50 dark:border-white/10">
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Título</th>
              <th className="px-4 py-2">Subtítulos</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hasSubtitles = row.hasSubtitles || done[row.id];
              const status = statuses[row.id] ?? { kind: "idle" };
              return (
                <tr key={row.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs">{row.id}</td>
                  <td className="px-4 py-2.5">{row.title}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        hasSubtitles
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {hasSubtitles ? "Con subtítulos" : "Sin subtítulos"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!hasSubtitles && (
                      <div className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={() => generate(row.id)}
                          disabled={status.kind === "loading" || bulkStatus.kind === "loading"}
                          className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[.06]"
                        >
                          {status.kind === "loading" ? "Generando…" : "Generar subtítulos con Claude"}
                        </button>
                        {status.kind === "error" && (
                          <span className="text-xs text-red-600 dark:text-red-400">{status.message}</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
