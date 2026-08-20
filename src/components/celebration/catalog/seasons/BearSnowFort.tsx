"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const SNOW = "#f2ede3";
const SNOW_SHADE = "#d8d0c2";

// Story beats:
//   Loop (0–0.7s, `karavai-raise` reused from BearBakesKaravai.tsx): the
//     bear raises a snow block overhead and back down, same lift used for
//     the loaf/carrot/jar — a stand-in for "finishing the last brick".
//   Loop (0–0.9s, `sparkle-twinkle` reused, delayed): a shine marks the
//     fort's completion each time the block reaches the top of its raise.
/** EVERYDAY-tier win scenario: a bear finishing a snow fort, brick block
 * held up in triumph. Same fur/ushanka vocabulary as the rest of the bear
 * cast; the fort wall itself is a static row of snow blocks. */
export default function BearSnowFort() {
  const blocks = [0, 1, 2, 3];
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      <div className="relative" style={{ width: 66, height: 88 }}>
        <span className="karavai-raise absolute left-1/2 -translate-x-1/2 rounded-sm" style={{ width: 22, height: 16, top: -14, background: SNOW, transformOrigin: "50% 100%" }}>
          <span className="absolute inset-x-1 top-1" style={{ height: 2, background: SNOW_SHADE }} />
        </span>
        <span className="sparkle-twinkle absolute select-none text-sm" style={{ top: -20, left: "62%", animationDelay: "0.35s" }}>
          ✨
        </span>

        <div className="bear-bounce relative" style={{ width: 66, height: 66, marginTop: 22 }}>
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
      </div>

      <div className="flex items-end gap-1" style={{ height: 40 }}>
        {blocks.map((i) => (
          <span key={i} className="rounded-sm" style={{ width: 14, height: 20 + (i % 2) * 8, background: SNOW, border: `1px solid ${SNOW_SHADE}` }} />
        ))}
      </div>
    </div>
  );
}
