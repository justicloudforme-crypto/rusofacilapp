"use client";

const SNOW = "#f2ede3";
const COAL = "#241c15";
const CARROT = "#e0a934";
const ICICLE = "#c7dff0";
const SOUR = "#d63b2f";

// Story beats:
//   Phase 1 (0.00–0.5s, `icicle-crack-fall`, holds fallen): the middle
//     icicle in the row snaps at its base and drops straight down out of
//     frame — the one wrong note SnowmanIcicleXylophone's mallets never
//     hit.
//   Loop (0–1s, `sour-note-wobble` reused): a flat-note glyph wobbles
//     above the gap where it used to hang.
/** EVERYDAY-tier fail scenario: the SnowmanIcicleXylophone win, missing a
 * note. Same icicle-row prop and snowman silhouette; one icicle breaks
 * instead of chiming. */
export default function SnowmanIcicleCrack() {
  const icicles = [18, 26, 30, 20];
  return (
    <div className="relative flex h-28 items-end justify-center gap-4" aria-hidden="true">
      <div className="relative" style={{ width: 54, height: 78 }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 48, height: 48, bottom: 0, background: SNOW }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 34, bottom: 38, background: SNOW }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 58, left: "40%", background: COAL }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 58, left: "56%", background: COAL }} />
        <span className="absolute" style={{ bottom: 52, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "3px 5px 3px 0", borderColor: `transparent ${CARROT} transparent transparent` }} />
      </div>

      <div className="relative flex items-end gap-1" style={{ height: 60 }}>
        <span className="sour-note-wobble absolute select-none text-sm font-bold" style={{ top: -14, left: 22, color: SOUR }}>
          ♭
        </span>
        {icicles.map((h, i) => (
          <span key={i} className="relative" style={{ width: 8, height: h }}>
            <span className="absolute inset-0" style={{ background: ICICLE, clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)" }} />
          </span>
        ))}
        <span className="icicle-crack-fall absolute" style={{ width: 8, height: 24, left: 18, top: 12 }}>
          <span className="absolute inset-0" style={{ background: ICICLE, clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)" }} />
        </span>
      </div>
    </div>
  );
}
