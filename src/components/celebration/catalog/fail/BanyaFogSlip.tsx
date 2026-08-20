"use client";

const HANDLE = "#5c3b26";
const LEAF = "#8a6a1e";
const FOG = "#fff8ec";

// Story beats:
//   Loop (0–1.6s, `fog-cloud-pulse`): a broad, low-opacity haze pulses over
//     the whole scene — the banya got too hot to see through, unlike
//     BanyaSteamRefresh.tsx's clear, contained swirl.
//   Phase (0.1–0.6s, `leaf-fall` reused from MatryoshkaBirchBranchWilt.tsx,
//     staggered ×4): the veník's leaves come loose and tumble down instead
//     of staying bundled — same fall-and-fade physics as the wilting
//     branch's leaves.
/** EVERYDAY-tier fail scenario: the BanyaSteamRefresh win, fogged over
 * instead of refreshing. Same handle/leaf vocabulary; reuses the
 * leaf-fall keyframe wholesale for the coming-apart veník. */
export default function BanyaFogSlip() {
  return (
    <div className="relative flex h-28 items-end justify-center overflow-hidden" aria-hidden="true">
      <span className="fog-cloud-pulse absolute inset-0 rounded-2xl" style={{ background: FOG }} />

      <div className="relative" style={{ width: 40, height: 60 }}>
        <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 30, left: "50%", width: 10, marginLeft: -5, background: HANDLE }} />
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="leaf-fall absolute rounded-full"
            style={{ width: 10, height: 7, left: 4 + i * 8, top: 0, background: LEAF, borderRadius: "60% 60% 50% 50% / 80% 80% 30% 30%", animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
    </div>
  );
}
