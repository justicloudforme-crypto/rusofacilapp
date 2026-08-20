"use client";

const ROOF = "#5c3b26";
const WALL = "#8a5a3a";
const WALL_LINE = "#6e4530";
const WINDOW_FRAME = "#e0a934";
const WINDOW_GLASS = "#2d5f8a";
const BURST_COLORS = ["#d63b2f", "#e0a934", "#2d5f8a", "#4a7a3a"];

// Story beats:
//   Loop (0–1s, `chimney-firework-burst`, staggered ×4): instead of the
//     calm Izba.tsx chimney wisp, four small bursts launch from the
//     chimney one after another and pop outward — the whole cabin is in
//     on the celebration.
/** MILESTONE-tier win scenario: the everyday Izba log cabin (catalog/home/
 * Izba.tsx), with its chimney shooting little fireworks instead of a
 * single steam wisp — reserved for a level-up/exam/badge moment. Same
 * wall/roof/window vocabulary, no new shapes beyond the burst dots. */
export default function IzbaFireworks() {
  const bursts = BURST_COLORS;
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 90, height: 90 }}>
        {bursts.map((color, i) => (
          <span
            key={i}
            className="chimney-firework-burst absolute rounded-full"
            style={{ width: 6, height: 6, left: `${64 + i * 4}%`, bottom: "94%", background: color, animationDelay: `${i * 0.22}s` }}
          />
        ))}

        <span className="absolute" style={{ left: "68%", top: 2, width: 8, height: 12, background: ROOF }} />
        <span className="absolute inset-x-0" style={{ top: 10, height: 20, background: ROOF, clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }} />
        <span className="absolute inset-x-1" style={{ top: 28, bottom: 0, background: WALL }}>
          {[16, 26, 36, 46, 56].map((top, i) => (
            <span key={i} className="absolute inset-x-0" style={{ top, height: 2, background: WALL_LINE, opacity: 0.5 }} />
          ))}
          <span className="absolute left-1/2 -translate-x-1/2 rounded" style={{ width: 22, height: 20, top: 12, background: WINDOW_FRAME }}>
            <span className="absolute inset-1" style={{ background: WINDOW_GLASS }} />
          </span>
        </span>
      </div>
    </div>
  );
}
