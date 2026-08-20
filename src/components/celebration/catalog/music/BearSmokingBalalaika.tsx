"use client";

const FUR = "#8a5a3a";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const MUZZLE = "#e6c9a0";
const INK = "#241c15";
const BALALAIKA_BODY = "#e0a934";
const BALALAIKA_NECK = "#5c3b26";
const STRING = "#fff8ec";
const SMOKE = "#c9c2b8";

// Story beats:
//   Loop (0–0.6s, `balalaika-shred`): the balalaika rocks side to side much
//     faster and further than the everyday CelebrationBear's calm strum —
//     "playing so hard it's a blur".
//   Loop (0–1.4s, `smoke-puff`, staggered ×3): little grey puffs drift up
//     from where the hand meets the strings, growing and fading — the
//     literal "smoking from friction" joke.
//   Loop (0–1.6s, `bear-bounce`, reused from the everyday bear): the whole
//     bear headbangs along, just slightly faster than usual.
/** STREAK-tier win scenario: the everyday CelebrationBear pushed past his
 * limit — reuses the same shape vocabulary (ushanka, muzzle) but the
 * balalaika now visibly overheats. Meant for a correct-answer streak
 * milestone, where "getting faster" is the whole joke. */
export default function BearSmokingBalalaika() {
  return (
    <div className="relative" style={{ width: 100, height: 100 }} aria-hidden="true">
      <div className="bear-bounce relative h-full w-full">
        <span className="absolute rounded-full" style={{ width: "20%", aspectRatio: "1", top: "6%", left: "8%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "20%", aspectRatio: "1", top: "6%", right: "8%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "58%", aspectRatio: "1", top: "12%", background: FUR }}>
          <span className="absolute rounded-b-full" style={{ width: "15%", height: "34%", top: "38%", left: "-5%", background: HAT_FUR }} />
          <span className="absolute rounded-b-full" style={{ width: "15%", height: "34%", top: "38%", right: "-5%", background: HAT_FUR }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "82%", height: "12%", top: "16%", background: HAT_TRIM, borderRadius: 9999 }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "78%", height: "30%", top: "-9%", background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "44%", height: "36%", top: "50%", background: MUZZLE }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", left: "26%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", right: "26%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "26%", height: "8%", top: "66%", background: INK, opacity: 0.55, borderRadius: "0 0 9999px 9999px" }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "62%", height: "32%", bottom: 0, background: FUR, borderRadius: "40% 40% 18% 18% / 60% 60% 18% 18%" }} />

        <span
          className="balalaika-shred absolute"
          style={{ width: "38%", height: "38%", bottom: "8%", right: "-6%", transformOrigin: "80% 100%" }}
        >
          <span className="absolute inset-0" style={{ background: BALALAIKA_BODY, clipPath: "polygon(50% 0%, 8% 100%, 92% 100%)" }} />
          <span className="absolute" style={{ width: "14%", height: "66%", left: "43%", bottom: "64%", background: BALALAIKA_NECK }} />
          {[30, 50, 70].map((left) => (
            <span key={left} className="absolute" style={{ width: 2, height: "48%", left: `${left}%`, bottom: "20%", background: STRING, opacity: 0.6 }} />
          ))}
          {[0, 0.45, 0.9].map((delay, i) => (
            <span
              key={i}
              className="smoke-puff absolute rounded-full"
              style={{ width: 8, height: 8, left: `${34 + i * 8}%`, bottom: "60%", background: SMOKE, animationDelay: `${delay}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
