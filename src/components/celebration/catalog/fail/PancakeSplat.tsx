"use client";

const PAN_BODY = "#2a1d16";
const PAN_HANDLE = "#3a2a20";
const PANCAKE = "#e0a934";
const PANCAKE_SPOT = "#c9962e";

// Story beats:
//   Phase 1 (0.00–0.5s, `pancake-flyoff`, holds off-frame): instead of
//     MatryoshkaPancakeFlip's tidy catch, the blini sails clean out of the
//     pan and off the top of the frame.
//   Phase 2 (0.4–0.7s, `splat-flatten`, on a blob left behind on the
//     ground): a flattened splodge fades in right where it landed —
//     the "it came back down somewhere" punchline.
/** EVERYDAY-tier fail scenario: the MatryoshkaPancakeFlip win, gone too
 * far. Same pan/pancake vocabulary; reuses no doll at all — this one is
 * just the skillet's problem. */
export default function PancakeSplat() {
  return (
    <div className="relative flex h-28 items-end justify-center overflow-hidden" aria-hidden="true">
      <span className="splat-flatten absolute rounded-full" style={{ width: 30, height: 8, left: "20%", bottom: 4, background: PANCAKE_SPOT, opacity: 0.6 }} />

      <div className="relative" style={{ width: 84, height: 40 }}>
        <span
          className="pancake-flyoff absolute rounded-full"
          style={{ width: 36, height: 10, left: 24, bottom: 18, background: PANCAKE }}
        >
          <span className="absolute rounded-full" style={{ width: 5, height: 3, top: 2, left: 8, background: PANCAKE_SPOT, opacity: 0.6 }} />
          <span className="absolute rounded-full" style={{ width: 5, height: 3, top: 2, left: 20, background: PANCAKE_SPOT, opacity: 0.6 }} />
        </span>

        <span className="absolute rounded-full" style={{ width: 68, height: 18, left: 4, bottom: 0, background: PAN_BODY }} />
        <span className="absolute" style={{ width: 26, height: 6, right: -18, bottom: 6, background: PAN_HANDLE, borderRadius: 9999 }} />
      </div>
    </div>
  );
}
