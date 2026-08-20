"use client";

const SAMOVAR_BODY = "#c9962e";
const SAMOVAR_DARK = "#8a6a1e";
const SAMOVAR_LID = "#e0a934";
const CUP_TRIM = "#2d5f8a";
const TEA = "#8a4a1e";

// Story beats:
//   Loop (0–1.8s, `steam-rise` reused, from the spout): a wisp climbs and
//     widens like every other samovar scenario in the catalog.
//   Loop (0–0.6s, `teacup-pop-in` reused, delayed to land right as the
//     wisp fades): a full teacup pops into existence right where the
//     steam disappears — the wisp "becomes" the cup rather than the cup
//     just appearing beside it.
/** EVERYDAY-tier win scenario: the calm CelebrationSamovar (catalog/home/
 * Samovar.tsx) at a full boil, its steam settling into a ready cup of tea.
 * Same body/steam vocabulary as the rest of the home/ folder, reuses
 * steam-rise and teacup-pop-in wholesale. */
export default function SamovarBoilTea() {
  return (
    <div className="relative flex h-24 items-end justify-center gap-3" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 76 }}>
        <span className="steam-wisp absolute rounded-full bg-white" style={{ width: 5, height: 18, left: "40%", top: -10, opacity: 0.65 }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 10, height: 10, top: 0, background: SAMOVAR_LID }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-full" style={{ width: 30, height: 10, top: 8, background: SAMOVAR_LID }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-2xl" style={{ width: 44, height: 44, top: 16, background: SAMOVAR_BODY }} />
        <span className="absolute rounded-full" style={{ width: 10, height: 6, left: -4, top: 40, background: SAMOVAR_DARK }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-lg" style={{ width: 30, height: 12, top: 58, background: SAMOVAR_DARK }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 36, height: 5, top: 69, background: SAMOVAR_DARK }} />
      </div>

      <div className="teacup-pop-in relative" style={{ width: 40, height: 34, animationDelay: "1.2s" }}>
        <span
          className="absolute left-1/2 -translate-x-1/2 rounded-b-2xl border-2"
          style={{ width: 30, height: 18, bottom: 4, background: "var(--background)", borderColor: CUP_TRIM, overflow: "hidden" }}
        >
          <span className="absolute inset-x-0 bottom-0" style={{ height: 14, background: TEA }} />
        </span>
        <span className="absolute rounded-full border-2" style={{ width: 8, height: 10, right: -2, bottom: 8, borderColor: CUP_TRIM }} />
        <span className="steam-wisp absolute rounded-full bg-white" style={{ width: 3, height: 10, left: "42%", top: -4, opacity: 0.5, animationDelay: "1.3s" }} />
      </div>
    </div>
  );
}
