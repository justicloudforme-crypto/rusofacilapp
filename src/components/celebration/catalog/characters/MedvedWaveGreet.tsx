"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const BELL = "#e0a934";
const BELL_DARK = "#8a6a1e";

// Story beats:
//   Loop (0–0.6s, `bear-wave-arm`): a paw-arm swings up and side to side
//     in a friendly greeting wave, held out from the body the whole time.
//   Loop (0–0.5s, `bell-jingle-swing` reused from TroikaBellsJingle.tsx,
//     staggered ×2): two small festive bells beside him swing in
//     welcome — a fairground greeter's bubentsy, not a harness's.
/** EVERYDAY-tier win scenario: a fairground bear (ярмарочный медведь)
 * waving hello to festival bells. Same fur/ushanka vocabulary as the rest
 * of the bear cast; reuses the bell-swing keyframe from
 * catalog/characters/TroikaBellsJingle.tsx wholesale. */
export default function MedvedWaveGreet() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-2" aria-hidden="true">
      {[0, 1].map((i) => (
        <span key={i} className="bell-jingle-swing relative" style={{ width: 18, height: 30, transformOrigin: "50% 0%", animationDelay: `${i * 0.15}s` }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 16, height: 16, top: 6, background: BELL }}>
            <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 6, background: BELL_DARK }} />
          </span>
        </span>
      ))}

      <div className="relative" style={{ width: 66, height: 66 }}>
        <span className="bear-wave-arm absolute rounded-full" style={{ width: 14, height: 26, top: "26%", right: "-8%", background: FUR, transformOrigin: "50% 100%" }} />
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
  );
}
