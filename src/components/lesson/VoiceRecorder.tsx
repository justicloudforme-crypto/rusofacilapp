"use client";

import { useEffect, useRef, useState } from "react";

type RecordState = "idle" | "recording" | "recorded" | "denied" | "unsupported";
type SubmitState = "idle" | "submitting" | "submitted" | "error";

type Dict = {
  recordLabel: string;
  stopLabel: string;
  retryLabel: string;
  permissionDenied: string;
  unsupported: string;
  yourRecording: string;
  submitLabel?: string;
  submittingLabel?: string;
  submittedLabel?: string;
  submitError?: string;
  submitRateLimited?: string;
  previousRecordingLabel?: string;
};

/** Identifies which lesson practice item a recording belongs to — see
 * VoiceSubmission in prisma/schema.prisma. */
export interface VoiceSubmissionTarget {
  level: string;
  lessonSlug: string;
  itemKey: string;
}

interface StoredSubmission {
  id: string;
  audioUrl: string;
  createdAt: string;
}

/**
 * Records a short clip from the mic (MediaRecorder API), then lets the
 * student play it back or re-record. When `submission` is provided, adds a
 * "send" step that uploads the clip to /api/voice-submissions (server-side
 * storage, visible only to the student who recorded it — see that route);
 * without it, the recording stays purely local and nothing is uploaded.
 */
export default function VoiceRecorder({
  dict,
  submission,
}: {
  dict: Dict;
  submission?: VoiceSubmissionTarget;
}) {
  const [state, setState] = useState<RecordState>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | undefined>(undefined);
  const [previous, setPrevious] = useState<StoredSubmission | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("unsupported");
    }
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!submission) return;
    const params = new URLSearchParams({
      level: submission.level,
      lesson: submission.lessonSlug,
      itemKey: submission.itemKey,
    });
    fetch(`/api/voice-submissions?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const latest = data?.submissions?.[0] as StoredSubmission | undefined;
        if (latest) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setPrevious(latest);
        }
      })
      .catch(() => {
        // No previous-submission indicator is not worth surfacing an error for.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission?.level, submission?.lessonSlug, submission?.itemKey]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        blobRef.current = blob;
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        stream.getTracks().forEach((track) => track.stop());
        setState("recorded");
        setSubmitState("idle");
      };

      recorder.start();
      setState("recording");
    } catch {
      setState("denied");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function reset() {
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    blobRef.current = null;
    setSubmitState("idle");
    setState("idle");
  }

  async function handleSubmit() {
    if (!submission || !blobRef.current) return;
    setSubmitState("submitting");
    try {
      const form = new FormData();
      form.append("level", submission.level);
      form.append("lesson", submission.lessonSlug);
      form.append("itemKey", submission.itemKey);
      form.append("file", blobRef.current, "recording.webm");
      const res = await fetch("/api/voice-submissions", { method: "POST", body: form });
      if (!res.ok) {
        setSubmitErrorMessage(res.status === 429 ? dict.submitRateLimited : dict.submitError);
        setSubmitState("error");
        return;
      }
      const saved = (await res.json()) as StoredSubmission;
      setPrevious(saved);
      setSubmitState("submitted");
    } catch {
      setSubmitErrorMessage(dict.submitError);
      setSubmitState("error");
    }
  }

  if (state === "unsupported") {
    return <p className="text-xs text-foreground/50">{dict.unsupported}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {previous && state !== "recorded" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground/50">{dict.previousRecordingLabel}</span>
          <audio controls src={previous.audioUrl} className="h-8 max-w-[220px]" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {state !== "recording" && state !== "recorded" && (
          <button
            type="button"
            onClick={startRecording}
            className="tap inline-flex items-center gap-2 rounded-full border border-black/15 px-4 py-1.5 text-xs font-medium transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/20"
          >
            🎙️ {dict.recordLabel}
          </button>
        )}

        {state === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-2 rounded-full border border-red-500 bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-600 dark:text-red-400"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {dict.stopLabel}
          </button>
        )}

        {state === "recorded" && audioUrl && (
          <>
            <span className="text-xs text-foreground/50">{dict.yourRecording}</span>
            <audio controls src={audioUrl} className="h-8 max-w-[220px]" />
            <button
              type="button"
              onClick={reset}
              className="tap inline-flex items-center gap-1 rounded-full border border-black/15 px-3 py-1.5 text-xs font-medium transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/20"
            >
              ↻ {dict.retryLabel}
            </button>
            {submission && dict.submitLabel && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitState === "submitting" || submitState === "submitted"}
                className="tap inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitState === "submitting"
                  ? dict.submittingLabel
                  : submitState === "submitted"
                    ? `✓ ${dict.submittedLabel}`
                    : dict.submitLabel}
              </button>
            )}
          </>
        )}

        {state === "denied" && <p className="text-xs text-red-600 dark:text-red-400">{dict.permissionDenied}</p>}
        {submitState === "error" && (
          <p className="text-xs text-red-600 dark:text-red-400">{submitErrorMessage ?? dict.submitError}</p>
        )}
      </div>
    </div>
  );
}
