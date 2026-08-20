"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";
import type { AvatarId } from "@/lib/avatars";

const MINI_FACES: AvatarId[] = ["matryoshka_happy", "matryoshka_wink", "matryoshka_laughing"];

// Story beats:
//   Loop (0–0.9s, `juggle-arc`, staggered ×3 by 0.3s each): three mini
//     dolls each fly up in a parabolic arc and fall back down, one launch
//     starting exactly as the previous doll lands — a continuous three-ball
//     (three-doll) juggling cascade, not three dolls bouncing in unison.
//   Loop (0–1.6s, `rockstar-headbang`, reused from CelebrationBalalaikaRockStar):
//     the big central doll bobs along, hands implicitly full.
/** STREAK-tier win scenario: the everyday CelebrationMatryoshka's cascade
 * turned into an actual juggling act — reuses MatryoshkaAvatar throughout,
 * only the choreography (three staggered arcs instead of one reveal) is
 * new. Meant for a correct-answer streak, same slot as
 * BearSmokingBalalaika — "the doll is on a roll and it shows". */
export default function MatryoshkaJuggler() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <span className="rockstar-headbang">
        <MatryoshkaAvatar id="matryoshka_proud" size={56} />
      </span>

      {[0, 0.3, 0.6].map((delay, i) => (
        <span
          key={i}
          className="juggle-arc absolute"
          style={{ left: `${50 + (i - 1) * 20}%`, bottom: 56, animationDelay: `${delay}s` }}
        >
          <MatryoshkaAvatar id={MINI_FACES[i]} size={22} />
        </span>
      ))}
    </div>
  );
}
