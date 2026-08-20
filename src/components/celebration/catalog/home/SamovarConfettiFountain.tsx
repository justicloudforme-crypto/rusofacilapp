"use client";

const SAMOVAR_BODY = "#c9962e";
const SAMOVAR_DARK = "#8a6a1e";
const SAMOVAR_LID = "#e0a934";
const CONFETTI_COLORS = ["#d63b2f", "#e0a934", "#2d5f8a", "#4a7a3a", "#241c15"];

// Story beats:
//   Loop (0–1.1s, `confetti-fountain-shoot`, staggered ×8): little squares
//     launch straight up out of the lid, tumble, and arc back down past the
//     samovar's sides — a proper fountain, not the single-burst spark pop
//     from SamovarOverflowJoy.tsx.
/** STREAK-tier win scenario: the calm CelebrationSamovar body erupting into
 * a full confetti fountain instead of gentle steam — reserved for a
 * correct-answer streak, one notch bigger than the everyday SamovarOverflowJoy
 * spark burst. Reuses the same samovar silhouette both share. */
export default function SamovarConfettiFountain() {
  const pieces = Array.from({ length: 8 }, (_, i) => i);
  return (
    <div className="relative flex h-28 items-end justify-center overflow-visible" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 76 }}>
        {pieces.map((i) => (
          <span
            key={i}
            className="confetti-fountain-shoot absolute rounded-sm"
            style={{
              width: 6,
              height: 6,
              left: `${8 + i * 6}%`,
              bottom: "94%",
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${i * 0.09}s`,
            }}
          />
        ))}
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
