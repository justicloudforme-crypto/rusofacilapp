"use client";

const SNOW = "#f2ede3";
const COAL = "#241c15";
const CARROT = "#e0a934";
const ICE = "#c7dff0";

// Story beats:
//   Loop (0–2.2s, `bear-glide-circle` reused from BearIceSkating.tsx,
//     mirrored on the second snowman): each snowman traces the same
//     four-waypoint circular glide as the ice-skating bear — one pair
//     started half a lap ahead of the other, so they read as skating
//     together rather than as two copies of the same loop.
/** EVERYDAY-tier win scenario: two SnowmanDisco-style snowmen skating a
 * shared circle on the same ice sheet — reuses the bear-glide-circle
 * keyframe wholesale, staggered so the pair reads as partnered skating. */
export default function SnowmanIceSkatingDuo() {
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 100, height: 40, background: ICE, opacity: 0.4 }} />

      <div className="relative" style={{ width: 100, height: 64 }}>
        <div className="bear-glide-circle absolute left-0" style={{ width: 40, height: 50 }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 34, bottom: 0, background: SNOW }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 22, height: 22, bottom: 26, background: SNOW }} />
          <span className="absolute rounded-full" style={{ width: 3, height: 3, bottom: 38, left: "38%", background: COAL }} />
          <span className="absolute rounded-full" style={{ width: 3, height: 3, bottom: 38, left: "56%", background: COAL }} />
          <span className="absolute" style={{ bottom: 34, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "3px 4px 3px 0", borderColor: `transparent ${CARROT} transparent transparent` }} />
        </div>
        <div className="bear-glide-circle absolute right-0" style={{ width: 40, height: 50, animationDelay: "-1.1s" }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 34, bottom: 0, background: SNOW }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 22, height: 22, bottom: 26, background: SNOW }} />
          <span className="absolute rounded-full" style={{ width: 3, height: 3, bottom: 38, left: "38%", background: COAL }} />
          <span className="absolute rounded-full" style={{ width: 3, height: 3, bottom: 38, left: "56%", background: COAL }} />
          <span className="absolute" style={{ bottom: 34, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "3px 4px 3px 0", borderColor: `transparent ${CARROT} transparent transparent` }} />
        </div>
      </div>
    </div>
  );
}
