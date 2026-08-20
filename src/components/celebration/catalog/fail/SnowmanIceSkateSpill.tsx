"use client";

const SNOW = "#f2ede3";
const COAL = "#241c15";
const CARROT = "#e0a934";
const ICE = "#c7dff0";

// Story beats:
//   Phase 1 (0.00–0.35s, `valenki-slip` reused from BearValenkiSlip.tsx,
//     mirrored on both snowmen): instead of the smooth shared circle from
//     SnowmanIceSkatingDuo.tsx, both skaters pitch backward onto the ice
//     at once — same topple physics, just two of them.
/** EVERYDAY-tier fail scenario: the SnowmanIceSkatingDuo win, spilled
 * instead of gliding. Same ice sheet and three-ball silhouettes; reuses
 * the valenki-slip topple keyframe wholesale for both skaters. */
export default function SnowmanIceSkateSpill() {
  return (
    <div className="relative flex h-28 items-center justify-center gap-2" aria-hidden="true">
      <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 100, height: 40, background: ICE, opacity: 0.4 }} />

      {[0, 1].map((i) => (
        <div key={i} className="valenki-slip relative" style={{ width: 40, height: 50, transformOrigin: "50% 100%", animationDelay: `${i * 0.08}s` }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 34, bottom: 0, background: SNOW }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 22, height: 22, bottom: 26, background: SNOW }} />
          <span className="absolute rounded-full" style={{ width: 3, height: 3, bottom: 38, left: "38%", background: COAL }} />
          <span className="absolute rounded-full" style={{ width: 3, height: 3, bottom: 38, left: "56%", background: COAL }} />
          <span className="absolute" style={{ bottom: 34, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "3px 4px 3px 0", borderColor: `transparent ${CARROT} transparent transparent` }} />
        </div>
      ))}
    </div>
  );
}
