"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const ICE = "#c7dff0";
const HOLE = "#2d5f8a";
const FISH_BODY = "#e0a934";
const LINE = "#5c3b26";

// Story beats:
//   Phase 1 (0.00–0.5s, `fish-reel-up`, holds risen): a fish on the end of
//     the line rises straight up out of the ice hole, tail still flicking.
//   Loop (0–0.6s, `fish-flop`, on the fish itself once risen): the fish
//     wriggles side to side, caught but not calm about it.
//   Loop (0–1.6s, `bear-bounce` reused): the bear leans back in triumph the
//     whole time, same idle motion as catalog/characters/Bear.tsx.
/** EVERYDAY-tier win scenario: a bear ice-fishing through a hole in a
 * frozen pond, reeling one in. Same fur/ushanka vocabulary as the rest of
 * the bear cast; the ice sheet and hole are plain flat shapes. */
export default function BearIceFishing() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 110, height: 92 }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 100, height: 18, bottom: 0, background: ICE }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 26, height: 12, bottom: 4, background: HOLE }} />

        <span className="fish-reel-up absolute left-1/2" style={{ bottom: 10, width: 20, height: 10, marginLeft: -30 }}>
          <span className="absolute" style={{ width: 1, height: 30, bottom: 10, left: 4, background: LINE }} />
          <span className="fish-flop absolute rounded-full" style={{ width: 20, height: 10, bottom: 34, background: FISH_BODY, clipPath: "polygon(0% 50%, 80% 0%, 100% 50%, 80% 100%)" }} />
        </span>

        <div className="bear-bounce relative" style={{ width: 66, height: 66, marginLeft: 16 }}>
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
