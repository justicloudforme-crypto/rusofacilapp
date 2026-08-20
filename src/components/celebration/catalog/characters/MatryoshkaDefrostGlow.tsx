"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const CUP_TRIM = "#2d5f8a";
const TEA = "#8a4a1e";
const FROST = "#c7dff0";
const GLOW = "#e0a934";

// Story beats:
//   Loop (0–1.2s, `warm-glow-pulse`): a soft amber halo behind her breathes
//     in and out, reading as warmth rather than a hard light.
//   Phase (0.1–0.9s, `frost-melt-fade`, staggered ×3 on small fern-shaped
//     motifs around her): frost patterns shrink and fade out one after
//     another as the warmth reaches them.
//   Loop (0–0.4s, `teacup-pop-in` reused, one-shot hold): the teacup she's
//     holding pops in already full, steaming — same entrance as every
//     other teacup in the catalog.
/** EVERYDAY-tier win scenario: a doll warming up with a cup of tea, frost
 * patterns melting away around her. Reuses MatryoshkaAvatar for the face
 * and teacup-pop-in for the cup. */
export default function MatryoshkaDefrostGlow() {
  const frost = [
    { top: -6, left: -14, delay: "0s" },
    { top: 6, right: -16, delay: "0.2s" },
    { top: 34, left: -10, delay: "0.4s" },
  ];
  return (
    <div className="relative flex h-28 items-end justify-center gap-2" aria-hidden="true">
      <span className="warm-glow-pulse absolute rounded-full" style={{ width: 70, height: 70, background: GLOW, opacity: 0.25 }} />

      <div className="relative" style={{ width: 56, height: 56 }}>
        <MatryoshkaAvatar id="matryoshka_calm" size={56} />
        {frost.map((f, i) => (
          <span
            key={i}
            className="frost-melt-fade absolute"
            style={{ top: f.top, left: "left" in f ? f.left : undefined, right: "right" in f ? f.right : undefined, width: 14, height: 14, background: FROST, clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)", animationDelay: f.delay }}
          />
        ))}
      </div>

      <div className="teacup-pop-in relative" style={{ width: 34, height: 30, animationDelay: "0.5s" }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-b-2xl border-2" style={{ width: 26, height: 16, bottom: 4, borderColor: CUP_TRIM, background: "var(--background)", overflow: "hidden" }}>
          <span className="absolute inset-x-0 bottom-0" style={{ height: 12, background: TEA }} />
        </span>
        <span className="absolute rounded-full border-2" style={{ width: 7, height: 8, right: -2, bottom: 6, borderColor: CUP_TRIM }} />
        <span className="steam-wisp absolute rounded-full bg-white" style={{ width: 3, height: 10, left: "40%", top: -4, opacity: 0.5 }} />
      </div>
    </div>
  );
}
