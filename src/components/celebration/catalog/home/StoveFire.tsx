"use client";

const BRICK = "#c9962e";
const BRICK_LINE = "#8a6a1e";
const OPENING = "#2a1d16";
const FLAME_OUTER = "#e0a934";
const FLAME_INNER = "#d63b2f";

/** One of CelebrationModal's randomized scenarios: a Russian stove (печь)
 * with a flickering fairy-tale fire in its opening — same plain-div
 * technique, the "flicker" is just a scaleY/opacity keyframe on two
 * layered flame shapes. */
export default function StoveFire() {
  return (
    <div className="relative flex h-24 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 84, height: 76 }}>
        <span className="absolute inset-0 rounded-t-2xl" style={{ background: BRICK }} />
        <span className="absolute inset-x-2" style={{ top: 18, height: 3, background: BRICK_LINE, opacity: 0.5 }} />
        <span className="absolute inset-x-2" style={{ top: 38, height: 3, background: BRICK_LINE, opacity: 0.5 }} />
        <span className="absolute inset-x-2" style={{ top: 58, height: 3, background: BRICK_LINE, opacity: 0.5 }} />
        <span
          className="absolute left-1/2 -translate-x-1/2 rounded-t-full"
          style={{ width: 46, height: 40, bottom: 6, background: OPENING }}
        >
          <span
            className="flame-flicker absolute left-1/2 -translate-x-1/2 rounded-t-full"
            style={{ width: 22, height: 26, bottom: 2, background: FLAME_OUTER, transformOrigin: "50% 100%" }}
          />
          <span
            className="flame-flicker absolute left-1/2 -translate-x-1/2 rounded-t-full"
            style={{ width: 12, height: 16, bottom: 2, background: FLAME_INNER, transformOrigin: "50% 100%", animationDelay: "0.2s" }}
          />
        </span>
      </div>
    </div>
  );
}
