"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

/** CelebrationModal's default hero, for a lesson/topic pass: three
 * matryoshka dolls popping in one after another, biggest first — reads as
 * the doll "opening up" to reveal smaller ones nested inside. Built by
 * staggering the existing, already-tuned MatryoshkaAvatar three times
 * (see `doll-cascade-in` in globals.css for the bounce) rather than
 * drawing a new character — no new shapes to get wrong, still zero
 * images/SVG. The sparkle glyphs are plain Unicode text, not icons, so
 * they cost nothing beyond the two extra DOM nodes. */
export default function Matryoshka() {
  return (
    <div className="relative flex h-24 items-end justify-center gap-2" aria-hidden="true">
      <span className="doll-cascade-piece" style={{ animationDelay: "0.2s" }}>
        <MatryoshkaAvatar id="matryoshka_happy" size={40} />
      </span>
      <span className="doll-cascade-piece" style={{ animationDelay: "0s" }}>
        <MatryoshkaAvatar id="matryoshka_laughing" size={64} />
      </span>
      <span className="doll-cascade-piece" style={{ animationDelay: "0.35s" }}>
        <MatryoshkaAvatar id="matryoshka_proud" size={32} />
      </span>
      <span
        className="sparkle-twinkle absolute -top-1 left-[30%] select-none text-lg"
        style={{ animationDelay: "0.55s" }}
      >
        ✨
      </span>
      <span
        className="sparkle-twinkle absolute -top-2 right-[26%] select-none text-sm"
        style={{ animationDelay: "0.75s" }}
      >
        ✨
      </span>
    </div>
  );
}
