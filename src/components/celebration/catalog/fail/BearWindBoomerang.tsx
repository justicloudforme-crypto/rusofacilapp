"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const SNOW = "#f2ede3";
const SNOWBALL = "#f2ede3";

// Story beats:
//   Phase 1 (0.00–0.5s, `snowball-boomerang` reused from
//     RabbitSnowballBackfire.tsx): the thrown snowball arcs out and
//     curves straight back — same wind-caught physics.
//   Phase 2 (0.4–0.75s, `bear-trip-lurch` reused from BearDropsPelmeni.tsx,
//     holds toppled): the instant it lands, he pitches forward face-first
//     into the snowbank instead of just flinching like the rabbit's
//     version.
/** EVERYDAY-tier fail scenario: the BearSnowballHit win, undone by a gust
 * of wind — the throw comes straight back and knocks him face-first into
 * the snow. Reuses snowball-boomerang and bear-trip-lurch wholesale. */
export default function BearWindBoomerang() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 90, height: 90 }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 70, height: 16, bottom: 0, background: SNOW, opacity: 0.7 }} />
        <span className="snowball-boomerang absolute rounded-full" style={{ width: 10, height: 10, left: 40, top: 14, background: SNOWBALL, border: "1px solid rgba(0,0,0,0.08)" }} />

        <div className="bear-trip-lurch relative" style={{ width: 66, height: 66, marginLeft: 12, marginBottom: 6, transformOrigin: "50% 100%" }}>
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
