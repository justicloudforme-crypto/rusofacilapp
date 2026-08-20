"use client";

const SAMOVAR_BODY = "#c9962e";
const SAMOVAR_DARK = "#8a6a1e";
const SAMOVAR_LID = "#e0a934";
const TEAR = "#d8d0c2";

// Story beats:
//   Loop (0–1.6s, `steam-tear-drip`): one oversized, teardrop-shaped puff
//     of steam wells up at the spout and drips slowly down before fading —
//     not the small drifting wisps of the everyday samovar, one heavy,
//     deliberate "tear" at a time.
//   Phase (0.00–0.4s, `lid-sad-droop`, holds): the lid tips down further
//     and slower than SamovarCoolsDown's lid-slump — this samovar isn't
//     just out of steam, it's outright sulking.
/** EVERYDAY-tier fail scenario: the calm CelebrationSamovar (catalog/home/
 * Samovar.tsx) crying about it — reuses the same body, an even sadder lid
 * angle, and a single large "steam tear" instead of a wisp. */
export default function SamovarCriesPuff() {
  return (
    <div className="relative flex h-24 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 76 }}>
        <span className="lid-sad-droop absolute left-1/2" style={{ top: 0, marginLeft: -18, transformOrigin: "50% 100%" }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 10, height: 10, top: 0, background: SAMOVAR_LID }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-t-full" style={{ width: 30, height: 10, top: 8, background: SAMOVAR_LID }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-2xl" style={{ width: 44, height: 44, top: 16, background: SAMOVAR_BODY }} />
        <span className="absolute rounded-full" style={{ width: 10, height: 6, left: -4, top: 40, background: SAMOVAR_DARK }} />

        {/* The spout gets its own oversized teardrop, dripping straight
            down instead of curling up like steam normally would. */}
        <span className="steam-tear-drip absolute rounded-full" style={{ width: 8, height: 10, left: -8, top: 44, background: TEAR }} />

        <span className="absolute left-1/2 -translate-x-1/2 rounded-lg" style={{ width: 30, height: 12, top: 58, background: SAMOVAR_DARK }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 36, height: 5, top: 69, background: SAMOVAR_DARK }} />
      </div>
    </div>
  );
}
