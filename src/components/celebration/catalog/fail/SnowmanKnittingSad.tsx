"use client";

const SNOW = "#f2ede3";
const COAL = "#241c15";
const CARROT = "#e0a934";
const NEEDLE = "#8a6a1e";
const YARN = "#2d5f8a";
const TEAR = "#4a7ba8";

// Story beats:
//   The snowman does not react to anything — no shake, no flinch, nothing.
//     That stillness IS the joke, in contrast to every other scenario's
//     motion. The only things that move are:
//   Loop (0–1.6s, `knit-stitch`): the sock grows by a tiny notch, over and
//     over, at a slow, resigned rhythm.
//   Loop (0–2s, `tear-drip`): one drop slides down the face and fades,
//     then starts again from the top.
/** EVERYDAY-tier fail scenario: total indifference. Sits slightly slumped
 * (unlike the upright everyday-win SnowmanDisco in catalog/seasons/), coal
 * eyes at half height, knitting — because a wrong answer is not going to
 * ruin a perfectly good sock. */
export default function SnowmanKnittingSad() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 66, height: 74, transform: "rotate(-2deg)" }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 60, height: 50, bottom: 0, background: SNOW }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 40, height: 36, bottom: 38, background: SNOW }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 58, left: "42%", background: COAL, opacity: 0.8 }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 58, left: "54%", background: COAL, opacity: 0.8 }} />
        <span
          className="tear-drip absolute rounded-full"
          style={{ width: 3, height: 3, bottom: 54, left: "42%", background: TEAR }}
        />
        <span
          className="absolute"
          style={{ bottom: 52, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "3px 5px 3px 0", borderColor: `transparent ${CARROT} transparent transparent` }}
        />
        {/* Flat downturned mouth — the one visible sign anything is wrong. */}
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-full" style={{ width: 12, height: 4, bottom: 46, background: COAL, opacity: 0.5 }} />

        <span className="absolute" style={{ bottom: 6, left: "50%", transform: "translateX(-50%)", width: 36, height: 22 }}>
          <span className="absolute rounded-full" style={{ width: 2, height: 20, left: 4, bottom: 0, background: NEEDLE, transform: "rotate(-8deg)" }} />
          <span className="absolute rounded-full" style={{ width: 2, height: 20, right: 4, bottom: 0, background: NEEDLE, transform: "rotate(8deg)" }} />
          <span className="knit-stitch absolute rounded-b-md" style={{ width: 14, height: 8, left: "50%", marginLeft: -7, bottom: 2, background: YARN }} />
        </span>
      </div>
    </div>
  );
}
