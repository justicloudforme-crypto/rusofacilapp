"use client";

const FUR = "#8a5a3a";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const MUZZLE = "#e6c9a0";
const INK = "#241c15";
const PELMENI = "#f2ede3";
const PELMENI_SHADE = "#d8d0c2";

// Story beats:
//   Phase 1 (0.00–0.3s, `bear-trip-lurch`, holds tilted): the bear lurches
//     forward off-balance, mid-trip.
//   Phase 2 (0.1–0.9s, `pelmeni-scatter`, staggered ×5): five dumplings
//     that were in the (now-invisible, implied) bowl fly outward in
//     different directions and settle on the ground — the actual spill.
/** EVERYDAY-tier fail scenario: dinner doesn't survive the wrong answer
 * either. Reuses the same fur/muzzle/ushanka vocabulary as the rest of the
 * bear cast, tripping instead of sulking or napping. */
export default function BearDropsPelmeni() {
  const pelmeni = [
    { left: "10%", top: "70%", delay: "0.1s" },
    { left: "30%", top: "82%", delay: "0.22s" },
    { left: "52%", top: "76%", delay: "0.34s" },
    { left: "68%", top: "86%", delay: "0.46s" },
    { left: "82%", top: "72%", delay: "0.58s" },
  ];
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      {pelmeni.map((p, i) => (
        <span
          key={i}
          className="pelmeni-scatter absolute rounded-full"
          style={{ width: 12, height: 9, left: p.left, top: p.top, background: PELMENI, animationDelay: p.delay }}
        >
          <span className="absolute inset-x-0 top-0 rounded-full" style={{ height: "45%", background: PELMENI_SHADE, opacity: 0.6 }} />
        </span>
      ))}

      <div className="bear-trip-lurch relative" style={{ width: 90, height: 84, transformOrigin: "50% 100%" }}>
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "22%", left: "8%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "22%", right: "8%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "62%", aspectRatio: "1", top: "28%", background: FUR }}>
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "82%", height: "12%", top: "16%", background: HAT_TRIM, borderRadius: 9999 }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "78%", height: "30%", top: "-9%", background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "56%", height: "40%", top: "50%", background: MUZZLE }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "38%", left: "27%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "38%", right: "27%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "13%", height: "9%", top: "56%", background: INK }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "60%", height: "34%", bottom: 0, background: FUR }} />
      </div>
    </div>
  );
}
