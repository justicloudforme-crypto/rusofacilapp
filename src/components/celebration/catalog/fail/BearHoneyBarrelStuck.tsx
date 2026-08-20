"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const INK = "#241c15";
const BARREL = "#5c3b26";
const BARREL_BAND = "#3a2a20";
const HONEY = "#e0a934";

// Story beats:
//   Loop (0–0.5s, `barrel-wiggle`): the bear's head-and-shoulders rock
//     side to side, stuck fast in the barrel below — the struggle reads as
//     a wobble, not a jump, because the barrel itself never moves.
//   Loop (0–1.6s, `honey-drip` reused from `tear-drip`, staggered ×2): two
//     honey drops well up over the rim and fall, same physical motion as
//     the samovar/matryoshka's tears elsewhere in the fail set, just amber
//     instead of clear.
/** EVERYDAY-tier fail scenario: reaching too far into the honey pot went
 * wrong. Bear head reuses the fur/muzzle/ink vocabulary from the rest of
 * the cast; only the shoulders show above the barrel rim. */
export default function BearHoneyBarrelStuck() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 76, height: 92 }}>
        <span
          className="honey-drip absolute rounded-full"
          style={{ width: 5, height: 6, top: 44, left: 18, background: HONEY, animationDelay: "0.2s" }}
        />
        <span
          className="honey-drip absolute rounded-full"
          style={{ width: 5, height: 6, top: 44, right: 18, background: HONEY, animationDelay: "0.9s" }}
        />

        <div className="barrel-wiggle absolute left-1/2 -translate-x-1/2" style={{ top: 0, width: 54 }}>
          <span className="absolute rounded-full" style={{ width: "26%", aspectRatio: "1", top: "0%", left: "0%", background: FUR }} />
          <span className="absolute rounded-full" style={{ width: "26%", aspectRatio: "1", top: "0%", right: "0%", background: FUR }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "80%", aspectRatio: "1", top: "8%", background: FUR }}>
            <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "58%", height: "40%", top: "48%", background: MUZZLE }} />
            <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "40%", left: "26%", background: INK }} />
            <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "40%", right: "26%", background: INK }} />
            <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "12%", height: "8%", top: "58%", background: INK }} />
          </span>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: 22, top: 46, background: FUR }} />
        </div>

        <span className="absolute inset-x-0 bottom-0 rounded-b-2xl" style={{ height: 56, background: BARREL }}>
          <span className="absolute inset-x-0" style={{ top: 6, height: 5, background: BARREL_BAND }} />
          <span className="absolute inset-x-0" style={{ bottom: 6, height: 5, background: BARREL_BAND }} />
        </span>
      </div>
    </div>
  );
}
