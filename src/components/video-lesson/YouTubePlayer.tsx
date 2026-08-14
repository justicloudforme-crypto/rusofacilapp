"use client";

import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from "react";

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
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    options: { videoId: string; playerVars?: YTPlayerVars; events: { onReady?: () => void } },
  ) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
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

const YouTubePlayer = forwardRef<YouTubePlayerHandle, { youtubeVideoId: string; title: string }>(
  function YouTubePlayer({ youtubeVideoId, title }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayer | null>(null);

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

      loadYouTubeApi().then(() => {
        if (cancelled || !containerRef.current || !window.YT) return;
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
          },
        });
      });

      return () => {
        cancelled = true;
        player?.destroy();
        playerRef.current = null;
      };
    }, [youtubeVideoId]);

    return (
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-black dark:border-white/10">
        <div className="relative aspect-video w-full" aria-label={title}>
          <div ref={containerRef} className="absolute inset-0 h-full w-full" />
        </div>
      </div>
    );
  },
);

export default memo(YouTubePlayer);
