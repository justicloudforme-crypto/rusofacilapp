"use client";

import { useState } from "react";

interface Row {
  id: string;
  title: string;
  embedStatus: "ok" | "blocked" | "unchecked";
  lastCheckedAt?: string;
}

type CheckState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; ok: number; broken: number; checkFailed: number }
  | { kind: "error"; message: string };

const ERROR_MESSAGES: Record<string, string> = {
  missing_api_key: "Falta configurar YOUTUBE_API_KEY en el servidor (ver .env.example).",
};

export default function MediaEmbedStatusPanel({ rows: initialRows }: { rows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [state, setState] = useState<CheckState>({ kind: "idle" });

  const brokenRows = rows.filter((r) => r.embedStatus === "blocked");

  async function checkAll() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/admin/media/check-embeds", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: ERROR_MESSAGES[data.error] ?? `Error inesperado (${data.error}).` });
        return;
      }
      const byId = new Map<string, { outcome: string }>(
        (data.results as { id: string; outcome: string }[]).map((r) => [r.id, r]),
      );
      setRows((prev) =>
        prev.map((row) => {
          const result = byId.get(row.id);
          if (!result) return row;
          const embedStatus: Row["embedStatus"] =
            result.outcome === "ok" ? "ok" : result.outcome === "check_failed" ? row.embedStatus : "blocked";
          return { ...row, embedStatus, lastCheckedAt: new Date().toISOString().slice(0, 10) };
        }),
      );
      setState({ kind: "done", ok: data.ok, broken: data.broken, checkFailed: data.checkFailed });
    } catch {
      setState({ kind: "error", message: "No se pudo conectar con el servidor." });
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={checkAll}
          disabled={state.kind === "loading"}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state.kind === "loading" ? "Verificando…" : `Verificar enlaces de YouTube (${rows.length})`}
        </button>
        {state.kind === "loading" && (
          <span className="text-xs text-foreground/50">Consultando la YouTube Data API…</span>
        )}
        {state.kind === "done" && (
          <span className="text-xs font-medium text-foreground/70">
            {state.ok} OK
            {state.broken > 0 && (
              <span className="text-red-600 dark:text-red-400"> · {state.broken} rotos</span>
            )}
            {state.checkFailed > 0 && <span> · {state.checkFailed} sin comprobar</span>}
          </span>
        )}
        {state.kind === "error" && (
          <span className="text-xs font-medium text-red-600 dark:text-red-400">{state.message}</span>
        )}
      </div>

      {brokenRows.length === 0 ? (
        <p className="text-sm text-foreground/50">
          Ningún video marcado como roto en la última comprobación.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-red-500/20 bg-red-500/[.03]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-red-500/10 text-left text-xs font-semibold uppercase tracking-wide text-foreground/50">
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Título</th>
                <th className="px-4 py-2">Última comprobación</th>
              </tr>
            </thead>
            <tbody>
              {brokenRows.map((row) => (
                <tr key={row.id} className="border-b border-red-500/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs">{row.id}</td>
                  <td className="px-4 py-2.5">{row.title}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground/50">{row.lastCheckedAt ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
