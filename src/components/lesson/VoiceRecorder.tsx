"use client";

import { useEffect, useRef, useState } from "react";
import { PREFERRED_RECORDING_TYPES } from "@/lib/voice-formats";
import {
  VoiceStorageError,
  blobOf,
  deleteRecording,
  getRecording,
  saveRecording,
  type VoiceStorageFailure,
} from "@/lib/voice-recordings-store";

type RecordState = "idle" | "recording" | "recorded" | "denied" | "unsupported" | "failed";

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
  /** The clip is fine and playing, but this device would not keep it. */
  storageUnavailable: string;
  /** Same, with the specific reason a student can act on: no room left. */
  storageFull: string;
  /** Label over a clip restored from this device after a reload. */
  savedRecordingLabel: string;
  /** Removes this one item's stored clip. */
  deleteRecordingLabel: string;
};

/** Identifies which lesson practice item a recording belongs to. Since
 * 30.08.2026 this addresses a row in the browser's own IndexedDB, not a
 * row in our database — see src/lib/voice-recordings-store.ts. */
export interface VoiceRecordingTarget {
  level: string;
  lessonSlug: string;
  itemKey: string;
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
 * Records a short clip from the mic (MediaRecorder API), plays it straight
 * back, and keeps it on this device between sessions.
 *
 * **Nothing here touches the network.** Playback in the current session is
 * a Blob through URL.createObjectURL; persistence is IndexedDB. There is
 * no upload, no route to upload to, and no cloud object written — the
 * owner's decision of 30.08.2026, because the feature is "record, listen,
 * compare" and all three happen on the phone that recorded it.
 * e2e/voice-recording-local.spec.ts fails the build if a single request to
 * our API or to storage happens while recording or playing.
 *
 * Every format decision comes from the recorder, never from a constant:
 * this component used to build its Blob as `audio/webm` no matter what,
 * which on iOS Safari mislabelled MP4 bytes and left the student staring
 * at the native <audio> element's own error text instead of a player. That
 * fix is still load-bearing — the reported type is what gets stored and
 * what the player is handed back after a reload. See
 * src/lib/voice-formats.ts.
 *
 * A failure is contained to this one item. Each practice item renders its
 * own VoiceRecorder, and inside it every failure path — permission,
 * recorder error, empty clip, playback refused, device storage full or
 * missing — ends in a sentence from the dictionary plus a working "record
 * again" button, never in a dead control.
 */
export default function VoiceRecorder({
  dict,
  target,
  ownerScope,
}: {
  dict: Dict;
  /** Omit to get a recorder that does not persist anything — the clip
   * lives for as long as the page does. */
  target?: VoiceRecordingTarget;
  ownerScope?: string;
}) {
  const [state, setState] = useState<RecordState>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const [storageProblem, setStorageProblem] = useState<VoiceStorageFailure | null>(null);
  /** True while what is on screen came out of IndexedDB rather than out of
   * the microphone just now — the only difference is the label above it. */
  const [restored, setRestored] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const persists = Boolean(target && ownerScope);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("unsupported");
    }
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Object URLs are revoked when they are replaced and when the component
  // goes away — held in state rather than in a ref so this effect is the
  // single place that frees them, whichever path created them.
  useEffect(() => {
    if (!audioUrl) return;
    return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  // Bring back this item's clip, if the device still has it. A local
  // IndexedDB read, not a fetch: there is no server to ask.
  useEffect(() => {
    if (!target || !ownerScope) return;
    let cancelled = false;
    getRecording(ownerScope, target)
      .then((found) => {
        if (cancelled || !found) return;
        setAudioUrl(URL.createObjectURL(blobOf(found)));
        setRestored(true);
        setState("recorded");
      })
      .catch((error) => {
        if (cancelled) return;
        // Storage that will not open is worth saying out loud, because it
        // also means the next recording will not survive a reload.
        setStorageProblem(error instanceof VoiceStorageError ? error.reason : "unavailable");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerScope, target?.level, target?.lessonSlug, target?.itemKey]);

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    setPlaybackFailed(false);
    setStorageProblem(null);
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

      // The clock starts in the recorder's own callback, not next to
      // recorder.start(): the duration is derived state and reading the
      // clock from the component's body is what react-hooks/purity flags.
      recorder.onstart = () => {
        startedAtRef.current = Date.now();
      };
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
          setState("failed");
          return;
        }
        setAudioUrl(URL.createObjectURL(blob));
        setRestored(false);
        setState("recorded");
        void persist(blob, type, Date.now() - startedAtRef.current);
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

  /** Writing to the device is best-effort by design: a student who cannot
   * store anything still gets to record, hear themselves and compare,
   * which is the whole feature. Only the "still there tomorrow" half is
   * lost, and the sentence saying so comes from the dictionary. */
  async function persist(blob: Blob, mimeType: string, durationMs: number) {
    if (!target || !ownerScope) return;
    try {
      // The bytes, not the Blob itself — see StoredRecording.data for the
      // WebKit measurement behind that.
      const data = await blob.arrayBuffer();
      await saveRecording({
        ownerScope,
        level: target.level,
        lessonSlug: target.lessonSlug,
        itemKey: target.itemKey,
        data,
        mimeType,
        bytes: blob.size,
        durationMs,
        createdAt: Date.now(),
      });
      setStorageProblem(null);
    } catch (error) {
      setStorageProblem(error instanceof VoiceStorageError ? error.reason : "unavailable");
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
    setAudioUrl(null);
    setPlaybackFailed(false);
    setRestored(false);
    setState("idle");
  }

  async function forget() {
    reset();
    if (!target || !ownerScope) return;
    // A delete that fails is not worth a message: the clip is off screen,
    // and the profile's "delete my recordings" button is the real broom.
    await deleteRecording(ownerScope, target).catch(() => {});
  }

  if (state === "unsupported") {
    return <p className="text-xs text-foreground/50">{dict.unsupported}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
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
            <span className="text-xs text-foreground/50">
              {restored ? dict.savedRecordingLabel : dict.yourRecording}
            </span>
            {playbackFailed ? (
              // The clip will not decode here. Saying so in the student's
              // own language beats leaving the browser's broken control on
              // screen with its own word for "error" in whatever language
              // the phone is set to.
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
            {persists && (
              <button
                type="button"
                onClick={forget}
                className="tap inline-flex items-center gap-1 rounded-full border border-black/15 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/20"
              >
                {dict.deleteRecordingLabel}
              </button>
            )}
          </>
        )}

        {state === "denied" && <p className="text-xs text-red-600 dark:text-red-400">{dict.permissionDenied}</p>}
        {state === "failed" && <p className="text-xs text-red-600 dark:text-red-400">{dict.recordingFailed}</p>}
      </div>

      {storageProblem && (
        // Not red and not in place of the player: the recording works, it
        // just will not outlive the page. Told once, under the controls.
        <p className="text-xs text-foreground/60">
          {storageProblem === "quota" ? dict.storageFull : dict.storageUnavailable}
        </p>
      )}
    </div>
  );
}
