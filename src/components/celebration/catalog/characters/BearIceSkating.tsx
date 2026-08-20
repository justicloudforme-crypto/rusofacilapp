"use client";

const FUR = "#8a5a3a";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const MUZZLE = "#e6c9a0";
const INK = "#241c15";
const PUDDLE = "#8a4a1e";

// Story beats:
//   Loop (0–2.2s, `bear-glide-circle`): the bear traces a rough circle
//     over the spilled-tea puddle — four waypoints (right → bottom → left
//     → top → back to right), each with a slight lean into the turn —
//     reads as one continuous skating loop, not a back-and-forth wobble.
//   The puddle itself is static — it's the "ice", not part of the joke's
//     motion, which is entirely in the bear's glide.
/** EVERYDAY-tier win scenario: what happens to the tea BearBarista
 * (catalog/home/BearBarista.tsx) inevitably spills — reuses the same
 * ushanka/muzzle vocabulary as the rest of the bear cast, skating instead
 * of serving. */
export default function BearIceSkating() {
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <span className="absolute rounded-full" style={{ width: 78, height: 30, background: PUDDLE, opacity: 0.35 }} />

      <div className="bear-glide-circle relative" style={{ width: 44, height: 52 }}>
        <span className="absolute rounded-full" style={{ width: "20%", aspectRatio: "1", top: "2%", left: "6%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "20%", aspectRatio: "1", top: "2%", right: "6%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "70%", aspectRatio: "1", top: "8%", background: FUR }}>
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "82%", height: "14%", top: "18%", background: HAT_TRIM, borderRadius: 9999 }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "76%", height: "32%", top: "-10%", background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "50%", height: "34%", top: "48%", background: MUZZLE }} />
          <span className="absolute rounded-full" style={{ width: "10%", aspectRatio: "1", top: "40%", left: "26%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "10%", aspectRatio: "1", top: "40%", right: "26%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "26%", height: "12%", top: "62%", background: INK, opacity: 0.6 }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "58%", height: "36%", bottom: 0, background: FUR }} />
      </div>
    </div>
  );
}
