"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const PANCAKE = "#c9962e";
const DOMOVOY_FUR = "#8a6a1e";
const DOMOVOY_HAT = "#d63b2f";
const DOMOVOY_FACE = "#e6c9a0";

// Story beats:
//   Phase 1 (0.00–0.35s, `domovoy-pop-up`, holds risen): a tiny house-
//     spirit (домовой) springs up from behind the pancake stack, jack-in-
//     the-box style — nothing like this was part of
//     MatryoshkaPancakeStackNeat.tsx's calm stacking.
//   Loop (0.2s onward, `pelmeni-scatter` reused, staggered ×3): pancakes
//     go flying off the stack in different directions — same tumble
//     physics already used for spilled dumplings and snow debris.
//   Loop (0.3s onward, `avatar-flinch` reused, on the doll): a single
//     startled flinch as one lands on her.
/** EVERYDAY-tier fail scenario: the MatryoshkaPancakeStackNeat win,
 * ambushed by a mischievous domovoy who'd rather throw the pancakes than
 * let them stack. Reuses pelmeni-scatter and avatar-flinch wholesale. */
export default function DomovoyPancakePrank() {
  const flung = [
    { left: "58%", top: "30%", delay: "0.1s" },
    { left: "78%", top: "50%", delay: "0.22s" },
    { left: "66%", top: "68%", delay: "0.34s" },
  ];
  return (
    <div className="relative flex h-28 items-center justify-center gap-2" aria-hidden="true">
      <span className="avatar-flinch">
        <MatryoshkaAvatar id="matryoshka_surprised" size={52} />
      </span>

      <div className="relative" style={{ width: 60, height: 60 }}>
        {flung.map((p, i) => (
          <span key={i} className="pelmeni-scatter absolute rounded-full" style={{ width: 16, height: 6, left: p.left, top: p.top, background: PANCAKE, animationDelay: p.delay }} />
        ))}

        <span className="domovoy-pop-up absolute left-1/2 -translate-x-1/2" style={{ bottom: 6, width: 26, height: 32, transformOrigin: "50% 100%" }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 20, height: 20, top: 10, background: DOMOVOY_FUR }}>
            <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 12, height: 10, top: 6, background: DOMOVOY_FACE }} />
            <span className="absolute rounded-full" style={{ width: 2, height: 2, top: 9, left: 6, background: "#241c15" }} />
            <span className="absolute rounded-full" style={{ width: 2, height: 2, top: 9, right: 6, background: "#241c15" }} />
          </span>
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 16, height: 12, top: 0, background: DOMOVOY_HAT, borderRadius: "50% 50% 0 0" }} />
        </span>
      </div>
    </div>
  );
}
