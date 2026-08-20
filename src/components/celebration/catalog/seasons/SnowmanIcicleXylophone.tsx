"use client";

const SNOW = "#f2ede3";
const COAL = "#241c15";
const CARROT = "#e0a934";
const ICICLE = "#c7dff0";
const TWIG = "#5c3b26";

const NOTES = ["♪", "♫"];

// Story beats:
//   Loop (0–0.7s, `icicle-strike-left` / `icicle-strike-right`, mirrored):
//     two twig "mallets" tap down onto the icicle row in alternating
//     order, same offbeat rhythm as BearValenkiDance's stomps.
//   Loop (0–0.9s, `sparkle-twinkle` reused, staggered ×3 along the row):
//     each icicle glints right as its mallet lands.
//   Loop (0–1.6s, `note-float` reused, staggered ×2): notes rise from the
//     row, same as every other music-themed scenario.
/** EVERYDAY-tier win scenario: the SnowmanDisco/SnowmanCongaLine snowman
 * playing a row of hanging icicles like a xylophone. Same three-ball
 * silhouette; new prop built from plain tapered spans. */
export default function SnowmanIcicleXylophone() {
  const icicles = [18, 26, 14, 30, 20];
  return (
    <div className="relative flex h-28 items-end justify-center gap-4" aria-hidden="true">
      <div className="relative" style={{ width: 54, height: 78 }}>
        {NOTES.map((note, i) => (
          <span
            key={note + i}
            className="note-float absolute select-none text-base font-bold"
            style={{ left: `${10 + i * 50}%`, top: "-6%", color: i % 2 === 0 ? "var(--brand-accent)" : "var(--brand)", animationDelay: `${i * 0.5}s`, animationDuration: "1.7s" }}
          >
            {note}
          </span>
        ))}
        <span className="icicle-strike-left absolute" style={{ width: 3, height: 24, left: -2, top: 4, background: TWIG, borderRadius: 9999, transformOrigin: "50% 0%" }} />
        <span className="icicle-strike-right absolute" style={{ width: 3, height: 24, right: -2, top: 4, background: TWIG, borderRadius: 9999, transformOrigin: "50% 0%" }} />

        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 48, height: 48, bottom: 0, background: SNOW }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 34, bottom: 38, background: SNOW }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 58, left: "40%", background: COAL }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 58, left: "56%", background: COAL }} />
        <span className="absolute" style={{ bottom: 52, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "3px 5px 3px 0", borderColor: `transparent ${CARROT} transparent transparent` }} />
      </div>

      <div className="relative flex items-end gap-1" style={{ height: 60 }}>
        {icicles.map((h, i) => (
          <span key={i} className="relative" style={{ width: 8, height: h }}>
            <span className="absolute inset-0" style={{ background: ICICLE, clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)" }} />
            <span
              className="sparkle-twinkle absolute select-none text-[9px]"
              style={{ top: -8, left: "50%", marginLeft: -5, animationDelay: `${0.15 + i * 0.12}s` }}
            >
              ✨
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
