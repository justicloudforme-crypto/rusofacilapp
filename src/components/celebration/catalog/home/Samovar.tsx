"use client";

// Fixed (theme-independent) palette — same "literal painted object"
// reasoning as MatryoshkaMark.tsx.
const SAMOVAR_BODY = "#c9962e";
const SAMOVAR_DARK = "#8a6a1e";
const SAMOVAR_LID = "#e0a934";
const CUP_TRIM = "#2d5f8a";
const BARANKA = "#c9962e";

/** One of CelebrationModal's randomized scenarios: a samovar with rising
 * steam, and a teacup with baranki (bagel-rings) popping in beside it.
 * Same plain-div technique as the rest of the celebration cast — no
 * image/SVG asset. The "hole" in cup handle/baranki is a transparent
 * center inside a colored ring border, not a cutout. */
export default function Samovar() {
  return (
    <div className="relative flex h-24 items-end justify-center gap-3" aria-hidden="true">
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

      <div className="teacup-pop-in relative" style={{ width: 40, height: 34, animationDelay: "0.5s" }}>
        <span
          className="absolute left-1/2 -translate-x-1/2 rounded-b-2xl border-2"
          style={{ width: 30, height: 18, bottom: 4, background: "var(--background)", borderColor: CUP_TRIM }}
        />
        <span
          className="absolute rounded-full border-2"
          style={{ width: 8, height: 10, right: -2, bottom: 8, borderColor: CUP_TRIM }}
        />
        <span
          className="absolute rounded-full border-2"
          style={{ width: 12, height: 12, left: -2, top: -6, borderColor: BARANKA }}
        />
        <span
          className="absolute rounded-full border-2"
          style={{ width: 11, height: 11, left: 9, top: -10, borderColor: BARANKA }}
        />
      </div>
    </div>
  );
}
