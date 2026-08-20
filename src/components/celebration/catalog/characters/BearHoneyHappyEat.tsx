"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const SPOON = "#c9962e";
const HONEY = "#e0a934";

// Story beats:
//   Loop (0–0.5s, `tongue-catch` reused from MedvedSnowCatch.tsx): his
//     tongue flicks out and back to lick the spoon — same quick rhythm
//     already used for catching snowflakes, here aimed at honey instead.
//   Loop (0–1.6s, `honey-drip` reused from BearHoneyBarrelStuck.tsx): one
//     slow drip wells up on the spoon and falls — a small, contented
//     amount, not the flood from that scene.
//   Loop (0–1.6s, `bear-bounce` reused): a small happy bounce throughout.
/** EVERYDAY-tier win scenario: a bear happily licking a spoonful of
 * honey — the calm, satisfied version of the honey-jar cast, contrasting
 * with both BearHoneyJarSpill.tsx's mess and BearHoneyBarrelStuck.tsx's
 * predicament. Reuses tongue-catch, honey-drip, and bear-bounce
 * wholesale. */
export default function BearHoneyHappyEat() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      <div className="bear-bounce relative" style={{ width: 66, height: 66 }}>
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
          <span className="tongue-catch absolute left-1/2 -translate-x-1/2 rounded-b-full" style={{ width: "16%", height: "12%", top: "60%", background: "#d63b2f", transformOrigin: "50% 0%" }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />
      </div>

      <div className="relative" style={{ width: 16, height: 40 }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 16, height: 20, top: 0, background: SPOON }} />
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 4, height: 22, top: 18, background: SPOON, borderRadius: 9999 }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 12, height: 8, top: 5, background: HONEY, opacity: 0.85 }} />
        <span className="honey-drip absolute rounded-full" style={{ width: 4, height: 5, top: 16, left: "50%", marginLeft: -2, background: HONEY }} />
      </div>
    </div>
  );
}
