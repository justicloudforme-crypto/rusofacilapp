"use client";

const FUR = "#f2ede3";
const FUR_SHADE = "#d8d0c2";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const NOSE = "#d63b2f";
const CARROT = "#e0a934";
const CARROT_TOP = "#4a7a3a";

// Story beats:
//   Loop (0–0.5s, `carrot-raise`): the carrot lifts overhead and back down
//     in a small victory pump — same silhouette as the rabbit's usual
//     ushanka, just held up instead of worn on this occasion.
//   Loop (0–0.9s, `sparkle-twinkle` reused, delayed): a sparkle marks each
//     time the carrot reaches the top of its raise.
/** EVERYDAY-tier win scenario: the Winter.tsx ushanka rabbit, mid-hop with
 * a carrot held high — same ears/fur/hat vocabulary, new prop. */
export default function RabbitCarrotVictory() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 60, height: 78 }}>
        <span className="absolute rounded-full" style={{ width: 10, height: 26, left: 10, top: -18, background: FUR, transform: "rotate(-8deg)" }} />
        <span className="absolute rounded-full" style={{ width: 10, height: 26, right: 10, top: -18, background: FUR, transform: "rotate(8deg)" }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 16, left: 13, top: -14, background: FUR_SHADE, transform: "rotate(-8deg)" }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 16, right: 13, top: -14, background: FUR_SHADE, transform: "rotate(8deg)" }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 40, height: 40, top: 0, background: FUR }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 8, top: 2, background: HAT_TRIM }} />
          <span className="absolute rounded-full" style={{ width: 4, height: 4, top: 18, left: 11, background: INK }} />
          <span className="absolute rounded-full" style={{ width: 4, height: 4, top: 18, right: 11, background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 6, height: 5, top: 24, background: NOSE }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 28, bottom: 0, background: FUR }} />

        <span className="carrot-raise absolute" style={{ width: 8, height: 34, left: -8, top: 6, transformOrigin: "50% 100%" }}>
          <span className="absolute inset-x-0 bottom-0" style={{ height: 26, background: CARROT, borderRadius: "0 0 40% 40%", clipPath: "polygon(0% 0%, 100% 0%, 60% 100%, 40% 100%)" }} />
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full" style={{ width: 10, height: 8, background: CARROT_TOP }} />
        </span>
        <span
          className="sparkle-twinkle absolute select-none text-sm"
          style={{ top: -18, left: -14, animationDelay: "0.3s" }}
        >
          ✨
        </span>
      </div>
    </div>
  );
}
