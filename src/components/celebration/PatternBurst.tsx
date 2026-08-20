"use client";

// Same Khokhloma-adjacent folk palette used across the celebration cast.
const COLORS = ["#d63b2f", "#e0a934", "#241c15", "#2d5f8a"];
const RAY_COUNT = 8;

/** A tiny radiating burst of folk-pattern dots — the "successful pair"
 * micro-flash for MatchBoard, distinct from FolkSpark's settle-in-place
 * pop: these rays fly outward and fade, reading as a quick celebratory
 * flash rather than a lingering reward badge. Pure div/CSS, ~8 nodes. */
export default function PatternBurst() {
  const rays = Array.from({ length: RAY_COUNT }, (_, i) => i);
  return (
    <span className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {rays.map((i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 h-full w-full"
          style={{ transform: `translate(-50%, -50%) rotate(${(360 / RAY_COUNT) * i}deg)` }}
        >
          <span
            className="pattern-burst-ray absolute left-1/2 top-0 rounded-full"
            style={{ width: 6, height: 6, marginLeft: -3, background: COLORS[i % COLORS.length] }}
          />
        </span>
      ))}
    </span>
  );
}
