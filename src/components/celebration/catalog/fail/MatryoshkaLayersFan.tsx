"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const SHELL_COLORS = ["#d63b2f", "#e0a934", "#2d5f8a", "#4a7a3a"];

// Story beats:
//   Phase 1 (0.00–0.2s, static tilt on the outer shell): the empty outer
//     doll tips onto her side — this is the opposite of Matryoshka.tsx's
//     cascade-in, everything comes OUT instead of nesting back together.
//   Phase 2 (0.05–0.55s, `layers-fan-out`, staggered ×4): four inner-doll
//     "shells" (plain colored ellipses, smallest last) slide out from under
//     her and fan across the floor at different angles — dropped, not
//     stacked.
/** EVERYDAY-tier fail scenario: the doll that normally cascades open in
 * triumphant order (catalog/characters/Matryoshka.tsx) instead spills all
 * her layers out across the floor at once. Reuses MatryoshkaAvatar for the
 * outer shell's "surprised" face. */
export default function MatryoshkaLayersFan() {
  const shells = SHELL_COLORS;
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      {shells.map((color, i) => (
        <span
          key={i}
          className="absolute left-1/2"
          style={{ bottom: 10, width: 0, height: 0, transform: `rotate(${(i - 1.5) * 26}deg)` }}
        >
          <span
            className="layers-fan-out absolute rounded-full"
            style={{
              width: 20 - i * 3,
              height: 26 - i * 3,
              left: -10 + i * 1.5,
              background: color,
              borderRadius: "50% 50% 45% 45% / 60% 60% 40% 40%",
              animationDelay: `${i * 0.09}s`,
            }}
          />
        </span>
      ))}

      <div className="relative" style={{ width: 56, height: 56, transform: "rotate(-24deg)", transformOrigin: "50% 100%" }}>
        <MatryoshkaAvatar id="matryoshka_surprised" size={56} />
      </div>
    </div>
  );
}
