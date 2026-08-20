"use client";

const SNOW = "#f2ede3";
const COAL = "#241c15";
const CARROT = "#e0a934";

// Story beats:
//   Loop (0–0.9s, `juggle-arc` reused from MatryoshkaJuggler.tsx, staggered
//     ×3 by 0.3s each): three snowballs each fly up in a parabolic arc and
//     fall back down, one launch starting exactly as the previous one
//     lands — identical juggling cascade timing, just snowballs instead of
//     mini dolls.
/** EVERYDAY-tier win scenario: the SnowmanDisco/SnowmanCongaLine snowman,
 * juggling three snowballs. Same three-ball body silhouette; reuses the
 * juggle-arc keyframe wholesale since the physical arc is identical. */
export default function SnowmanSnowballJuggle() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 64, height: 78 }}>
        {[0, 0.3, 0.6].map((delay, i) => (
          <span
            key={i}
            className="juggle-arc absolute rounded-full"
            style={{ width: 12, height: 12, left: `${28 + i * 22}%`, bottom: 56, background: SNOW, border: "1px solid rgba(0,0,0,0.08)", animationDelay: `${delay}s` }}
          />
        ))}

        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 48, height: 48, bottom: 0, background: SNOW }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 34, bottom: 38, background: SNOW }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 58, left: "40%", background: COAL }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 58, left: "56%", background: COAL }} />
        <span className="absolute" style={{ bottom: 52, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "3px 5px 3px 0", borderColor: `transparent ${CARROT} transparent transparent` }} />
      </div>
    </div>
  );
}
