"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const INK = "#241c15";
const COMB = "#5c3b26";
const COMB_TEETH = "#3a2a20";

// Story beats:
//   Loop (0–0.6s, `comb-stroke`): the bear's comb sweeps up and down next
//     to the doll's head in short, even passes — a groomer's rhythm, not a
//     strum.
//   Loop (0–0.9s, `sparkle-twinkle` reused, delayed start): once a couple
//     of passes have happened, a sparkle pops near the doll's head — the
//     "finishing touch" beat.
/** EVERYDAY-tier win scenario: a bear moonlighting as a hairdresser, combing
 * a matryoshka doll's hairline. Bear head reuses the same fur/muzzle/ink
 * vocabulary as the rest of the cast (no ushanka here — he's on the clock);
 * the doll reuses MatryoshkaAvatar. */
export default function BearHairdresser() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      <div className="relative" style={{ width: 52, height: 52 }}>
        <span className="absolute rounded-full" style={{ width: "24%", aspectRatio: "1", top: "4%", left: "4%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "24%", aspectRatio: "1", top: "4%", right: "4%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "78%", aspectRatio: "1", top: "14%", background: FUR }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "58%", height: "42%", top: "48%", background: MUZZLE }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "40%", left: "26%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "40%", right: "26%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "12%", height: "8%", top: "58%", background: INK }} />
        </span>

        <span
          className="comb-stroke absolute"
          style={{ width: 22, height: 10, top: "38%", right: -14, transformOrigin: "0% 50%" }}
        >
          <span className="absolute inset-0 rounded-sm" style={{ background: COMB }} />
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="absolute"
              style={{ width: 2, height: 6, top: 10, left: 2 + i * 5, background: COMB_TEETH }}
            />
          ))}
        </span>
      </div>

      <div className="relative" style={{ width: 56, height: 56 }}>
        <MatryoshkaAvatar id="matryoshka_calm" size={56} />
        <span
          className="sparkle-twinkle absolute select-none text-sm"
          style={{ top: -8, left: -4, animationDelay: "0.55s" }}
        >
          ✨
        </span>
      </div>
    </div>
  );
}
