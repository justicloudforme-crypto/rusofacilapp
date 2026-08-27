"use client";

import { useMemo, useState } from "react";

interface Issue {
  type: string;
  severity: number;
  message: string;
}

interface Row {
  key: string;
  storyId: string;
  storyTitle: string;
  storyLevel: string;
  itemKey: string;
  text: string;
  audioUrl: string;
  voice: string;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  issues: Issue[];
  maxSeverity: number;
  decision: "ok" | "regenerate" | null;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "?";
  if (bytes < 1024) return `${bytes} Б`;
  return `${(bytes / 1024).toFixed(0)} КБ`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "?";
  return `${seconds.toFixed(1)} сек`;
}

export default function AudioReviewTable({ lang, rows: initialRows }: { lang: string; rows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [hideDecided, setHideDecided] = useState(false);

  const stats = useMemo(() => {
    const total = rows.length;
    const reviewed = rows.filter((r) => r.decision !== null).length;
    const forRegen = rows.filter((r) => r.decision === "regenerate").length;
    return { total, reviewed, forRegen };
  }, [rows]);

  const visibleRows = useMemo(() => {
    const filtered = hideDecided ? rows.filter((r) => r.decision === null) : rows;
    return [...filtered].sort((a, b) => b.maxSeverity - a.maxSeverity);
  }, [rows, hideDecided]);

  async function decide(row: Row, decision: "ok" | "regenerate" | null) {
    setSavingKey(row.key);
    try {
      await fetch("/api/admin/audio-review/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, storyId: row.storyId, itemKey: row.itemKey, decision }),
      });
      setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, decision } : r)));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-foreground/10 bg-surface p-4 text-sm">
        <span>
          Всего находок: <strong>{stats.total}</strong>
        </span>
        <span>
          Проверено: <strong>{stats.reviewed}</strong> / {stats.total}
        </span>
        <span>
          На перегенерацию: <strong className="text-danger">{stats.forRegen}</strong>
        </span>
        <label className="ml-auto flex items-center gap-2">
          <input type="checkbox" checked={hideDecided} onChange={(e) => setHideDecided(e.target.checked)} />
          Скрыть уже проверенные
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {visibleRows.length === 0 && <p className="text-sm text-foreground/60">Ничего не осталось для проверки.</p>}
        {visibleRows.map((row) => (
          <div
            key={row.key}
            className={`rounded-lg border p-4 ${
              row.decision === "ok"
                ? "border-foreground/10 bg-surface opacity-60"
                : row.decision === "regenerate"
                  ? "border-danger/40 bg-danger/5"
                  : "border-foreground/10 bg-surface"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-sm font-medium">
                {row.storyTitle} ({row.storyLevel}) — фрагмент {row.itemKey}
              </div>
              <div className="text-xs text-foreground/50">
                голос: {row.voice} · {formatDuration(row.durationSeconds)} · {formatBytes(row.fileSizeBytes)}
              </div>
            </div>

            <p className="mt-2 text-sm italic text-foreground/80">«{row.text}»</p>

            <ul className="mt-2 flex flex-col gap-1">
              {row.issues.map((issue, i) => (
                <li key={i} className="text-xs text-warning">
                  ⚠ {issue.message}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <audio controls preload="none" src={row.audioUrl} className="h-8" />
              <button
                type="button"
                className={`tap rounded-full px-3 py-1 text-xs font-medium ${
                  row.decision === "ok" ? "bg-success text-white" : "border border-foreground/20"
                }`}
                disabled={savingKey === row.key}
                onClick={() => decide(row, row.decision === "ok" ? null : "ok")}
              >
                Норм
              </button>
              <button
                type="button"
                className={`tap rounded-full px-3 py-1 text-xs font-medium ${
                  row.decision === "regenerate" ? "bg-danger text-white" : "border border-foreground/20"
                }`}
                disabled={savingKey === row.key}
                onClick={() => decide(row, row.decision === "regenerate" ? null : "regenerate")}
              >
                Перегенерировать
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
