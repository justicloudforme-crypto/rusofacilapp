"use client";

const FUR = "#f2ede3";
const FUR_SHADE = "#d8d0c2";
const INK = "#241c15";
const NOSE = "#d63b2f";
const HAT = "#241c15";
const HAT_BAND = "#e0a934";
const BOOT = "#d63b2f";
const BOOT_SOLE = "#241c15";

// Story beats:
//   Phase 1 (0.00–0.4s, `hat-pull-reveal` reused from HareHatBouquet.tsx):
//     the same clean rise out of the hat — right up until it's clear
//     what actually came out.
//   Phase 2 (0.35–0.6s, `boot-bonk-recoil`, on the rabbit's head, holds
//     tipped back): the oversized boot swings down and bonks him on the
//     forehead, snapping his head back.
/** EVERYDAY-tier fail scenario: the HareHatBouquet win, gone wrong — a
 * giant clown boot instead of flowers (or a carrot). Reuses
 * hat-pull-reveal wholesale for the rise. */
export default function HareHatFailBoot() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 60, height: 90 }}>
        <span className="hat-pull-reveal absolute left-1/2 -translate-x-1/2" style={{ bottom: 40, width: 34, height: 20 }}>
          <span className="absolute inset-x-0 bottom-0 rounded-lg" style={{ height: 14, background: BOOT }} />
          <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 6, background: BOOT_SOLE }} />
          <span className="absolute rounded-t-lg" style={{ width: 12, height: 16, top: -2, left: 2, background: BOOT }} />
        </span>

        <div className="boot-bonk-recoil relative" style={{ width: 60, height: 90, transformOrigin: "50% 100%" }}>
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
    </div>
  );
}
