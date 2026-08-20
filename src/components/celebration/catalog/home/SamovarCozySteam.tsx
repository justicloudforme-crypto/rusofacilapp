"use client";

const SAMOVAR_BODY = "#c9962e";
const SAMOVAR_DARK = "#8a6a1e";
const SAMOVAR_LID = "#e0a934";
const CUP_TRIM = "#2d5f8a";
const GLOW = "#e0a934";

// Story beats:
//   Loop (0–1.8s, `steam-wisp` reused ×2, staggered): two calm wisps rise
//     from the spout, same shape as every other everyday samovar scene.
//   Loop (0–1.2s, `warm-glow-pulse` reused from MatryoshkaDefrostGlow.tsx,
//     staggered ×2, behind each cup): a soft amber halo breathes behind
//     both waiting cups, reading as gentle warmth rather than the steam
//     alone.
/** EVERYDAY-tier win scenario: a samovar peacefully steaming and warming
 * two cups at once — the calm baseline this whole family of samovar
 * scenarios (SamovarBoilTea, SamovarLidRattle, SamovarRocketSpin) departs
 * from. Reuses steam-wisp and warm-glow-pulse wholesale. */
export default function SamovarCozySteam() {
  return (
    <div className="relative flex h-24 items-end justify-center gap-2" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 76 }}>
        <span className="steam-wisp absolute rounded-full bg-white" style={{ width: 4, height: 16, left: "38%", top: -6, opacity: 0.6, animationDelay: "0s" }} />
        <span className="steam-wisp absolute rounded-full bg-white" style={{ width: 4, height: 14, left: "56%", top: -2, opacity: 0.5, animationDelay: "0.5s" }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 10, height: 10, top: 0, background: SAMOVAR_LID }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-full" style={{ width: 30, height: 10, top: 8, background: SAMOVAR_LID }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-2xl" style={{ width: 44, height: 44, top: 16, background: SAMOVAR_BODY }} />
        <span className="absolute rounded-full" style={{ width: 10, height: 6, left: -4, top: 40, background: SAMOVAR_DARK }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-lg" style={{ width: 30, height: 12, top: 58, background: SAMOVAR_DARK }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 36, height: 5, top: 69, background: SAMOVAR_DARK }} />
      </div>

      {[0, 1].map((i) => (
        <div key={i} className="relative" style={{ width: 30, height: 30 }}>
          <span className="warm-glow-pulse absolute rounded-full" style={{ inset: -6, background: GLOW, opacity: 0.2, animationDelay: `${i * 0.3}s` }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-b-2xl border-2" style={{ width: 22, height: 14, bottom: 2, background: "var(--background)", borderColor: CUP_TRIM }} />
          <span className="absolute rounded-full border-2" style={{ width: 6, height: 7, right: -1, bottom: 5, borderColor: CUP_TRIM }} />
        </div>
      ))}
    </div>
  );
}
