"use client";

const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const SPARK_COLORS = ["#e0a934", "#d63b2f", "#2d5f8a"];

// Story beats:
//   Phase 1 (0.00–0.45s, `helicopter-spin-up`, on the flap pair): the two
//     ear flaps — reimagined as rotor blades through the crown's center —
//     spin from a standstill up to a blur, accelerating the whole time.
//   Phase 2 (0.35–1.1s, `helicopter-liftoff`, on the whole hat, holds at
//     the top): once the blades are near full speed the hat lifts
//     straight up off an implied head and holds there airborne.
//   Loop (0.5s onward, `helicopter-flash`, staggered ×3, positioned under
//     the hat): little sparkle bursts flash where the ground used to be —
//     the "under vspyshki" liftoff effect.
/** MILESTONE-tier win scenario: the ushanka itself is the protagonist —
 * its ear flaps become rotor blades and it takes off. Reuses the same
 * ushanka crown/band/pompom shapes as CelebrationBear, just detached from
 * a head. */
export default function UshankaHelicopter() {
  const flashes = [
    { left: "12%", delay: "0s" },
    { left: "48%", delay: "0.35s" },
    { left: "78%", delay: "0.7s" },
  ];
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      {flashes.map((f, i) => (
        <span
          key={i}
          className="helicopter-flash absolute bottom-2 rounded-full"
          style={{ width: 10, height: 10, left: f.left, background: SPARK_COLORS[i], animationDelay: f.delay }}
        />
      ))}

      <div className="helicopter-liftoff relative" style={{ width: 70, height: 50 }}>
        <span className="helicopter-spin-up absolute left-1/2 top-1/2" style={{ width: 64, height: 6, marginLeft: -32, marginTop: -3, background: HAT_FUR, borderRadius: 9999 }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-full" style={{ width: 42, height: 22, top: 12, background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 46, height: 10, top: 26, background: HAT_TRIM, borderRadius: 9999 }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 12, aspectRatio: "1", top: 0, background: HAT_TRIM }} />
      </div>
    </div>
  );
}
