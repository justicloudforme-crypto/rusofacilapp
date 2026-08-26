"use client";

import { Capacitor } from "@capacitor/core";
import { MediaSession } from "@capgo/capacitor-media-session";
import type { MediaSessionAction } from "@capgo/capacitor-media-session";

// A real device report found that navigator.mediaSession — already fully
// wired up in StoryText.tsx — never produces a lock-screen/notification
// player on Android specifically: unlike Chrome, the plain Android System
// WebView Capacitor runs on doesn't bridge the web MediaSession API to a
// real OS notification/foreground service on its own. This is the native
// half that does, via @capgo/capacitor-media-session (version-aligned with
// this project's Capacitor 8). Same no-op-on-web guard as haptics.ts/
// notifications.ts — the existing navigator.mediaSession calls in
// StoryText.tsx keep covering the web/PWA case unchanged; this is purely
// additive for the native shell.
function nativeOnly<T>(fn: () => Promise<T>): Promise<T | undefined> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(undefined);
  return fn().catch(() => undefined);
}

export interface NativeMediaMetadata {
  title: string;
  artist?: string;
  artwork?: { src: string; sizes: string; type: string }[];
}

export async function setNativeMediaMetadata(metadata: NativeMediaMetadata): Promise<void> {
  await nativeOnly(() => MediaSession.setMetadata(metadata));
}

export async function setNativePlaybackState(playing: boolean): Promise<void> {
  await nativeOnly(() =>
    MediaSession.setPlaybackState({ playbackState: playing ? "playing" : "paused" }),
  );
}

/**
 * Registers (or clears, passing `null`) a handler for one native media
 * action. Mirrors navigator.mediaSession.setActionHandler's own shape so
 * call sites can register the same action on both APIs side by side.
 */
export async function setNativeActionHandler(
  action: MediaSessionAction,
  handler: (() => void) | null,
): Promise<void> {
  await nativeOnly(() =>
    MediaSession.setActionHandler({ action }, handler ? () => handler() : null),
  );
}
