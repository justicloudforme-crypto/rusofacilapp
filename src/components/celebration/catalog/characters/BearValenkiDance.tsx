"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const VALENKI = "#e6dfd0";
const VALENKI_SOLE = "#3a2a20";

// Story beats:
//   Loop (0–0.5s, `valenki-stomp-left` / `valenki-stomp-right`, offset by
//     half a beat): the two felt boots stomp down in alternating order —
//     a folk dance step, not a jump.
//   Loop (0–1.4s, `step-dust` reused from BearSmokingBalalaika's smoke,
//     staggered ×2): a small puff kicks up under whichever boot just
//     landed.
/** EVERYDAY-tier win scenario: a bear doing a stomping folk dance in
 * valenki (traditional felt boots) — same fur/ushanka vocabulary as the
 * rest of the bear cast, new footwear. */
export default function BearValenkiDance() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 74, height: 92 }}>
        <span className="step-dust absolute rounded-full bg-white" style={{ width: 10, height: 4, bottom: 0, left: 4, opacity: 0.6, animationDelay: "0s" }} />
        <span className="step-dust absolute rounded-full bg-white" style={{ width: 10, height: 4, bottom: 0, right: 4, opacity: 0.6, animationDelay: "0.25s" }} />

        <span className="valenki-stomp-left absolute" style={{ width: 20, height: 16, bottom: 0, left: 6, transformOrigin: "50% 0%" }}>
          <span className="absolute inset-x-0 top-0 rounded-t-full" style={{ height: 10, background: VALENKI }} />
          <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 8, background: VALENKI_SOLE }} />
        </span>
        <span className="valenki-stomp-right absolute" style={{ width: 20, height: 16, bottom: 0, right: 6, transformOrigin: "50% 0%" }}>
          <span className="absolute inset-x-0 top-0 rounded-t-full" style={{ height: 10, background: VALENKI }} />
          <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 8, background: VALENKI_SOLE }} />
        </span>

        <div className="bear-bounce relative" style={{ width: 66, height: 66, marginLeft: 4 }}>
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
          <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "30%", bottom: 12, background: FUR }} />
        </div>
      </div>
    </div>
  );
}
