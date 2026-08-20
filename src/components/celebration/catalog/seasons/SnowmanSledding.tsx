"use client";

const SNOW = "#f2ede3";
const COAL = "#241c15";
const CARROT = "#e0a934";
const SLED_WOOD = "#5c3b26";
const SLED_TRIM = "#e0a934";

// Story beats:
//   Loop (0–0.5s, `sled-glide` reused from TroikaSled.tsx): the whole rig
//     rocks forward-and-back and bobs — same "moving fast without actually
//     translating" shorthand as the troika.
//   Loop (0–0.6s, `trail-streak` reused, staggered ×3): speed lines stream
//     out behind the sled and fade.
/** EVERYDAY-tier win scenario: the SnowmanDisco/SnowmanCongaLine snowman,
 * riding a sled downhill. Reuses TroikaSled.tsx's glide/trail keyframes
 * wholesale — the motion reads the same regardless of who's riding. */
export default function SnowmanSledding() {
  const trails = [0, 1, 2];
  return (
    <div className="relative flex h-28 w-full max-w-[200px] items-end justify-center overflow-hidden" aria-hidden="true">
      {trails.map((i) => (
        <span
          key={i}
          className="trail-streak absolute"
          style={{ width: 14, height: 3, bottom: 12 + i * 6, right: "58%", background: SNOW, borderRadius: 9999, animationDelay: `${i * 0.12}s` }}
        />
      ))}

      <div className="sled-glide relative" style={{ width: 90, height: 78 }}>
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2" style={{ width: 56, height: 56 }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 40, height: 40, bottom: 0, background: SNOW }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 26, height: 26, bottom: 30, background: SNOW }} />
          <span className="absolute rounded-full" style={{ width: 3, height: 3, bottom: 44, left: "38%", background: COAL }} />
          <span className="absolute rounded-full" style={{ width: 3, height: 3, bottom: 44, left: "56%", background: COAL }} />
          <span className="absolute" style={{ bottom: 40, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "3px 4px 3px 0", borderColor: `transparent ${CARROT} transparent transparent` }} />
        </span>

        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-lg" style={{ width: 78, height: 10, background: SLED_WOOD }}>
          <span className="absolute inset-x-0 top-0" style={{ height: 3, background: SLED_TRIM }} />
        </span>
      </div>
    </div>
  );
}
