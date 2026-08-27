"use client";

import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from "react";

// Minimal shape of the YouTube IFrame Player API we rely on.
interface YTPlayer {
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}
interface YTPlayerVars {
  cc_load_policy?: 0 | 1;
  hl?: string;
}
interface YTErrorEvent {
  data: number;
}
interface YTStateChangeEvent {
  data: number;
}
// https://developers.google.com/youtube/iframe_api_reference#Playback_status
const YT_STATE_PLAYING = 1;
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    options: {
      videoId: string;
      playerVars?: YTPlayerVars;
      events: {
        onReady?: () => void;
        onError?: (event: YTErrorEvent) => void;
        onStateChange?: (event: YTStateChangeEvent) => void;
      };
    },
  ) => YTPlayer;
}

// https://developers.google.com/youtube/iframe_api_reference#onError —
// 2 = invalid video id, 5 = HTML5 player error, 100 = video removed/private,
// 101/150 = the uploader doesn't allow embedding (same error, two codes for
// historical reasons). All of these mean "this player will never recover on
// its own" — worth surfacing distinctly from a still-loading state so the
// user isn't staring at a frozen black box.
const UNRECOVERABLE_ERROR_CODES = new Set([2, 5, 100, 101, 150]);
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// The iframe API `<script>` previously had no `onerror` and the promise it
// fed had no timeout — if an ad/privacy blocker or a restrictive network
// blocked youtube.com/iframe_api outright, this promise just never
// resolved, and every caller's `.then()` chain silently stalled forever:
// no error, no player, no explanation. A user tapping the resulting empty
// black box got exactly the reported "нажал и не получилось" experience.
// Resolving with a boolean (never rejecting) keeps every existing `.then()`
// call site simple — no new `.catch()` needed anywhere.
const API_LOAD_TIMEOUT_MS = 10_000;
let apiLoadPromise: Promise<boolean> | null = null;

function loadYouTubeApi(): Promise<boolean> {
  if (window.YT?.Player) return Promise.resolve(true);
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    let settled = false;
    const settle = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      settle(true);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => settle(false);
    document.head.appendChild(script);

    setTimeout(() => settle(false), API_LOAD_TIMEOUT_MS);
  });
  // A timeout/onerror here doesn't necessarily mean the script will NEVER
  // load — a slow (not blocked) network could still deliver it after our
  // timeout fires. Don't let one slow load permanently poison every future
  // player mount on the page: only cache a SUCCESSFUL load; a failed one
  // clears the cache so the next mount attempt retries from scratch.
  apiLoadPromise.then((ok) => {
    if (!ok) apiLoadPromise = null;
  });
  return apiLoadPromise;
}

export interface YouTubePlayerHandle {
  /** Jumps playback to the given second — used by the transcript below the video. */
  seekTo: (seconds: number) => void;
  /**
   * Reads the player's current time directly (no React state involved).
   * Consumers that need to track playback continuously (e.g. the subtitle
   * transcript) should poll this themselves rather than have this
   * component broadcast time updates upward — that's what caused the
   * "Rendering..." freeze: a shared ancestor's state updating 4x/sec and
   * re-rendering the whole lesson tree on every tick.
   */
  getCurrentTime: () => number;
}

const YouTubePlayer = forwardRef<
  YouTubePlayerHandle,
  { youtubeVideoId: string; title: string; unavailableLabel?: string }
>(function YouTubePlayer(
  { youtubeVideoId, title, unavailableLabel = "Este video ya no está disponible en YouTube." },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  // Distinct from errorCode (a real onError event): true means the iframe
  // API script never loaded (blocked/timed out) or the player reported
  // "playing" but its clock never actually moved — both silent-failure
  // modes the API's own onError never reports, so without this a broken
  // video was just an unresponsive black box (the reported "нажал и не
  // получилось" bug). Same visual treatment as errorCode; kept separate so
  // future callers could give each a distinct message if they want to.
  const [silentlyBroken, setSilentlyBroken] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      seekTo(seconds) {
        playerRef.current?.seekTo(seconds, true);
      },
      getCurrentTime() {
        return playerRef.current?.getCurrentTime() ?? 0;
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let player: YTPlayer | null = null;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    setErrorCode(null);
    setSilentlyBroken(false);

    const clearStallTimer = () => {
      if (stallTimer !== null) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
    };

    loadYouTubeApi().then((loaded) => {
      if (cancelled) return;
      if (!loaded) {
        // The API script itself never loaded (blocked or timed out) — no
        // player was ever created, so onError can't fire for us. Surface
        // this the same way as a real playback error rather than leaving
        // the container permanently blank.
        setSilentlyBroken(true);
        return;
      }
      if (!containerRef.current || !window.YT) return;
      player = new window.YT.Player(containerRef.current, {
        videoId: youtubeVideoId,
        playerVars: {
          // The interactive transcript lives below the video, not on top of
          // it — YouTube's built-in CC would duplicate it and clutter the frame.
          cc_load_policy: 0,
          hl: "es",
        },
        events: {
          // The object `new YT.Player()` returns isn't fully hydrated with
          // API methods (getCurrentTime, seekTo, ...) until this fires —
          // exposing it earlier let the transcript's rAF poll call
          // getCurrentTime() before it existed ("... is not a function").
          onReady: () => {
            if (!cancelled) playerRef.current = player;
          },
          // Catches drift that happened *after* the last
          // `npm run check:media-embeds` run (a Content-ID claim or channel
          // takedown can land at any time) — without this, a broken video
          // was just a frozen black box with no explanation.
          onError: (event) => {
            if (!cancelled && UNRECOVERABLE_ERROR_CODES.has(event.data)) setErrorCode(event.data);
          },
          // Covers a real, previously-confirmed blind spot (see
          // src/lib/media/checkEmbeds.ts's song-ty-uydyosh incident): a
          // region-restricted or otherwise soft-blocked video can report
          // itself as "playing" without ever actually advancing, and never
          // fires onError at all — the user just sees a stuck frame with no
          // explanation. If the reported state is "playing", check a few
          // seconds later whether the clock actually moved; if it didn't,
          // treat it as broken.
          //
          // One retry with a longer window before giving up: a real device
          // report flagged a video as "unavailable" that a fresh
          // `npm run check:media-embeds` run confirmed was genuinely fine
          // (not private/removed/region-blocked) — the likely cause was a
          // slow mobile-data iframe cold start tripping the original
          // single 4s check. A stuck video still gets caught, just after
          // ~8s instead of 4s.
          onStateChange: (event) => {
            clearStallTimer();
            if (cancelled || event.data !== YT_STATE_PLAYING) return;
            const startedAt = player?.getCurrentTime() ?? 0;
            const checkStall = (attempt: number) => {
              stallTimer = setTimeout(() => {
                if (cancelled) return;
                const now = player?.getCurrentTime() ?? 0;
                if (now > startedAt + 0.5) return;
                if (attempt < 2) {
                  checkStall(attempt + 1);
                } else {
                  setSilentlyBroken(true);
                }
              }, 4000);
            };
            checkStall(1);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      clearStallTimer();
      player?.destroy();
      playerRef.current = null;
    };
  }, [youtubeVideoId]);

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-black dark:border-white/30">
      <div className="relative aspect-video w-full" aria-label={title}>
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />
        {(errorCode !== null || silentlyBroken) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black px-6 text-center text-sm text-white/70">
            {unavailableLabel}
          </div>
        )}
      </div>
    </div>
  );
});

export default memo(YouTubePlayer);
