"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeTextForTTS } from "@/lib/speech";

/**
 * Reads `text` aloud in Russian. Prefers a pre-generated audio file
 * (`audioUrl`, from the shared AudioAsset cache — see prisma/generate-lesson-audio.ts)
 * when one is passed in, playing it through a plain <audio> element; falls
 * back to the browser's SpeechSynthesis API otherwise, exactly as before.
 * The file path matters for the mobile port: Web Speech API is unreliable
 * or absent in a native/WebView context, but an <audio> element playing a
 * real .mp3 works everywhere — see rusofasil_project_state memory.
 * Silently disables itself only in the synthesis fallback path, when the
 * browser doesn't support speech synthesis at all (e.g. some older
 * WebViews) — a passed-in audioUrl always works, since <audio> playback
 * doesn't depend on that API.
 */
export default function SpeakButton({
  text,
  label,
  size = "sm",
  audioUrl,
}: {
  text: string;
  label: string;
  /** "lg" is a full pill with the label text visible (not just the aria
   * label) — reserved for a card's one "primary" pronunciation button
   * (e.g. the main word on a flashcard), since a 44px+ tap target with a
   * legible caption doesn't scale down to every inline glyph-sized use. */
  size?: "sm" | "md" | "lg";
  /** Pre-generated pronunciation file for `text`, if one exists in
   * the shared AudioAsset cache. Omit to always use browser synthesis. */
  audioUrl?: string;
}) {
  const [supported, setSupported] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Starts true on both server and client so hydration output matches;
    // corrected right after mount, same pattern as ExercisesTab's
    // localStorage read below. Irrelevant when audioUrl is set (that path
    // never touches speechSynthesis), but cheap to always compute.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  // A real, confirmed bug: this component instance is reused across
  // different cards (e.g. flipping through a flashcard deck) without
  // unmounting, so `audioUrl` changes on every card — but the cached
  // `audioRef.current` from speak()'s `if (!audioRef.current)` check
  // below was never invalidated, so every card after the first kept
  // replaying whichever file was cached from the very first press.
  // Resetting the ref whenever `audioUrl` changes forces speak() to build
  // a fresh Audio element for the new file. Also stops/rewinds a clip
  // still playing from the previous card so it doesn't keep going after
  // the user has already moved on.
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    audioRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSpeaking(false);
  }, [audioUrl]);

  if (!supported && !audioUrl) return null;

  // Previously this always restarted from the top on every tap — there was
  // no way to actually pause a clip already playing, only to make it play
  // again from 0. Now a tap toggles: start it, pause it mid-way, or resume
  // exactly where it left off — a still-paused (not ended) clip resumes
  // instead of restarting.
  function speak() {
    if (audioUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onplay = () => setSpeaking(true);
        audioRef.current.onpause = () => setSpeaking(false);
        audioRef.current.onended = () => setSpeaking(false);
        audioRef.current.onerror = () => setSpeaking(false);
      }
      const audio = audioRef.current;
      if (!audio.paused) {
        audio.pause();
        return;
      }
      // A clip that already reached the end (currentTime === duration)
      // should restart, not "resume" from a position with nothing left to
      // play — every other paused-mid-way case resumes in place.
      if (audio.ended || audio.currentTime >= (audio.duration || Infinity)) {
        audio.currentTime = 0;
      }
      // .play() rejects on a broken/missing audioUrl or an AbortError from
      // a rapid double-tap (pause() racing this call) — `void` alone
      // doesn't catch a promise rejection, same bug class as
      // SerwistRegister.tsx. Matches the .catch(() => setPlaying(false))
      // pattern StoryText.tsx already uses for the same API.
      audio.play().catch(() => setSpeaking(false));
      return;
    }

    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setSpeaking(false);
      return;
    }
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setSpeaking(true);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(sanitizeTextForTTS(text));
    utterance.lang = "ru-RU";
    utterance.rate = 0.9;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  if (size === "lg") {
    return (
      <button
        type="button"
        onClick={speak}
        aria-label={label}
        className={`inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:opacity-50 ${
          speaking ? "bg-primary-400 text-white" : "bg-primary text-white hover:bg-primary-400"
        }`}
      >
        <span aria-hidden="true" className="text-base">
          🔊
        </span>
        {label}
      </button>
    );
  }

  const dimensions = size === "md" ? "h-8 w-8 text-base" : "h-6 w-6 text-xs";

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={label}
      title={label}
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-full border border-black/10 text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50 dark:border-white/15 ${dimensions} ${
        speaking ? "bg-foreground/10 text-foreground" : ""
      }`}
    >
      🔊
    </button>
  );
}
