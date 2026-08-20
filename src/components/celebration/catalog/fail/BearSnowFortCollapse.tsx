"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const SNOW = "#f2ede3";
const SNOW_SHADE = "#d8d0c2";

// Story beats:
//   Phase 1 (0.00–0.5s, `pelmeni-scatter` reused, staggered ×4): the fort's
//     four blocks tumble outward instead of standing in a tidy row —
//     same tumble-and-settle physics as BearDropsPelmeni.tsx's spilled
//     dumplings, applied to snow blocks instead.
//   Loop (0.3s onward, `comic-shiver` reused, on the bear): once buried
//     under falling blocks, he shivers in place.
/** EVERYDAY-tier fail scenario: the BearSnowFort win, caving in instead of
 * standing finished. Same fur/ushanka/snow-block vocabulary, opposite
 * outcome for the wall. */
export default function BearSnowFortCollapse() {
  const blocks = [
    { left: "6%", top: "58%", delay: "0.05s" },
    { left: "30%", top: "70%", delay: "0.16s" },
    { left: "58%", top: "60%", delay: "0.27s" },
    { left: "80%", top: "72%", delay: "0.38s" },
  ];
  return (
    <div className="relative flex h-28 items-end justify-center overflow-hidden" aria-hidden="true">
      {blocks.map((b, i) => (
        <span
          key={i}
          className="pelmeni-scatter absolute rounded-sm"
          style={{ width: 14, height: 12, left: b.left, top: b.top, background: SNOW, border: `1px solid ${SNOW_SHADE}`, animationDelay: b.delay }}
        />
      ))}

      <div className="comic-shiver relative" style={{ width: 66, height: 66 }}>
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
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "20%", height: "3px", top: "60%", background: INK, opacity: 0.6 }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />
      </div>
    </div>
  );
}
