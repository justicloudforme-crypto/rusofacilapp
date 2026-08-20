"use client";

const FUR = "#f2ede3";
const FUR_SHADE = "#d8d0c2";
const INK = "#241c15";
const NOSE = "#d63b2f";
const HAT = "#241c15";
const HAT_BAND = "#e0a934";
const PETAL_COLORS = ["#d63b2f", "#e0a934", "#2d5f8a"];

// Story beats:
//   Phase 1 (0.00–0.4s, `hat-pull-reveal`, holds risen): a bundle rises
//     smoothly up out of the top hat, paw still on it — a clean magic
//     trick.
//   Loop (0.3s onward, `khokhloma-petal` reused, staggered ×3): three
//     flowers on the bundle bloom open once it clears the hat's rim.
/** EVERYDAY-tier win scenario: a rabbit stage magician pulling a festive
 * bouquet from a top hat. Same ears/fur vocabulary as the Winter.tsx
 * rabbit, new magician prop. */
export default function HareHatBouquet() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 60, height: 90 }}>
        <span className="hat-pull-reveal absolute left-1/2 -translate-x-1/2" style={{ bottom: 40, width: 20, height: 20 }}>
          {PETAL_COLORS.map((color, i) => (
            <span key={i} className="absolute inset-0" style={{ transform: `rotate(${i * 60}deg)` }}>
              <span className="khokhloma-petal absolute rounded-full" style={{ width: 8, height: 12, top: -2, left: "50%", marginLeft: -4, background: color, animationDelay: `${0.3 + i * 0.08}s` }} />
            </span>
          ))}
        </span>

        <span className="absolute rounded-full" style={{ width: 10, height: 26, left: 12, top: 6, background: FUR, transform: "rotate(-8deg)" }} />
        <span className="absolute rounded-full" style={{ width: 10, height: 26, right: 12, top: 6, background: FUR, transform: "rotate(8deg)" }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 16, left: 15, top: 10, background: FUR_SHADE, transform: "rotate(-8deg)" }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 16, right: 15, top: 10, background: FUR_SHADE, transform: "rotate(8deg)" }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 40, height: 40, top: 26, background: FUR }}>
          <span className="absolute rounded-full" style={{ width: 4, height: 4, top: 18, left: 11, background: INK }} />
          <span className="absolute rounded-full" style={{ width: 4, height: 4, top: 18, right: 11, background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 6, height: 5, top: 24, background: NOSE }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 28, bottom: 0, background: FUR }} />

        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-full" style={{ width: 44, height: 8, bottom: 34, background: HAT_BAND }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-md" style={{ width: 34, height: 30, bottom: 38, background: HAT }} />
      </div>
    </div>
  );
}
