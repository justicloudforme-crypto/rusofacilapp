"use client";

const SNOW = "#f2ede3";
const COAL = "#241c15";
const CARROT = "#e0a934";

const SNOWMEN_DELAYS = [0, 0.15, 0.3];

// Story beats:
//   Loop (0–0.6s, `conga-bob`, staggered ×3 by delay): three snowmen bob
//     up and down in sequence rather than in unison — the delay between
//     each one is what reads as "line dance" instead of "three snowmen
//     jumping at once".
/** STREAK-tier win scenario: three SnowmanDisco-style snowmen forming a
 * conga line — busier and more crowded than the solo everyday snowman
 * scenarios, reserved for a correct-answer streak. Same three-ball
 * silhouette repeated at a smaller scale. */
export default function SnowmanCongaLine() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      {SNOWMEN_DELAYS.map((delay, i) => (
        <div key={i} className="conga-bob relative" style={{ width: 44, height: 64, animationDelay: `${delay}s` }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 40, height: 40, bottom: 0, background: SNOW }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 28, height: 28, bottom: 30, background: SNOW }} />
          <span className="absolute rounded-full" style={{ width: 3, height: 3, bottom: 44, left: "40%", background: COAL }} />
          <span className="absolute rounded-full" style={{ width: 3, height: 3, bottom: 44, left: "54%", background: COAL }} />
          <span className="absolute" style={{ bottom: 40, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "3px 4px 3px 0", borderColor: `transparent ${CARROT} transparent transparent` }} />
        </div>
      ))}
    </div>
  );
}
