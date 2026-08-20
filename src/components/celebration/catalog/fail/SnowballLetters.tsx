"use client";

const SNOW = "#f2ede3";
const COAL = "#241c15";
const CARROT = "#e0a934";
const LETTER = "#2d5f8a";

const LETTERS = ["А", "Б", "В", "Ё"];

// Story beats:
//   Phase 1 (0.00–0.9s, `letters-scatter-fall`, staggered ×4): four
//     Cyrillic letters tumble down from above at different speeds and
//     rotations — the alphabet the student was trying to hold onto,
//     literally coming apart.
//   Phase 2 (0.75–1.05s, `snowman-toppled`, holds tipped over): right as
//     the letters land, the snowman keels over onto its side — the "got
//     knocked flat trying to catch them" beat.
/** EVERYDAY-tier fail scenario: the CelebrationWinter/SnowmanDisco
 * snowman, but overwhelmed instead of celebrating — same three-ball
 * silhouette, tipped on its side under a small hail of loose letters. */
export default function SnowballLetters() {
  return (
    <div className="relative h-28 w-full max-w-[200px] overflow-hidden" aria-hidden="true">
      {LETTERS.map((letter, i) => (
        <span
          key={letter}
          className="letters-scatter-fall absolute select-none text-sm font-bold"
          style={{ left: `${10 + i * 24}%`, color: LETTER, animationDelay: `${i * 0.15}s` }}
        >
          {letter}
        </span>
      ))}

      <div className="snowman-toppled absolute bottom-2 left-1/2 -translate-x-1/2" style={{ width: 70, height: 64, transformOrigin: "50% 100%" }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 56, height: 46, bottom: 0, background: SNOW }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 38, height: 32, bottom: 34, background: SNOW }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 52, left: "42%", background: COAL, opacity: 0.7 }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 52, left: "54%", background: COAL, opacity: 0.7 }} />
        <span
          className="absolute"
          style={{ bottom: 50, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "3px 5px 3px 0", borderColor: `transparent ${CARROT} transparent transparent` }}
        />
      </div>
    </div>
  );
}
