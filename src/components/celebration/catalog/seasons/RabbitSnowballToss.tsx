"use client";

const FUR = "#f2ede3";
const FUR_SHADE = "#d8d0c2";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const NOSE = "#d63b2f";
const SNOWBALL = "#f2ede3";

// Story beats:
//   Loop (0–0.5s, `snowball-throw-arm`): a small paw-arm swings forward
//     and back in a pitching motion.
//   Loop (0–0.7s, `snowball-fly`, timed to the arm's forward swing): a
//     snowball launches off the paw and arcs away, fading near the edge
//     of frame — a clean throw, landing off-screen.
/** EVERYDAY-tier win scenario: the Winter.tsx/RabbitCarrotVictory ushanka
 * rabbit, winding up and landing a snowball throw. Same ears/fur/hat
 * vocabulary, new pitching arm. */
export default function RabbitSnowballToss() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 70, height: 78 }}>
        <span className="snowball-fly absolute rounded-full" style={{ width: 10, height: 10, left: 44, top: 30, background: SNOWBALL, border: "1px solid rgba(0,0,0,0.08)" }} />

        <span className="absolute rounded-full" style={{ width: 10, height: 26, left: 10, top: -18, background: FUR, transform: "rotate(-8deg)" }} />
        <span className="absolute rounded-full" style={{ width: 10, height: 26, right: 10, top: -18, background: FUR, transform: "rotate(8deg)" }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 16, left: 13, top: -14, background: FUR_SHADE, transform: "rotate(-8deg)" }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 16, right: 13, top: -14, background: FUR_SHADE, transform: "rotate(8deg)" }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 40, height: 40, top: 0, background: FUR }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 8, top: 2, background: HAT_TRIM }} />
          <span className="absolute rounded-full" style={{ width: 4, height: 4, top: 18, left: 11, background: INK }} />
          <span className="absolute rounded-full" style={{ width: 4, height: 4, top: 18, right: 11, background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 6, height: 5, top: 24, background: NOSE }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 28, bottom: 0, background: FUR }} />

        <span className="snowball-throw-arm absolute rounded-full" style={{ width: 8, height: 20, right: 4, top: 20, background: FUR, transformOrigin: "50% 0%" }} />
      </div>
    </div>
  );
}
