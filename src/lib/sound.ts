"use client";

// Every tone here is synthesized on the fly via the Web Audio API instead
// of shipping an audio file or a base64 blob — zero bytes to download,
// zero decode latency, plays instantly. Same "compute it, don't ship an
// asset" reasoning as the celebration cast (MatryoshkaMark.tsx etc). All
// callers already run inside a click handler (Check/submit buttons), which
// is what browsers require before any audio can play at all.

const STORAGE_KEY = "rusofacil-sound-enabled";

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== "0";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType,
  peakGain: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // Quick linear attack, exponential decay — avoids the click/pop a hard
  // on/off edge would produce, without needing an envelope library.
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

/** Short, cheerful two-note blip for a fully correct flashcard answer. */
export function playCorrectTone(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone(ctx, 880, now, 0.12, "sine", 0.09);
  playTone(ctx, 1318.5, now + 0.06, 0.14, "sine", 0.07);
}

/** Soft, low two-note dip for a wrong answer — deliberately gentle, not a
 * harsh buzzer, so it reads as "try again" rather than a scold. */
export function playIncorrectTone(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone(ctx, 220, now, 0.16, "sine", 0.06);
  playTone(ctx, 174.6, now + 0.09, 0.18, "sine", 0.05);
}

/** Four-note major arpeggio (C-E-G-C) for a lesson/topic pass — the
 * CelebrationModal's jingle. */
export function playSuccessJingle(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => playTone(ctx, freq, now + i * 0.09, 0.22, "triangle", 0.08));
}

/** Soft three-note descending motif for a failed lesson check — the
 * EncouragementModal's cue. Deliberately gentle (triangle wave, low peak
 * gain, no sharp attack) so it reads as "aww, try again" rather than a
 * penalty buzzer; distinct from both playIncorrectTone (a single missed
 * flashcard answer, much smaller a moment) and playSuccessJingle (major,
 * ascending — the opposite mood). */
export function playEncouragementTone(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [493.88, 440, 392];
  notes.forEach((freq, i) => playTone(ctx, freq, now + i * 0.14, 0.28, "triangle", 0.06));
}

/** Short ascending five-note run (pentatonic-flavored, deliberately
 * brighter/faster than playSuccessJingle so a mid-round streak doesn't
 * sound like the same "lesson passed" event) for a few-in-a-row correct
 * streak in the recall/fill-blank mini-games. */
export function playStreakFanfare(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [659.25, 783.99, 987.77, 1174.66, 1567.98];
  notes.forEach((freq, i) => playTone(ctx, freq, now + i * 0.055, 0.16, "square", 0.05));
}
