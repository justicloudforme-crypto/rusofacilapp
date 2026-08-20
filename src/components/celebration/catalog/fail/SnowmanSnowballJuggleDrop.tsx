"use client";

const SNOW = "#f2ede3";
const COAL = "#241c15";
const CARROT = "#e0a934";

// Story beats:
//   Phase 1 (0.00–0.6s, `pelmeni-scatter` reused, staggered ×3): the three
//     snowballs from SnowmanSnowballJuggle.tsx tumble and scatter across
//     the ground instead of arcing back up — same tumble-and-settle
//     physics as BearDropsPelmeni.tsx's spilled dumplings, just aimed
//     downward from a juggling height instead of a dropped bowl.
/** EVERYDAY-tier fail scenario: the SnowmanSnowballJuggle win, dropped.
 * Same three-ball snowman silhouette; reuses the pelmeni-scatter debris
 * keyframe wholesale for the fallen snowballs. */
export default function SnowmanSnowballJuggleDrop() {
  const balls = [
    { left: "6%", top: "78%", delay: "0.05s" },
    { left: "40%", top: "88%", delay: "0.18s" },
    { left: "70%", top: "80%", delay: "0.31s" },
  ];
  return (
    <div className="relative flex h-28 items-end justify-center overflow-hidden" aria-hidden="true">
      {balls.map((b, i) => (
        <span
          key={i}
          className="pelmeni-scatter absolute rounded-full"
          style={{ width: 12, height: 12, left: b.left, top: b.top, background: SNOW, border: "1px solid rgba(0,0,0,0.08)", animationDelay: b.delay }}
        />
      ))}

      <div className="relative" style={{ width: 64, height: 78 }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 48, height: 48, bottom: 0, background: SNOW }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 34, bottom: 38, background: SNOW }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 58, left: "40%", background: COAL }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 58, left: "56%", background: COAL }} />
        <span className="absolute" style={{ bottom: 52, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "3px 5px 3px 0", borderColor: `transparent ${CARROT} transparent transparent` }} />
      </div>
    </div>
  );
}
