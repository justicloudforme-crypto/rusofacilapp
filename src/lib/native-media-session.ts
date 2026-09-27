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
 * Убирает карточку проигрывателя из шторки целиком (заход 7.240, задача 2).
 *
 * Состояние `"none"` плагин понимает как «звука больше нет»: отвязывает
 * свою службу, та делает `stopForeground(true)` — уведомление исчезает.
 * До 7.240 при уходе со страницы рассказа снимались только кнопки, а
 * состояние оставалось «playing»: замер на эмуляторе — в шторке
 * `PLAYING`, `actions=0`, время бежит, хотя звук уже остановлен. Ровно
 * это и видел владелец («только полоса, без play/pause»).
 */
export async function clearNativeMediaSession(): Promise<void> {
  await nativeOnly(() => MediaSession.setPlaybackState({ playbackState: "none" }));
}

/**
 * Обложка для шторки — КАРТИНКОЙ, а не относительным адресом.
 *
 * Java-половина плагина (`urlToBitmap`) понимает только `http…` и
 * `data:…;base64,`. Адрес `/icons/icon-512.png` (как было до 7.240) она
 * молча превращает в `null` — отсюда серый значок динамика вместо
 * обложки. `data:` работает и без сети: иконка лежит в precache
 * воркера, а самой Java сеть для неё не нужна. Если прочитать иконку не
 * удалось — полный адрес (с сетью Java скачает его сама).
 */
const ARTWORK_PATH = "/icons/icon-192.png";
let artworkPromise: Promise<string> | null = null;

export function nativeArtworkSrc(): Promise<string> {
  if (artworkPromise) return artworkPromise;
  const absolute = new URL(ARTWORK_PATH, window.location.origin).href;
  artworkPromise = fetch(ARTWORK_PATH)
    .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("не строка")));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }),
    )
    .catch(() => {
      artworkPromise = null;
      return absolute;
    });
  return artworkPromise;
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

/**
 * "seekto" is the one native action whose handler needs a payload (the
 * target time, in seconds, dragged on the OS's own lock-screen scrubber) —
 * kept as its own function rather than overloading setNativeActionHandler
 * above, whose handler shape is intentionally parameterless for the other
 * five actions. Only meaningful for a story with `fullAudioUrl` (a real
 * seekable single track) — see StoryText.tsx's Media Session effect.
 */
export async function setNativeSeekToHandler(handler: ((seekTime: number) => void) | null): Promise<void> {
  await nativeOnly(() =>
    MediaSession.setActionHandler({ action: "seekto" }, handler ? (details) => handler(details.seekTime ?? 0) : null),
  );
}

/** Drives the native lock-screen/notification scrubber's position and
 * duration — the native counterpart of navigator.mediaSession's own
 * setPositionState, called alongside it. */
export async function setNativePositionState(
  options: { duration: number; playbackRate: number; position: number } | null,
): Promise<void> {
  await nativeOnly(() => MediaSession.setPositionState(options ?? {}));
}
