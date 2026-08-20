"use client";

const TOP_BODY = "#e0a934";
const TOP_DARK = "#c9962e";
const PETAL_COLORS = ["#d63b2f", "#e0a934", "#241c15"];
const PETAL_COUNT = 6;

// Story beats:
//   Loop (0–0.35s, `top-spin-fast`): the whole top rotates hard and fast —
//     quicker and tighter than any other spin in the catalog, since a
//     spinning top's whole point is speed.
//   Loop (0–0.5s, `khokhloma-petal` reused, staggered ×6): the painted
//     petals around its widest point keep re-blooming in a tight loop,
//     standing in for a blurred pattern rather than actually blurring
//     anything (no filter/blur effects anywhere in this catalog).
/** STREAK-tier win scenario: a Khokhloma-painted spinning top (юла),
 * reusing Khokhloma.tsx's petal-bloom keyframe for the decoration and
 * adding a fast, tight spin on the body itself. */
export default function KhokhlomaSpinningTop() {
  const petals = Array.from({ length: PETAL_COUNT }, (_, i) => i);
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="top-spin-fast relative" style={{ width: 56, height: 56, transformOrigin: "50% 90%" }}>
        {petals.map((i) => (
          <span key={i} className="absolute inset-0" style={{ transform: `rotate(${(360 / PETAL_COUNT) * i}deg)` }}>
            <span
              className="khokhloma-petal absolute rounded-full"
              style={{ width: 8, height: 14, top: 6, left: "50%", marginLeft: -4, background: PETAL_COLORS[i % PETAL_COLORS.length], animationDelay: `${i * 0.05}s` }}
            />
          </span>
        ))}
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 40, height: 40, top: 6, background: TOP_BODY }} />
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 8, height: 14, bottom: 0, background: TOP_DARK, clipPath: "polygon(20% 0%, 80% 0%, 50% 100%)" }} />
      </div>
    </div>
  );
}
