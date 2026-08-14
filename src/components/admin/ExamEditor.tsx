"use client";

import { useState } from "react";
import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";

type ExamsDict = Dictionary["admin"]["exams"];

export default function ExamEditor({
  lang,
  level,
  examSlug,
  hasCustomVersion,
  initialValue,
  templateValue,
  dict,
}: {
  lang: string;
  level: string;
  examSlug: string;
  hasCustomVersion: boolean;
  initialValue: string;
  templateValue: string;
  dict: ExamsDict;
}) {
  const [value, setValue] = useState(initialValue);
  const [customExists, setCustomExists] = useState(hasCustomVersion);
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "saving" | "deleting" } | { kind: "error"; message: string } | { kind: "saved" } | { kind: "deleted" }
  >({ kind: "idle" });

  async function handleSave() {
    setStatus({ kind: "saving" });
    try {
      JSON.parse(value || "{}");
    } catch {
      setStatus({ kind: "error", message: dict.invalidJson });
      return;
    }
    try {
      const res = await fetch("/api/admin/exams/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, examSlug, contentJson: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error === "invalid_json" ? dict.invalidJson : data.error });
        return;
      }
      setCustomExists(true);
      setStatus({ kind: "saved" });
    } catch {
      setStatus({ kind: "error", message: dict.invalidJson });
    }
  }

  async function handleDelete() {
    setStatus({ kind: "deleting" });
    const res = await fetch("/api/admin/exams/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, examSlug }),
    });
    if (!res.ok) {
      setStatus({ kind: "error", message: dict.invalidJson });
      return;
    }
    setCustomExists(false);
    setStatus({ kind: "deleted" });
  }

  return (
    <div>
      <Link
        href={`/${lang}/admin/exams`}
        className="text-sm font-medium text-foreground/60 hover:text-foreground"
      >
        ← {dict.backToList}
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
            {level} · {examSlug}
          </span>
        </div>
        <a
          href={`/${lang}/courses/${level}/exam/${examSlug}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-foreground/70 hover:text-foreground"
        >
          {dict.viewLive} ↗
        </a>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <label htmlFor="content-json" className="text-sm font-medium">
          {dict.contentJsonLabel}
        </label>
        <button
          type="button"
          onClick={() => setValue(templateValue)}
          className="text-xs font-medium text-foreground/60 underline hover:text-foreground"
        >
          {dict.loadExampleButton}
        </button>
      </div>
      <p className="mt-1 text-xs text-foreground/50">{dict.contentJsonHelp}</p>

      <textarea
        id="content-json"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        spellCheck={false}
        rows={28}
        className="mt-2 w-full rounded-xl border border-black/15 bg-transparent p-3 font-mono text-xs leading-5 outline-none focus:border-foreground/50 dark:border-white/20"
      />

      {status.kind === "error" && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {status.message}
        </p>
      )}
      {status.kind === "saved" && (
        <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          {dict.savedNotice}
        </p>
      )}
      {status.kind === "deleted" && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
          {dict.deletedNotice}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={status.kind === "saving"}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 disabled:opacity-50"
        >
          {dict.saveButton}
        </button>
        {customExists && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={status.kind === "deleting"}
            className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[.06]"
          >
            {dict.deleteButton}
          </button>
        )}
      </div>
      {customExists && <p className="mt-2 text-xs text-foreground/50">{dict.deleteHint}</p>}
    </div>
  );
}
