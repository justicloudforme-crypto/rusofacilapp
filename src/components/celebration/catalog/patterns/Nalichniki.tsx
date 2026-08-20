"use client";

const FRAME = "#2d5f8a";
const CARVING = "#e0a934";
const GLASS = "#fff8ec";

/** One of CelebrationModal's randomized scenarios: a carved wooden window
 * frame (наличники) blooming in with a small shine sweeping across the
 * glass. Same plain-div technique — the scalloped top edge is a row of
 * small rotated squares, no image/SVG. */
export default function Nalichniki() {
  const scallops = Array.from({ length: 5 }, (_, i) => i);
  return (
    <div className="relative flex h-24 items-center justify-center" aria-hidden="true">
      <div className="doll-cascade-piece relative" style={{ width: 66, height: 78 }}>
        <span className="absolute inset-x-1 flex justify-between" style={{ top: -6 }}>
          {scallops.map((i) => (
            <span
              key={i}
              className="khokhloma-petal"
              style={{ width: 9, height: 9, background: CARVING, transform: "rotate(45deg)", animationDelay: `${i * 0.06}s` }}
            />
          ))}
        </span>
        <span className="absolute inset-0" style={{ border: `5px solid ${FRAME}` }}>
          <span className="absolute inset-1.5" style={{ background: GLASS }}>
            <span className="nalichniki-shine absolute inset-y-0" style={{ width: "40%", background: "linear-gradient(120deg, transparent, rgba(255,255,255,0.7), transparent)" }} />
          </span>
        </span>
        <span className="absolute rounded-full" style={{ width: 6, aspectRatio: "1", top: -3, left: -3, background: CARVING }} />
        <span className="absolute rounded-full" style={{ width: 6, aspectRatio: "1", top: -3, right: -3, background: CARVING }} />
        <span className="absolute rounded-full" style={{ width: 6, aspectRatio: "1", bottom: -3, left: -3, background: CARVING }} />
        <span className="absolute rounded-full" style={{ width: 6, aspectRatio: "1", bottom: -3, right: -3, background: CARVING }} />
      </div>
    </div>
  );
}
