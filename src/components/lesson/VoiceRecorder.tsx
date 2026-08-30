"use client";

import { useEffect, useRef, useState } from "react";
import { PREFERRED_RECORDING_TYPES, voiceExtensionFor } from "@/lib/voice-formats";

type RecordState = "idle" | "recording" | "recorded" | "denied" | "unsupported" | "failed";
type SubmitState = "idle" | "submitting" | "submitted" | "error";

type Dict = {
  recordLabel: string;
  stopLabel: string;
  retryLabel: string;
  permissionDenied: string;
  unsupported: string;
  yourRecording: string;
  /** Shown when the recorder itself failed, or produced nothing. */
  recordingFailed: string;
  /** Shown when the clip exists but this browser will not play it back. */
  playbackFailed: string;
  submitLabel?: string;
  submittingLabel?: string;
  submittedLabel?: string;
  submitError?: string;
  submitRateLimited?: string;
  submitUnsupportedType?: string;
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
 * The first format this browser can actually record. Empty string means
 * "no preference" — MediaRecorder then picks its own, which is the right
 * answer on iOS (audio/mp4) and the only answer on anything unusual.
 *
 * Called at record time, not at module load: MediaRecorder does not exist
 * during server rendering.
 */
function pickRecordingType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of PREFERRED_RECORDING_TYPES) {
    if (typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

/**
 * Records a short clip from the mic (MediaRecorder API), then lets the
 * student play it back or re-record. When `submission` is provided, adds a
 * "send" step that uploads the clip to /api/voice-submissions (server-side
 * storage, visible only to the student who recorded it — see that route);
 * without it, the recording stays purely local and nothing is uploaded.
 *
 * Every format decision here comes from the recorder, never from a
 * constant: this component used to build its Blob as `audio/webm` no
 * matter what, which on iOS Safari mislabelled MP4 bytes and left the
 * student staring at the native <audio> element's own error text instead
 * of a player. See src/lib/voice-formats.ts.
 *
 * A failure is contained to this one item. Each practice item renders its
 * own VoiceRecorder, and inside it every failure path — permission,
 * recorder error, empty clip, playback refused, upload rejected — ends in
 * a sentence from the dictionary plus a working "record again" button,
 * never in a dead control.
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
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const [previousPlaybackFailed, setPreviousPlaybackFailed] = useState(false);
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

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    setPlaybackFailed(false);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Permission refused, or no microphone. Both are the student's to
      // fix and both read the same from here.
      setState("denied");
      return;
    }

    try {
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickRecordingType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      // A recorder can fail after start (the track ends, the tab loses the
      // device). Without this the student saw the "stop" button forever.
      recorder.onerror = () => {
        releaseStream();
        setState("failed");
      };
      recorder.onstop = () => {
        releaseStream();
        // The recorder's own type, not a constant — on iOS this is
        // audio/mp4, and calling it webm is what broke playback.
        const type = recorder.mimeType || chunksRef.current[0]?.type || "";
        const blob = new Blob(chunksRef.current, type ? { type } : undefined);
        if (blob.size === 0) {
          // A tap so short nothing was captured, or a recorder that
          // produced no data. An empty clip plays as an error everywhere.
          blobRef.current = null;
          setState("failed");
          return;
        }
        blobRef.current = blob;
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setState("recorded");
        setSubmitState("idle");
      };

      recorder.start();
      setState("recording");
    } catch {
      // MediaRecorder refused to construct — an unsupported mimeType on an
      // exotic browser, most likely. The mic is already open, so let it go.
      releaseStream();
      setState("failed");
    }
  }

  function stopRecording() {
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      releaseStream();
      setState("failed");
    }
  }

  function reset() {
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    blobRef.current = null;
    setPlaybackFailed(false);
    setSubmitState("idle");
    setState("idle");
  }

  async function handleSubmit() {
    if (!submission || !blobRef.current) return;
    setSubmitState("submitting");
    try {
      const blob = blobRef.current;
      // Same extension the server will store it under; sending
      // "recording.webm" for an MP4 clip is how the wrong name got into
      // the database in the first place.
      const extension = voiceExtensionFor(blob.type) ?? "webm";
      const form = new FormData();
      form.append("level", submission.level);
      form.append("lesson", submission.lessonSlug);
      form.append("itemKey", submission.itemKey);
      form.append("file", blob, `recording.${extension}`);
      const res = await fetch("/api/voice-submissions", { method: "POST", body: form });
      if (!res.ok) {
        const reason = await res
          .json()
          .then((body) => (typeof body?.error === "string" ? body.error : ""))
          .catch(() => "");
        setSubmitErrorMessage(
          res.status === 429
            ? dict.submitRateLimited
            : reason === "unsupported_type"
              ? (dict.submitUnsupportedType ?? dict.submitError)
              : dict.submitError
        );
        setSubmitState("error");
        return;
      }
      const saved = (await res.json()) as StoredSubmission;
      setPrevious(saved);
      setPreviousPlaybackFailed(false);
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-foreground/50">{dict.previousRecordingLabel}</span>
          {previousPlaybackFailed ? (
            // The stored clip will not decode here. Saying so in the
            // student's own language beats leaving the browser's broken
            // control on screen with its own word for "error" in whatever
            // language the phone is set to.
            <span className="text-xs text-foreground/60">{dict.playbackFailed}</span>
          ) : (
            <audio
              controls
              src={previous.audioUrl}
              onError={() => setPreviousPlaybackFailed(true)}
              className="h-8 max-w-[220px]"
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {state !== "recording" && state !== "recorded" && (
          <button
            type="button"
            onClick={startRecording}
            className="tap inline-flex items-center gap-2 rounded-full border border-black/15 px-4 py-1.5 text-xs font-medium transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/20"
          >
            🎙️ {state === "idle" ? dict.recordLabel : dict.retryLabel}
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
            {playbackFailed ? (
              <span className="text-xs text-foreground/60">{dict.playbackFailed}</span>
            ) : (
              <audio
                controls
                src={audioUrl}
                onError={() => setPlaybackFailed(true)}
                className="h-8 max-w-[220px]"
              />
            )}
            <button
              type="button"
              onClick={reset}
              className="tap inline-flex items-center gap-1 rounded-full border border-black/15 px-3 py-1.5 text-xs font-medium transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/20"
            >
              ↻ {dict.retryLabel}
            </button>
            {/* Still offered when playback failed: the clip may well be
                fine and only this browser unable to play it back, and the
                student's work should not be thrown away over that. */}
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
        {state === "failed" && <p className="text-xs text-red-600 dark:text-red-400">{dict.recordingFailed}</p>}
        {submitState === "error" && (
          <p className="text-xs text-red-600 dark:text-red-400">{submitErrorMessage ?? dict.submitError}</p>
        )}
      </div>
    </div>
  );
}
