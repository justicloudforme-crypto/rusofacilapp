"use client";

const SAMOVAR_BODY = "#c9962e";
const SAMOVAR_DARK = "#8a6a1e";
const SAMOVAR_LID = "#e0a934";
const STEAM = "#fff8ec";

// Story beats:
//   Loop (0–0.3s, `lid-rattle-shake`): the lid jitters side to side and up
//     a few pixels instead of sitting still — over-pressured, not calmly
//     boiled like SamovarBoilTea.tsx's.
//   Loop (0–0.9s, `steam-sideways`): instead of a wisp climbing straight
//     up, a jet of steam hisses out sideways from under the rattling lid —
//     a static rotate on the wrapper (fixed sideways angle) with the
//     climb-and-fade animated on the inner span, the same split needed
//     whenever a static and an animated transform share a spot (see
//     PatternBurst.tsx for the same technique).
/** EVERYDAY-tier fail scenario: the calm CelebrationSamovar (catalog/home/
 * Samovar.tsx) over-pressured instead of steaming steadily. Same body
 * vocabulary; only the lid and steam direction change. */
export default function SamovarLidRattle() {
  return (
    <div className="relative flex h-24 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 76 }}>
        <span className="absolute left-1/2" style={{ top: 4, width: 0, height: 0, transform: "rotate(-40deg)" }}>
          <span className="steam-sideways absolute rounded-full" style={{ width: 5, height: 16, left: -2, background: STEAM, opacity: 0.7 }} />
        </span>

        <span className="lid-rattle-shake absolute left-1/2" style={{ top: 0, marginLeft: -18 }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 10, height: 10, top: 0, background: SAMOVAR_LID }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-t-full" style={{ width: 30, height: 10, top: 8, background: SAMOVAR_LID }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-2xl" style={{ width: 44, height: 44, top: 16, background: SAMOVAR_BODY }} />
        <span className="absolute rounded-full" style={{ width: 10, height: 6, left: -4, top: 40, background: SAMOVAR_DARK }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-lg" style={{ width: 30, height: 12, top: 58, background: SAMOVAR_DARK }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 36, height: 5, top: 69, background: SAMOVAR_DARK }} />
      </div>
    </div>
  );
}
