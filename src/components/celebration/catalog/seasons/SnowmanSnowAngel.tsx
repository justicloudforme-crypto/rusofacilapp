"use client";

const SNOW = "#f2ede3";
const COAL = "#241c15";
const CARROT = "#e0a934";

// Story beats:
//   Phase 1 (0.00–0.3s, `angel-flop-down`, holds): the whole snowman tips
//     onto its back — from the standing SnowmanDisco pose to lying flat.
//   Loop (0.3s onward, `angel-arm-sweep-out` / `angel-arm-sweep-in`,
//     mirrored left/right): the two stick arms sweep up-and-out, then back
//     in, over and over — a snow angel, made by a snowman, out of itself.
//   Loop (falling snow, `snowflake-piece`, reused from CelebrationWinter).
/** EVERYDAY-tier win scenario: SnowmanDisco's cousin having a quieter kind
 * of fun. Same three-ball-adjacent silhouette (here just head + body,
 * lying down reads better with two balls than three), same coal/carrot
 * face vocabulary. */
export default function SnowmanSnowAngel() {
  return (
    <div className="relative h-28 w-full max-w-[200px] overflow-hidden" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          className="snowflake-piece select-none text-white"
          style={{ left: `${i * 17}%`, fontSize: 10 + (i % 3) * 3, animationDelay: `${i * 0.3}s`, animationDuration: `${2.6 + (i % 3) * 0.4}s` }}
        >
          ❄
        </span>
      ))}

      <div className="angel-flop-down absolute bottom-4 left-1/2" style={{ width: 74, height: 46, marginLeft: -37, transformOrigin: "50% 100%" }}>
        <span className="angel-arm-sweep-out absolute rounded-full" style={{ width: 26, height: 5, top: 14, left: -6, background: SNOW, transformOrigin: "right center" }} />
        <span className="angel-arm-sweep-in absolute rounded-full" style={{ width: 26, height: 5, top: 14, right: -6, background: SNOW, transformOrigin: "left center" }} />

        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 50, height: 42, bottom: 0, background: SNOW }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 30, height: 26, bottom: 30, background: SNOW }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 46, left: "42%", background: COAL }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 46, left: "54%", background: COAL }} />
        <span
          className="absolute"
          style={{ bottom: 44, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "3px 0 3px 5px", borderColor: `transparent transparent transparent ${CARROT}` }}
        />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-b-full" style={{ width: 12, height: 4, bottom: 38, background: COAL, opacity: 0.6 }} />
      </div>
    </div>
  );
}
