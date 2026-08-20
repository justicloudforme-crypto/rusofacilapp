"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";

// Story beats:
//   Loop (0–0.5s, `valenki-stomp-left` / `valenki-stomp-right` reused from
//     BearValenkiDance.tsx, offset by half a beat): the two feet stomp
//     down in alternating marching order.
//   Loop (0–0.5s, `warmup-arm-pump` reused from MatryoshkaWarmupDance.tsx,
//     mirrored): both arms swing in time with the march — same brisk
//     energy as the doll's warm-up dance, applied to a bear on the move
//     instead of standing in place.
/** EVERYDAY-tier win scenario: a bear marching briskly in place, wide
 * awake and warming up — the alert counterpart to BearSleepFaceplant.tsx.
 * Reuses valenki-stomp-left/right and warmup-arm-pump wholesale. */
export default function BearActiveMarch() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 66, height: 92 }}>
        <span className="warmup-arm-pump absolute rounded-full" style={{ width: 10, height: 24, top: "26%", left: "-8%", background: FUR, transformOrigin: "50% 0%" }} />
        <span className="warmup-arm-pump absolute rounded-full" style={{ width: 10, height: 24, top: "26%", right: "-8%", background: FUR, transformOrigin: "50% 0%", animationDelay: "0.1s" }} />

        <span className="valenki-stomp-left absolute rounded-b-full" style={{ width: 16, height: 14, bottom: 0, left: 12, background: HAT_FUR, transformOrigin: "50% 0%" }} />
        <span className="valenki-stomp-right absolute rounded-b-full" style={{ width: 16, height: 14, bottom: 0, right: 12, background: HAT_FUR, transformOrigin: "50% 0%" }} />

        <div className="relative" style={{ width: 66, height: 66 }}>
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
    </div>
  );
}
