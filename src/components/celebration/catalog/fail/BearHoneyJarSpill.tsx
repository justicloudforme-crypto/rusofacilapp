"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const JAR_GLASS = "#e6dfd0";
const HONEY = "#e0a934";

// Story beats:
//   Phase 1 (0.00–0.35s, `lid-slump` reused from Samovar's family of tips,
//     holds tipped): the jar tips over sideways instead of being lifted
//     proudly like BearHoneyJarVictory's.
//   Loop (0.15s onward, `honey-pour-spill` reused from BearBarista.tsx's
//     tea stream): a steady amber stream pours out onto the ground —
//     identical physical pour, just honey instead of tea and going the
//     wrong direction.
/** EVERYDAY-tier fail scenario: the BearHoneyJarVictory win, knocked over
 * instead of finished. Same fur/ushanka/jar vocabulary, opposite outcome
 * for the honey. */
export default function BearHoneyJarSpill() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 66, height: 88 }}>
        <span className="lid-slump absolute left-1/2" style={{ width: 26, height: 20, top: -14, marginLeft: -13, transformOrigin: "0% 100%" }}>
          <span className="absolute inset-x-0 bottom-0 rounded-b-md" style={{ height: 16, background: JAR_GLASS, border: `2px solid ${HONEY}` }} />
          <span className="absolute inset-x-1 top-0 rounded-t-sm" style={{ height: 5, background: HAT_TRIM }} />
        </span>
        <span className="honey-pour-spill absolute rounded-full" style={{ width: 2, height: 0, left: 6, top: 4, background: HONEY }} />

        <div className="relative" style={{ width: 66, height: 66, marginTop: 22 }}>
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
