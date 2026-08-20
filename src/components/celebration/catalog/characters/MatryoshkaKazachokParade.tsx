"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";
import type { AvatarId } from "@/lib/avatars";

// Story beats (see `kazachok-pop`/`kazachok-dance` in globals.css):
//   Phase 1 (0.00–0.30s): the big doll pops open (scale/bounce).
//   Phase 2 (0.20–0.55s, staggered): eight mini dolls burst out from
//     behind it in a fanned row, each with its own tiny entrance delay —
//     reads as "the doll cracked open and everyone spilled out at once".
//   Phase 3 (0.55s onward, looping): every mini doll does a kazachok
//     squat-kick bob (translateY + slight side lean), staggered per doll
//     so the row moves like a dance line, not in unison.
const MINI_FACES: AvatarId[] = [
  "matryoshka_happy",
  "matryoshka_laughing",
  "matryoshka_wink",
  "matryoshka_proud",
  "matryoshka_happy",
  "matryoshka_laughing",
  "matryoshka_wink",
  "matryoshka_proud",
];

/** MILESTONE-tier win scenario: a level-up-worthy "the doll opened and an
 * entire troupe came out dancing" moment — a bigger, busier payoff than the
 * everyday CelebrationMatryoshka cascade (catalog/characters/Matryoshka.tsx),
 * reserved for bigger wins the same way "bear" is. Reuses the proven
 * MatryoshkaAvatar shapes throughout — only the choreography is new. */
export default function MatryoshkaKazachokParade() {
  return (
    <div className="relative flex h-28 flex-col items-center justify-end gap-2" aria-hidden="true">
      <span className="kazachok-pop">
        <MatryoshkaAvatar id="matryoshka_laughing" size={52} />
      </span>
      <div className="flex items-end gap-0.5">
        {MINI_FACES.map((face, i) => (
          // Two nested animations, not one: the outer span plays the
          // one-shot "burst out" entrance (opacity/scale, `both`-filled so
          // it doesn't replay), the inner span plays the continuous
          // squat-kick bob (translateY, infinite) — nesting is what lets
          // both run on `transform` at once without one overwriting the
          // other, since each element only ever has its own single
          // `transform` value.
          <span key={i} className="kazachok-pop-in" style={{ animationDelay: `${0.25 + i * 0.05}s` }}>
            <span className="kazachok-dance" style={{ animationDelay: `${0.6 + i * 0.07}s` }}>
              <MatryoshkaAvatar id={face} size={22} />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
