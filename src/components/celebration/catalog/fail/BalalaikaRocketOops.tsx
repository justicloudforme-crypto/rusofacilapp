"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const BALALAIKA_BODY = "#e0a934";
const FLAME_OUTER = "#e0a934";
const FLAME_INNER = "#d63b2f";

// Story beats:
//   Loop (0–0.22s, `balalaika-shred` reused from BalalaikaRockStar.tsx,
//     playing right up to launch): the strum stays frantic to the very
//     end — this is BalalaikaMusicSwirl.tsx's virtuoso playing pushed one
//     notch too far.
//   Loop (0–0.7s, `flame-flicker` reused from StoveFire.tsx, at the
//     balalaika's base instead of a stove opening): a rocket flame
//     erupts where the strumming hand was.
//   Phase (0.1–0.6s, `rocket-blastoff-exit`, holds off-frame): bear and
//     instrument launch together, diagonally up and out of the frame.
//   Loop (0–1.4s, `smoke-puff` reused, staggered ×2, trailing behind):
//     the same puff shape used for BearSmokingBalalaika.tsx's overheated
//     playing, now marking a flight path instead of hovering in place.
/** EVERYDAY-tier fail scenario: the BalalaikaMusicSwirl win, played so
 * fast the balalaika turns into a jetpack. Reuses balalaika-shred,
 * flame-flicker, and smoke-puff wholesale. */
export default function BalalaikaRocketOops() {
  return (
    <div className="relative h-28 w-full max-w-[220px] overflow-hidden" aria-hidden="true">
      <span className="smoke-puff absolute rounded-full bg-white" style={{ width: 6, height: 16, left: "20%", bottom: 10, opacity: 0.5, animationDelay: "0s" }} />
      <span className="smoke-puff absolute rounded-full bg-white" style={{ width: 5, height: 14, left: "36%", bottom: 20, opacity: 0.4, animationDelay: "0.4s" }} />

      <div className="rocket-blastoff-exit absolute bottom-6 left-8" style={{ width: 66, height: 66 }}>
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", left: "6%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", right: "6%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "70%", aspectRatio: "1", top: "10%", background: FUR }}>
          <span className="absolute rounded-b-full" style={{ width: "16%", height: "36%", top: "38%", left: "-6%", background: HAT_FUR }} />
          <span className="absolute rounded-b-full" style={{ width: "16%", height: "36%", top: "38%", right: "-6%", background: HAT_FUR }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "84%", height: "12%", top: "16%", background: HAT_TRIM, borderRadius: 9999 }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "80%", height: "32%", top: "-10%", background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "56%", height: "38%", top: "50%", background: MUZZLE }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", left: "27%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", right: "27%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "20%", height: "16%", top: "56%", background: INK }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />

        <span className="balalaika-shred absolute" style={{ width: "40%", height: "40%", bottom: "-8%", right: "-6%", transformOrigin: "80% 0%" }}>
          <span className="absolute inset-0" style={{ background: BALALAIKA_BODY, clipPath: "polygon(50% 0%, 8% 100%, 92% 100%)" }} />
          <span className="flame-flicker absolute left-1/2 -translate-x-1/2 rounded-b-full" style={{ width: "70%", height: "60%", top: "100%", background: FLAME_OUTER, transformOrigin: "50% 0%" }} />
          <span className="flame-flicker absolute left-1/2 -translate-x-1/2 rounded-b-full" style={{ width: "40%", height: "40%", top: "100%", background: FLAME_INNER, transformOrigin: "50% 0%", animationDelay: "0.2s" }} />
        </span>
      </div>
    </div>
  );
}
