"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const JAR_GLASS = "#e6dfd0";
const HONEY = "#e0a934";

// Story beats:
//   Loop (0–0.7s, `jar-raise` — the same lift used for
//     RabbitCarrotVictory's carrot and BearBakesKaravai's loaf): the bear
//     lifts a honey jar overhead and back down in a small victory pump.
//   Loop (0–1.6s, `honey-drip` reused from BearHoneyBarrelStuck.tsx,
//     delayed): one happy drip wells up and falls from the jar's rim —
//     same physical drip as the stuck-in-a-barrel fail, just a much
//     smaller, celebratory amount this time.
/** EVERYDAY-tier win scenario: a bear finding (and finishing) a jar of
 * honey — same fur/ushanka vocabulary as the rest of the bear cast, and
 * the deliberate happy counterpart to catalog/fail/BearHoneyBarrelStuck.tsx.
 * Reuses the carrot-raise lift and honey-drip keyframes wholesale. */
export default function BearHoneyJarVictory() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 66, height: 88 }}>
        <span className="jar-raise absolute left-1/2 -translate-x-1/2" style={{ width: 22, height: 26, top: -18, transformOrigin: "50% 100%" }}>
          <span className="absolute inset-x-0 bottom-0 rounded-b-md" style={{ height: 20, background: JAR_GLASS, border: `2px solid ${HONEY}` }}>
            <span className="absolute inset-x-1 bottom-1" style={{ height: 12, background: HONEY, borderRadius: 4 }} />
          </span>
          <span className="absolute inset-x-1 top-0 rounded-t-sm" style={{ height: 6, background: HAT_TRIM }} />
          <span className="honey-drip absolute rounded-full" style={{ width: 4, height: 5, bottom: -2, left: "50%", marginLeft: -2, background: HONEY }} />
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
    </div>
  );
}
