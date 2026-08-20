"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const ARM = "#d63b2f";

// Story beats:
//   Loop (0–1.2s, `yoga-wobble`): the whole doll tips a few degrees off
//     center and back, over and over — she has no legs to actually balance
//     on one foot, so the "tree pose" reads entirely through the lean.
//   Loop (0–0.9s, `sparkle-twinkle` reused, delayed): a sparkle marks the
//     moment she holds the pose steadiest.
/** EVERYDAY-tier win scenario: a matryoshka doll attempting (and mostly
 * landing) a yoga tree pose. Reuses MatryoshkaAvatar for the face; two
 * plain arm shapes are added over it since the avatar itself has none. */
export default function MatryoshkaYoga() {
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <div className="yoga-wobble relative" style={{ width: 60, height: 60, transformOrigin: "50% 100%" }}>
        <MatryoshkaAvatar id="matryoshka_proud" size={60} />
        <span className="absolute rounded-full" style={{ width: 8, height: 22, top: "20%", left: "-10%", background: ARM, transform: "rotate(-30deg)", transformOrigin: "100% 0%" }} />
        <span className="absolute rounded-full" style={{ width: 8, height: 22, top: "20%", right: "-10%", background: ARM, transform: "rotate(30deg)", transformOrigin: "0% 0%" }} />
        <span
          className="sparkle-twinkle absolute select-none text-sm"
          style={{ top: -12, left: "50%", marginLeft: -8, animationDelay: "0.5s" }}
        >
          ✨
        </span>
      </div>
    </div>
  );
}
