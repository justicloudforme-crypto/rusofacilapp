"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const GUSLI_BODY = "#c9962e";
const GUSLI_DARK = "#8a6a1e";
const STRING = "#fff8ec";

const NOTES = ["♪", "♫"];

// Story beats:
//   Loop (0–0.9s, `sparkle-twinkle` reused, staggered ×3): little glints
//     pop along the strings in sequence, left to right — a strum reads
//     better as traveling light than as string wobble at this size.
//   Loop (0–1.6s, `note-float` reused, staggered ×2): notes drift up from
//     the sound board, same as every other music/ scenario.
/** EVERYDAY-tier win scenario: a bear plucking a gusli (a flat trapezoid
 * folk harp/zither) instead of the usual balalaika — same fur/ushanka
 * vocabulary as the rest of the bear cast, new instrument shape built from
 * a clipped trapezoid and plain string spans. */
export default function BearGusli() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-2" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 56 }}>
        <span className="absolute rounded-full" style={{ width: "24%", aspectRatio: "1", top: "2%", left: "4%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "24%", aspectRatio: "1", top: "2%", right: "4%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "76%", aspectRatio: "1", top: "10%", background: FUR }}>
          <span className="absolute rounded-b-full" style={{ width: "18%", height: "38%", top: "36%", left: "-8%", background: HAT_FUR }} />
          <span className="absolute rounded-b-full" style={{ width: "18%", height: "38%", top: "36%", right: "-8%", background: HAT_FUR }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "88%", height: "14%", top: "14%", background: HAT_TRIM, borderRadius: 9999 }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "82%", height: "34%", top: "-12%", background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "58%", height: "40%", top: "48%", background: MUZZLE }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "38%", left: "26%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "38%", right: "26%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "13%", height: "9%", top: "58%", background: INK }} />
        </span>
      </div>

      <div className="relative" style={{ width: 60, height: 44 }}>
        {NOTES.map((note, i) => (
          <span
            key={note + i}
            className="note-float absolute select-none text-base font-bold"
            style={{ left: `${20 + i * 40}%`, top: "-10%", color: i % 2 === 0 ? "var(--brand-accent)" : "var(--brand)", animationDelay: `${i * 0.5}s`, animationDuration: "1.7s" }}
          >
            {note}
          </span>
        ))}
        <span className="absolute inset-0" style={{ background: GUSLI_BODY, clipPath: "polygon(0% 100%, 30% 0%, 100% 0%, 100% 78%)" }} />
        <span className="absolute inset-x-2 bottom-2" style={{ height: 4, background: GUSLI_DARK }} />
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="sparkle-twinkle absolute"
            style={{ width: 2, top: 6, bottom: 8, left: 10 + i * 9, background: STRING, opacity: 0.9, animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </div>
  );
}
