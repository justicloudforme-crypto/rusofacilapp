"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const ARM = "#d63b2f";

// Story beats:
//   Loop (0–0.5s, `kazachok-dance` reused from MatryoshkaKazachokParade.tsx):
//     the same squat-kick bob used for the parade's mini dolls, here
//     carrying the whole scene solo instead of a backing row.
//   Loop (0–0.5s, `warmup-arm-pump`, mirrored left/right): both arms pump
//     up and down in time with the bob — the "dancing to warm up" beat the
//     bob alone doesn't sell.
/** EVERYDAY-tier win scenario: a doll dancing energetically to shake off
 * the cold. Reuses MatryoshkaAvatar for the face and the kazachok-dance
 * bob wholesale; only the pumping arms are new. */
export default function MatryoshkaWarmupDance() {
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <span className="kazachok-dance relative" style={{ width: 60, height: 60 }}>
        <MatryoshkaAvatar id="matryoshka_laughing" size={60} />
        <span className="warmup-arm-pump absolute rounded-full" style={{ width: 8, height: 22, top: "18%", left: "-10%", background: ARM, transformOrigin: "50% 0%" }} />
        <span className="warmup-arm-pump absolute rounded-full" style={{ width: 8, height: 22, top: "18%", right: "-10%", background: ARM, transformOrigin: "50% 0%", animationDelay: "0.1s" }} />
      </span>
    </div>
  );
}
