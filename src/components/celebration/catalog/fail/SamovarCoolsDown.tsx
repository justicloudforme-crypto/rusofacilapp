"use client";

const SAMOVAR_BODY = "#c9962e";
const SAMOVAR_DARK = "#8a6a1e";
const SAMOVAR_LID = "#e0a934";
const WISP = "#c9c2b8";

// Story beats:
//   Phase 1 (0.00–0.4s, `lid-slump`): the lid tilts a few degrees off
//     true, like it just lost some air — deflated, not dramatic.
//   Loop (0–1.5s, `steam-fizzle`, staggered): instead of the everyday
//     CelebrationSamovar's steam rising and fading, these wisps sag
//     downward and shrink before disappearing — the fire went out.
/** EVERYDAY-tier fail scenario: the calm CelebrationSamovar (catalog/home/
 * Samovar.tsx) with the energy taken out of it — same body shape, an
 * askew lid and drooping steam instead of a confident brew. */
export default function SamovarCoolsDown() {
  return (
    <div className="relative flex h-24 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 76 }}>
        <span className="steam-fizzle absolute rounded-full" style={{ width: 4, height: 12, left: "38%", top: 2, background: WISP, opacity: 0.6, animationDelay: "0s" }} />
        <span className="steam-fizzle absolute rounded-full" style={{ width: 4, height: 10, left: "56%", top: 6, background: WISP, opacity: 0.5, animationDelay: "0.5s" }} />
        <span className="lid-slump absolute left-1/2" style={{ top: 0, marginLeft: -18, transformOrigin: "50% 100%" }}>
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
