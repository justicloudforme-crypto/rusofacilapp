"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const SLED_WOOD = "#5c3b26";
const SLED_TRIM = "#e0a934";
const SNOW = "#f2ede3";
const GIFT_COLORS = ["#d63b2f", "#2d5f8a", "#4a7a3a"];

// Story beats:
//   Loop (0–0.5s, `sled-glide` reused from TroikaSled.tsx): the whole rig
//     rocks forward-and-back and bobs, same "moving fast" shorthand as
//     the troika and SnowmanSledding.
//   Loop (0–0.6s, `trail-streak` reused, staggered ×4): speed lines stream
//     out behind the sled and fade.
//   Loop (0–1.6s, `bear-bounce` reused): the bear pulling the sled keeps
//     up a small triumphant bounce the whole time.
/** MILESTONE-tier win scenario: a bear pulling a sled stacked with
 * wrapped gifts — bigger and busier than the everyday pool, reserved for
 * a level-up/exam/badge moment. Reuses TroikaSled.tsx's glide/trail
 * keyframes wholesale. */
export default function BearSledGiftDelivery() {
  const trails = [0, 1, 2, 3];
  return (
    <div className="relative flex h-28 w-full max-w-[220px] items-end justify-center overflow-hidden" aria-hidden="true">
      {trails.map((i) => (
        <span
          key={i}
          className="trail-streak absolute"
          style={{ width: 14, height: 3, bottom: 10 + i * 6, right: "70%", background: SNOW, borderRadius: 9999, animationDelay: `${i * 0.12}s` }}
        />
      ))}

      <div className="bear-bounce relative" style={{ width: 60, height: 60, marginRight: 4 }}>
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", left: "6%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", right: "6%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "70%", aspectRatio: "1", top: "10%", background: FUR }}>
          <span className="absolute rounded-b-full" style={{ width: "16%", height: "36%", top: "38%", left: "-6%", background: HAT_FUR }} />
          <span className="absolute rounded-b-full" style={{ width: "16%", height: "36%", top: "38%", right: "-6%", background: HAT_FUR }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "84%", height: "12%", top: "16%", background: HAT_TRIM, borderRadius: 9999 }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "80%", height: "32%", top: "-10%", background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "56%", height: "38%", top: "50%", background: MUZZLE }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", left: "27%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", right: "27%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "13%", height: "9%", top: "56%", background: INK }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />
      </div>

      <div className="sled-glide relative" style={{ width: 100, height: 60 }}>
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-1">
          {GIFT_COLORS.map((color, i) => (
            <span key={i} className="relative rounded-sm" style={{ width: 22, height: 18 + (i % 2) * 8, background: color }}>
              <span className="absolute inset-x-0 top-1/2 -translate-y-1/2" style={{ height: 3, background: SLED_TRIM }} />
              <span className="absolute inset-y-0 left-1/2 -translate-x-1/2" style={{ width: 3, background: SLED_TRIM }} />
            </span>
          ))}
        </span>
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-xl" style={{ width: 96, height: 12, background: SLED_WOOD }}>
          <span className="absolute inset-x-0 top-0" style={{ height: 3, background: SLED_TRIM }} />
        </span>
      </div>
    </div>
  );
}
