"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const VALENKI = "#e6dfd0";
const VALENKI_SOLE = "#3a2a20";
const SNOW = "#f2ede3";

// Story beats:
//   Phase 1 (0.00–0.35s, `bear-trip-lurch` reused from BearDropsPelmeni.tsx,
//     holds tilted): the bear lurches forward mid-step, tripped up by his
//     own oversized boot instead of just losing balance on ice like
//     BearValenkiSlip.tsx's version.
//   Phase 2 (0.15–0.65s, `pelmeni-scatter` reused, staggered ×4): loose
//     snow puffs burst outward from the spot where he lands — a snowbank,
//     not a hard floor, so the "impact" reads as soft and fluffy.
/** EVERYDAY-tier fail scenario: a comically oversized valenok tripping the
 * bear into a snowbank — distinct from BearValenkiSlip.tsx's on-ice
 * topple. Reuses the bear-trip-lurch stumble and pelmeni-scatter burst
 * wholesale, both already used for BearDropsPelmeni.tsx. */
export default function BearValenkiSnowTrip() {
  const puffs = [
    { left: "10%", top: "72%", delay: "0.15s" },
    { left: "32%", top: "84%", delay: "0.27s" },
    { left: "58%", top: "76%", delay: "0.39s" },
    { left: "78%", top: "86%", delay: "0.51s" },
  ];
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      {puffs.map((p, i) => (
        <span
          key={i}
          className="pelmeni-scatter absolute rounded-full"
          style={{ width: 10, height: 10, left: p.left, top: p.top, background: SNOW, opacity: 0.85, animationDelay: p.delay }}
        />
      ))}

      <div className="relative" style={{ width: 90, height: 92 }}>
        <span className="absolute" style={{ width: 30, height: 16, bottom: 0, left: 10, background: VALENKI, borderRadius: "50% 50% 20% 20%", transform: "rotate(-16deg)" }}>
          <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 6, background: VALENKI_SOLE }} />
        </span>

        <div className="bear-trip-lurch relative" style={{ width: 66, height: 66, marginLeft: 20, transformOrigin: "50% 100%" }}>
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
    </div>
  );
}
