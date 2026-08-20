"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const VALENKI = "#e6dfd0";
const VALENKI_SOLE = "#3a2a20";

// Story beats:
//   Loop (0–0.5s, `valenki-stomp-left` / `valenki-stomp-right` reused from
//     BearValenkiDance.tsx, offset by half a beat): the two felt boots
//     tap down in alternating order — identical footwork to the bear's
//     version, just under a doll this time.
//   Loop (0–1.2s, `snowflake-piece` reused, staggered ×4, started low and
//     short-lived): small flecks drift down right past the stomping boots
//     — same glyph/fall keyframe as every other winter scenario in the
//     catalog, just anchored near foot height instead of the top of the
//     frame so they read as kicked-up snow rather than falling weather.
/** EVERYDAY-tier win scenario: a matryoshka doll tap-dancing in valenki
 * (felt boots) — the doll-led companion to BearValenkiDance.tsx, reusing
 * its exact stomp keyframes. Reuses MatryoshkaAvatar for the face. */
export default function MatryoshkaValenkiTapDance() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 60, height: 92 }}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="snowflake-piece absolute select-none text-white"
            style={{ left: `${16 + i * 18}%`, fontSize: 8, animationDelay: `${i * 0.3}s`, animationDuration: "1.2s" }}
          >
            ❄
          </span>
        ))}

        <span className="valenki-stomp-left absolute" style={{ width: 18, height: 15, bottom: 0, left: 6, transformOrigin: "50% 0%" }}>
          <span className="absolute inset-x-0 top-0 rounded-t-full" style={{ height: 9, background: VALENKI }} />
          <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 7, background: VALENKI_SOLE }} />
        </span>
        <span className="valenki-stomp-right absolute" style={{ width: 18, height: 15, bottom: 0, right: 6, transformOrigin: "50% 0%" }}>
          <span className="absolute inset-x-0 top-0 rounded-t-full" style={{ height: 9, background: VALENKI }} />
          <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 7, background: VALENKI_SOLE }} />
        </span>

        <div className="relative" style={{ width: 56, height: 56, marginLeft: 2 }}>
          <MatryoshkaAvatar id="matryoshka_laughing" size={56} />
        </div>
      </div>
    </div>
  );
}
