"use client";

const PAN_BODY = "#2a1d16";
const PAN_HANDLE = "#3a2a20";
const PANCAKE = "#e0a934";
const PANCAKE_SPOT = "#c9962e";
const BUTTER = "#fff8ec";

/** One of CelebrationModal's randomized scenarios: a blini (pancake)
 * flipping in a skillet, a nod to Maslenitsa. Same plain-div technique —
 * the "flip" is a squash-and-rotate on the pancake disc, no image/SVG. */
export default function Pancakes() {
  return (
    <div className="relative flex h-24 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 100, height: 44 }}>
        <span className="absolute rounded-full" style={{ width: 80, height: 24, left: 10, bottom: 0, background: PAN_BODY }} />
        <span className="absolute" style={{ width: 34, height: 8, right: -26, bottom: 8, background: PAN_HANDLE, borderRadius: 9999 }} />
        <span
          className="pancake-flip absolute rounded-full"
          style={{ width: 52, height: 12, left: 24, bottom: 20, background: PANCAKE, transformOrigin: "50% 100%" }}
        >
          <span className="absolute rounded-full" style={{ width: 6, height: 4, top: 3, left: 10, background: PANCAKE_SPOT, opacity: 0.6 }} />
          <span className="absolute rounded-full" style={{ width: 6, height: 4, top: 3, left: 30, background: PANCAKE_SPOT, opacity: 0.6 }} />
          <span className="absolute rounded-full" style={{ width: 8, height: 5, top: 1, left: 22, background: BUTTER, opacity: 0.9 }} />
        </span>
      </div>
    </div>
  );
}
