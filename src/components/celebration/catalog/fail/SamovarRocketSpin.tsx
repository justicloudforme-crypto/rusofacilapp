"use client";

const SAMOVAR_BODY = "#c9962e";
const SAMOVAR_DARK = "#8a6a1e";
const SAMOVAR_LID = "#e0a934";
const STEAM = "#fff8ec";

// Story beats:
//   Phase 1 (0.00–0.5s, `lid-rocket-launch`, holds off-frame): the lid
//     shoots straight up and out of the picture — far faster and further
//     than SamovarLidRattle.tsx's jitter, this one leaves entirely.
//   Loop (0.2s onward, `samovar-panic-spin`, on the body): the whole
//     samovar spins in place instead of sitting still.
//   Loop (0–0.9s, `fountain-jet` reused (the steam-rise keyframe under a
//     new name), staggered ×6 around the body): jets erupt in every
//     direction — each on a statically rotated wrapper (a fixed angle
//     around the body) with the rise-and-fade animated on the inner span,
//     the same split PatternBurst.tsx and SamovarOverflowJoy.tsx use
//     whenever a fixed angle and an animated transform need to share a
//     spot.
/** EVERYDAY-tier fail scenario: the calm SamovarCozySteam win, boiling
 * over into a full meltdown — same body vocabulary as every other
 * samovar scene, reusing the steam-rise keyframe wholesale under the
 * fountain-jet name. */
export default function SamovarRocketSpin() {
  const jets = [0, 1, 2, 3, 4, 5];
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 76 }}>
        {jets.map((i) => (
          <span
            key={i}
            className="absolute left-1/2"
            style={{ top: 30, width: 0, height: 0, transform: `rotate(${(360 / jets.length) * i}deg)` }}
          >
            <span
              className="fountain-jet absolute rounded-full bg-white"
              style={{ width: 4, height: 14, left: -2, background: STEAM, opacity: 0.6, animationDelay: `${i * 0.08}s` }}
            />
          </span>
        ))}

        <span className="lid-rocket-launch absolute left-1/2" style={{ top: 0, marginLeft: -18 }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 10, height: 10, top: 0, background: SAMOVAR_LID }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-t-full" style={{ width: 30, height: 10, top: 8, background: SAMOVAR_LID }} />
        </span>

        <div className="samovar-panic-spin relative">
          <span className="absolute left-1/2 -translate-x-1/2 rounded-2xl" style={{ width: 44, height: 44, top: 16, background: SAMOVAR_BODY }} />
          <span className="absolute rounded-full" style={{ width: 10, height: 6, left: -4, top: 40, background: SAMOVAR_DARK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-lg" style={{ width: 30, height: 12, top: 58, background: SAMOVAR_DARK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 36, height: 5, top: 69, background: SAMOVAR_DARK }} />
        </div>
      </div>
    </div>
  );
}
