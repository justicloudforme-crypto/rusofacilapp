"use client";

const SAMOVAR_BODY = "#c9962e";
const SAMOVAR_DARK = "#8a6a1e";
const SAMOVAR_LID = "#e0a934";
const STEAM = "#fff8ec";

// Story beats:
//   Loop (0–1.8s, `genie-swirl-rise`): a tall ribbon of steam corkscrews
//     up from the spout, widening and curling as it climbs — a bigger,
//     more deliberate shape than the everyday samovar's two small wisps.
//   Loop (0–0.9s, `sparkle-twinkle` reused, staggered ×2 near the top):
//     a couple of glints pop where the steam curls widest.
/** MILESTONE-tier win scenario: the calm CelebrationSamovar body
 * (catalog/home/Samovar.tsx), its steam swelling into one tall genie-like
 * curl instead of two small wisps — reserved for a level-up/exam/badge
 * moment. Same samovar silhouette shared across the whole home/ folder. */
export default function SamovarSteamGenie() {
  return (
    <div className="relative flex h-32 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 76 }}>
        <span className="genie-swirl-rise absolute rounded-full" style={{ width: 10, height: 24, left: "36%", top: -30, background: STEAM, opacity: 0.75 }} />
        <span
          className="sparkle-twinkle absolute select-none text-sm"
          style={{ top: -34, left: "56%", animationDelay: "0.5s" }}
        >
          ✨
        </span>
        <span
          className="sparkle-twinkle absolute select-none text-xs"
          style={{ top: -20, left: "30%", animationDelay: "0.9s" }}
        >
          ✨
        </span>

        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 10, height: 10, top: 0, background: SAMOVAR_LID }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-full" style={{ width: 30, height: 10, top: 8, background: SAMOVAR_LID }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-2xl" style={{ width: 44, height: 44, top: 16, background: SAMOVAR_BODY }} />
        <span className="absolute rounded-full" style={{ width: 10, height: 6, left: -4, top: 40, background: SAMOVAR_DARK }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-lg" style={{ width: 30, height: 12, top: 58, background: SAMOVAR_DARK }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 36, height: 5, top: 69, background: SAMOVAR_DARK }} />
      </div>
    </div>
  );
}
