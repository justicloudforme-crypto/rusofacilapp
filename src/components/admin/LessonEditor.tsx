"use client";

import { useState } from "react";
import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";

type LessonsDict = Dictionary["admin"]["lessons"];

function extractVideoUrl(contentJson: string): string {
  try {
    const parsed = JSON.parse(contentJson);
    return typeof parsed?.videoUrl === "string" ? parsed.videoUrl : "";
  } catch {
    return "";
  }
}

export default function LessonEditor({
  lang,
  level,
  lessonSlug,
  lessonTitle,
  hasCustomVersion,
  initialValue,
  templateValue,
  dict,
}: {
  lang: string;
  level: string;
  lessonSlug: string;
  lessonTitle: string;
  hasCustomVersion: boolean;
  initialValue: string;
  templateValue: string;
  dict: LessonsDict;
}) {
  const [value, setValue] = useState(initialValue);
  const [videoUrl, setVideoUrl] = useState(() => extractVideoUrl(initialValue));
  const [videoMode, setVideoMode] = useState<"url" | "upload">("url");
  const [uploadStatus, setUploadStatus] = useState<
    { kind: "idle" } | { kind: "uploading" } | { kind: "error"; message: string } | { kind: "uploaded" }
  >({ kind: "idle" });
  const [customExists, setCustomExists] = useState(hasCustomVersion);
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "saving" | "deleting" } | { kind: "error"; message: string } | { kind: "saved" } | { kind: "deleted" }
  >({ kind: "idle" });

  async function handleUploadVideo(file: File) {
    setUploadStatus({ kind: "uploading" });
    try {
      const form = new FormData();
      form.append("level", level);
      form.append("lesson", lessonSlug);
      form.append("file", file);
      const res = await fetch("/api/admin/lessons/upload-video", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setUploadStatus({ kind: "error", message: dict.videoUploadError });
        return;
      }
      setVideoUrl(data.videoUrl);
      setCustomExists(true);
      setUploadStatus({ kind: "uploaded" });
    } catch {
      setUploadStatus({ kind: "error", message: dict.videoUploadError });
    }
  }

  async function handleSave() {
    setStatus({ kind: "saving" });
    let contentJson: string;
    try {
      const parsed = JSON.parse(value || "{}");
      parsed.videoUrl = videoUrl;
      contentJson = JSON.stringify(parsed, null, 2);
    } catch {
      setStatus({ kind: "error", message: dict.invalidJson });
      return;
    }
    setValue(contentJson);
    try {
      const res = await fetch("/api/admin/lessons/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, lesson: lessonSlug, contentJson }),
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
    const res = await fetch("/api/admin/lessons/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, lesson: lessonSlug }),
    });
    if (!res.ok) {
      setStatus({ kind: "error", message: "..." });
      return;
    }
    setCustomExists(false);
    setStatus({ kind: "deleted" });
  }

  return (
    <div>
      <Link
        href={`/${lang}/admin/lessons`}
        className="text-sm font-medium text-foreground/60 hover:text-foreground"
      >
        ← {dict.backToList}
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
            {level} · {dict.lesson} {lessonSlug}
          </span>
          <h2 className="mt-1 font-medium">{lessonTitle}</h2>
        </div>
        <a
          href={`/${lang}/courses/${level}/${lessonSlug}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-foreground/70 hover:text-foreground"
        >
          {dict.viewLive} ↗
        </a>
      </div>

      <div className="mt-6">
        <label className="text-sm font-medium">{dict.videoUrlLabel}</label>
        <p className="mt-1 text-xs text-foreground/50">{dict.videoUrlHelp}</p>

        <div className="mt-2 flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="video-mode"
              checked={videoMode === "url"}
              onChange={() => setVideoMode("url")}
            />
            {dict.videoModeUrlLabel}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="video-mode"
              checked={videoMode === "upload"}
              onChange={() => setVideoMode("upload")}
            />
            {dict.videoModeUploadLabel}
          </label>
        </div>

        {videoMode === "url" ? (
          <input
            id="video-url"
            type="url"
            value={videoUrl}
            onChange={(event) => setVideoUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="mt-2 w-full rounded-xl border border-black/15 bg-transparent p-3 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
          />
        ) : (
          <div className="mt-2">
            <p className="text-xs text-foreground/50">{dict.videoUploadHelp}</p>
            <input
              id="video-file"
              type="file"
              accept="video/mp4,video/webm,video/ogg,video/quicktime"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUploadVideo(file);
              }}
              disabled={uploadStatus.kind === "uploading"}
              className="mt-2 w-full text-sm"
            />
            {uploadStatus.kind === "uploading" && (
              <p className="mt-2 text-xs text-foreground/50">{dict.videoUploading}</p>
            )}
            {uploadStatus.kind === "uploaded" && (
              <p className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                {dict.videoUploadedNotice} ({videoUrl})
              </p>
            )}
            {uploadStatus.kind === "error" && (
              <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                {uploadStatus.message}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <label htmlFor="content-json" className="text-sm font-medium">
          {dict.contentJsonLabel}
        </label>
        <button
          type="button"
          onClick={() => {
            setValue(templateValue);
            setVideoUrl(extractVideoUrl(templateValue));
          }}
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
        rows={24}
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
