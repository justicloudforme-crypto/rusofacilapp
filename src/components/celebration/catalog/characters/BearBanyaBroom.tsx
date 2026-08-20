"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const INK = "#241c15";
const HANDLE = "#5c3b26";
const LEAF = "#4a7a3a";
const TOWEL = "#fff8ec";
const TOWEL_TRIM = "#d63b2f";

// Story beats:
//   Loop (0–0.6s, `broom-wave`): the bear waves a birch venik (bath broom)
//     overhead in a wide arc — no ushanka here, a rolled towel around the
//     neck instead, since this is a banya scene not a winter one.
//   Loop (0–1.8s, `steam-rise` reused ×2, staggered): two wisps of banya
//     steam drift up behind him, identical shape to the samovar's steam.
/** EVERYDAY-tier win scenario: a bear at the banya (Russian bathhouse),
 * triumphantly waving a birch broom. Same fur/muzzle vocabulary as the
 * rest of the bear cast, swapped headwear for a towel to fit the scene. */
export default function BearBanyaBroom() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      <span className="steam-wisp absolute rounded-full bg-white" style={{ width: 4, height: 16, left: "20%", top: 0, opacity: 0.5, animationDelay: "0s" }} />
      <span className="steam-wisp absolute rounded-full bg-white" style={{ width: 4, height: 14, right: "18%", top: 4, opacity: 0.4, animationDelay: "0.6s" }} />

      <div className="relative" style={{ width: 66, height: 66 }}>
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", left: "6%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", right: "6%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "70%", aspectRatio: "1", top: "10%", background: FUR }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "56%", height: "38%", top: "50%", background: MUZZLE }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", left: "27%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", right: "27%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "13%", height: "9%", top: "56%", background: INK }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "46%", height: "14%", top: "58%", background: TOWEL, borderRadius: 9999 }}>
          <span className="absolute inset-x-0 bottom-0" style={{ height: "35%", background: TOWEL_TRIM, borderRadius: 9999 }} />
        </span>
      </div>

      <span className="broom-wave relative" style={{ width: 10, height: 60, transformOrigin: "50% 100%" }}>
        <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 30, background: HANDLE }} />
        <span className="absolute inset-x-0 top-0" style={{ height: 34, background: LEAF, clipPath: "polygon(10% 100%, 0% 20%, 30% 0%, 70% 0%, 100% 20%, 90% 100%)" }} />
      </span>
    </div>
  );
}
