"use client";

const SNOW = "#f2ede3";
const COAL = "#241c15";
const CARROT = "#e0a934";
const SLED_WOOD = "#5c3b26";
const SLED_TRIM = "#e0a934";

// Story beats:
//   Phase 1 (0.00–0.4s, `sled-crash-flip`, holds upended): the sled tips
//     nose-first and flips, throwing its rider — the abrupt stop
//     SnowmanSledding.tsx's smooth glide never has to make.
//   Phase 2 (0.15–0.75s, `pelmeni-scatter` reused, staggered ×5): loose
//     snow chunks burst outward from the crash point — same tumble-and-
//     settle physics as BearDropsPelmeni.tsx's spilled dumplings.
/** EVERYDAY-tier fail scenario: the SnowmanSledding win, crashed into a
 * snowbank instead of gliding smoothly. Same sled/snowman vocabulary,
 * reuses the pelmeni-scatter debris keyframe wholesale for the flying
 * snow. */
export default function SnowmanSleddingCrash() {
  const chunks = [
    { left: "8%", top: "62%", delay: "0.15s" },
    { left: "26%", top: "78%", delay: "0.27s" },
    { left: "50%", top: "70%", delay: "0.39s" },
    { left: "68%", top: "82%", delay: "0.51s" },
    { left: "84%", top: "66%", delay: "0.63s" },
  ];
  return (
    <div className="relative flex h-28 items-end justify-center overflow-hidden" aria-hidden="true">
      {chunks.map((c, i) => (
        <span
          key={i}
          className="pelmeni-scatter absolute rounded-full bg-white"
          style={{ width: 8, height: 8, left: c.left, top: c.top, opacity: 0.85, animationDelay: c.delay }}
        />
      ))}

      <div className="sled-crash-flip relative" style={{ width: 90, height: 78, transformOrigin: "20% 100%" }}>
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2" style={{ width: 56, height: 56 }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 40, height: 40, bottom: 0, background: SNOW }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 26, height: 26, bottom: 30, background: SNOW }} />
          <span className="absolute rounded-full" style={{ width: 3, height: 3, bottom: 44, left: "38%", background: COAL }} />
          <span className="absolute rounded-full" style={{ width: 3, height: 3, bottom: 44, left: "56%", background: COAL }} />
          <span className="absolute" style={{ bottom: 40, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "3px 4px 3px 0", borderColor: `transparent ${CARROT} transparent transparent` }} />
        </span>

        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-lg" style={{ width: 78, height: 10, background: SLED_WOOD }}>
          <span className="absolute inset-x-0 top-0" style={{ height: 3, background: SLED_TRIM }} />
        </span>
      </div>
    </div>
  );
}
