"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

const COLORS = ["var(--color-primary)", "var(--color-primary-400)", "var(--color-folk-red)", "var(--color-premium-400)"];
const PIECE_COUNT = 36;

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
  size: number;
}

function makePieces(): ConfettiPiece[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.35,
    duration: 1.6 + Math.random() * 1.1,
    color: COLORS[i % COLORS.length],
    rotate: Math.random() * 360,
    size: 6 + Math.random() * 6,
  }));
}

/** Pure-CSS confetti burst: a fixed number of absolutely-positioned spans
 * falling via the `confetti-fall` keyframe in globals.css. No canvas, no
 * dependency — ~36 DOM nodes animating only `transform`/`opacity` (GPU
 * compositing, cheap even on low-end phones). The piece layout is rolled
 * once via useState's lazy initializer so it doesn't reshuffle on every
 * re-render; callers control the burst's lifetime by mounting/unmounting
 * this component (e.g. gated behind CelebrationModal's `open` prop).
 *
 * Portalled straight to `document.body`: this is used inside
 * GameResultPanel, which sits inside Modal's bottom-sheet panel — that
 * panel animates in via a CSS `transform` (`.sheet-slide-up`), and a
 * `transform` on an ancestor becomes the containing block for any
 * `position: fixed` descendant (the same trap MobileMenu.tsx's own sheet
 * already documents solving with a portal). Without this, the confetti's
 * `fixed inset-0` resolved against the small sheet panel instead of the
 * viewport — clipped to the panel's own bounds, effectively invisible on a
 * phone (confirmed 2026-08-27, reported as "confetti hidden behind the
 * result window"). Portalling here, not in GameResultPanel/Modal, keeps
 * every other Confetti call site's simple `{open && <Confetti />}` usage
 * unchanged. */
export default function Confetti() {
  const [pieces] = useState(makePieces);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>,
    document.body,
  );
}
