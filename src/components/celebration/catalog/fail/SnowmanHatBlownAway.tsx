"use client";

const SNOW = "#f2ede3";
const COAL = "#241c15";
const CARROT = "#e0a934";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";

// Story beats:
//   Phase 1 (0.00–0.6s, `hat-blow-away`, holds off-screen): the snowman's
//     own ushanka lifts off, tumbles sideways, and fades out past the
//     frame edge — gone, not coming back like BearUshankaVictoryToss's.
//   Loop (0.4s onward, `comic-shiver` reused): once bare-headed, the whole
//     snowman starts shivering — reused wholesale from UshankaHides.tsx,
//     the shiver reads the same on a snowman as on a bear.
/** EVERYDAY-tier fail scenario: the SnowmanDisco/SnowmanCongaLine snowman,
 * caught bare-headed in the wind. Same three-ball silhouette; the failure
 * is losing the hat outright rather than tipping over. */
export default function SnowmanHatBlownAway() {
  return (
    <div className="relative h-28 w-full max-w-[200px] overflow-hidden" aria-hidden="true">
      <div className="comic-shiver absolute bottom-2 left-1/2 -translate-x-1/2" style={{ width: 70, height: 84 }}>
        <span className="hat-blow-away absolute left-1/2" style={{ top: -18, width: 40, marginLeft: -20 }}>
          <span className="absolute rounded-b-full" style={{ width: 8, height: 16, top: 8, left: -3, background: HAT_FUR }} />
          <span className="absolute rounded-b-full" style={{ width: 8, height: 16, top: 8, right: -3, background: HAT_FUR }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 36, height: 8, top: 4, background: HAT_TRIM, borderRadius: 9999 }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 32, height: 16, top: -6, background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
        </span>

        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 62, height: 62, bottom: 0, background: SNOW }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 44, height: 44, bottom: 46, background: SNOW }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 30, height: 30, bottom: 78, background: SNOW }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 5, bottom: 96, left: "42%", background: COAL }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 5, bottom: 96, left: "54%", background: COAL }} />
        <span className="absolute" style={{ bottom: 90, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "4px 6px 4px 0", borderColor: `transparent ${CARROT} transparent transparent` }} />
      </div>
    </div>
  );
}
