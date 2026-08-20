"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const VALENKI = "#e6dfd0";
const VALENKI_SOLE = "#3a2a20";
const ICE = "#c7dff0";

// Story beats:
//   Phase 1 (0.00–0.35s, `valenki-slip`, holds toppled): the bear's whole
//     body pitches backward onto the ice — the opposite outcome of
//     BearValenkiDance's controlled stomping.
//   Phase 1 (0.05–0.5s, `boot-fly-off`, mirrored ×2): both felt boots pop
//     off his feet mid-slip and tumble away in opposite directions.
/** EVERYDAY-tier fail scenario: the BearValenkiDance stomp landing wrong
 * on a patch of ice. Same fur/ushanka/valenki vocabulary, opposite
 * outcome. */
export default function BearValenkiSlip() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 90, height: 92 }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 80, height: 12, bottom: 0, background: ICE }} />

        <span className="boot-fly-off absolute" style={{ width: 20, height: 16, bottom: 6, left: 4 }}>
          <span className="absolute inset-x-0 top-0 rounded-t-full" style={{ height: 10, background: VALENKI }} />
          <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 8, background: VALENKI_SOLE }} />
        </span>
        <span className="boot-fly-off absolute" style={{ width: 20, height: 16, bottom: 6, right: 4, animationDelay: "0.06s" }}>
          <span className="absolute inset-x-0 top-0 rounded-t-full" style={{ height: 10, background: VALENKI }} />
          <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 8, background: VALENKI_SOLE }} />
        </span>

        <div className="valenki-slip relative" style={{ width: 66, height: 66, marginLeft: 4, marginBottom: 12, transformOrigin: "50% 100%" }}>
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
          <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "30%", bottom: 12, background: FUR }} />
        </div>
      </div>
    </div>
  );
}
