"use client";

const PETAL_COUNT = 8;
const PETAL_COLORS = ["#d63b2f", "#e0a934", "#241c15"];

/** One of CelebrationModal's randomized scenarios: a ring of Khokhloma-
 * palette (red/gold/black) folk-pattern petals blooming outward from a
 * center dot, staggered per petal. Each petal sits inside its own
 * full-size wrapper rotated around the container's center — the standard
 * div technique for arranging shapes on a circle without any SVG/trig
 * library. */
export default function Khokhloma() {
  const petals = Array.from({ length: PETAL_COUNT }, (_, i) => i);
  return (
    <div className="relative flex h-24 w-24 items-center justify-center" aria-hidden="true">
      {petals.map((i) => (
        <span
          key={i}
          className="absolute inset-0"
          style={{ transform: `rotate(${(360 / PETAL_COUNT) * i}deg)` }}
        >
          <span
            className="khokhloma-petal absolute rounded-full"
            style={{
              width: 12,
              height: 22,
              top: 2,
              left: "50%",
              marginLeft: -6,
              background: PETAL_COLORS[i % PETAL_COLORS.length],
              borderRadius: "60% 60% 50% 50% / 80% 80% 30% 30%",
              animationDelay: `${i * 0.05}s`,
            }}
          />
        </span>
      ))}
      <span
        className="khokhloma-petal absolute rounded-full"
        style={{ width: 26, height: 26, background: "#e0a934", animationDelay: "0.4s" }}
      />
    </div>
  );
}
