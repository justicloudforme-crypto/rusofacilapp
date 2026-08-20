"use client";

const SAMOVAR_BODY = "#c9962e";
const SAMOVAR_DARK = "#8a6a1e";
const SAMOVAR_LID = "#e0a934";
const SPARK_COLORS = ["#d63b2f", "#e0a934", "#241c15", "#2d5f8a"];

// Story beats:
//   Loop (0–0.7s, `overflow-burst`, staggered ×6): little folk-pattern
//     sparks erupt from the lid instead of the everyday CelebrationSamovar's
//     calm steam wisps — the samovar got too excited to just steam quietly.
/** EVERYDAY-tier win scenario: the calm CelebrationSamovar (catalog/home/
 * Samovar.tsx), but celebrating — same body shape, replacing its gentle
 * steam with an eruption of Gorodets-palette sparks. */
export default function SamovarOverflowJoy() {
  const sparks = Array.from({ length: 6 }, (_, i) => i);
  return (
    <div className="relative flex h-24 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 76 }}>
        {sparks.map((i) => (
          // Static rotate on the wrapper (fans the sparks out around the
          // lid), animated translateY on the inner span (moves each spark
          // outward along its own rotated axis) — kept on separate
          // elements because a CSS animation on `transform` fully replaces
          // any inline `transform`, so the two can't share one span.
          <span
            key={i}
            className="absolute left-1/2"
            style={{ top: 4, width: 0, height: 0, transform: `rotate(${(i - 2.5) * 22}deg)` }}
          >
            <span
              className="overflow-burst absolute rounded-full"
              style={{
                width: 6,
                height: 6,
                left: -3,
                background: SPARK_COLORS[i % SPARK_COLORS.length],
                animationDelay: `${i * 0.08}s`,
              }}
            />
          </span>
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
