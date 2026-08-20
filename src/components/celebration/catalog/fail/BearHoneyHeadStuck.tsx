"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const INK = "#241c15";
const BARREL = "#5c3b26";
const BARREL_BAND = "#3a2a20";
const HONEY = "#e0a934";

// Story beats:
//   Phase 1 (0.00–0.4s, `barrel-tip-over`, on the outer wrapper, holds
//     upended): the whole barrel tips forward and drops straight down
//     over his head — the opposite of BearHoneyBarrelStuck.tsx's slow
//     wade-in, this one is a single dunking. Kept on its own wrapper
//     (rather than combined with the wiggle below) because a CSS
//     animation on `transform` fully replaces any other transform on the
//     same element — two elements is what lets both play at once.
//   Loop (0.3s onward, `barrel-wiggle` reused from BearHoneyBarrelStuck.tsx,
//     on an inner wrapper): the same struggle wobble, now applied to a
//     barrel worn like a hat instead of one he's standing inside.
//   Loop (0–1.6s, `honey-drip` reused ×2, staggered): honey drips down
//     from under the barrel's rim.
/** EVERYDAY-tier fail scenario: an entire barrel of honey tipping over
 * and landing square on the bear's head — only his ears and paws stick
 * out underneath. A distinct gag from BearHoneyBarrelStuck.tsx's
 * standing-inside predicament; reuses barrel-wiggle and honey-drip. */
export default function BearHoneyHeadStuck() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 76, height: 90 }}>
        <span className="honey-drip absolute rounded-full" style={{ width: 5, height: 6, top: 46, left: 18, background: HONEY, animationDelay: "0.2s" }} />
        <span className="honey-drip absolute rounded-full" style={{ width: 5, height: 6, top: 46, right: 18, background: HONEY, animationDelay: "0.9s" }} />

        <span className="absolute rounded-full" style={{ width: "20%", aspectRatio: "1", top: "46%", left: "2%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "20%", aspectRatio: "1", top: "46%", right: "2%", background: FUR }} />

        <div className="barrel-tip-over absolute left-1/2 -translate-x-1/2" style={{ top: 0, width: 54, height: 50, transformOrigin: "50% 100%" }}>
          <div className="barrel-wiggle relative h-full w-full">
            <span className="absolute inset-0 rounded-t-2xl" style={{ background: BARREL }}>
              <span className="absolute inset-x-0" style={{ top: 8, height: 4, background: BARREL_BAND }} />
              <span className="absolute inset-x-0 bottom-0" style={{ height: 4, background: BARREL_BAND }} />
            </span>
          </div>
        </div>

        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 30, height: 18, top: 66, background: MUZZLE, opacity: 0.5 }} />
        <span className="absolute rounded-full" style={{ width: 3, height: 3, top: 72, left: "42%", background: INK, opacity: 0.5 }} />
        <span className="absolute rounded-full" style={{ width: 3, height: 3, top: 72, left: "54%", background: INK, opacity: 0.5 }} />

        <span className="absolute inset-x-0 bottom-0 rounded-t-2xl" style={{ height: 30, background: FUR }} />
      </div>
    </div>
  );
}
