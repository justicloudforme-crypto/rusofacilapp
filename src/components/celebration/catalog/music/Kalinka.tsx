"use client";

const BERRY = "#d63b2f";
const BERRY_SHINE = "#e88a80";
const LEAF = "#4a7a3a";
const NOTE_COLOR = "var(--color-primary)";

/** One of CelebrationModal's randomized scenarios: a "kalinka" (viburnum
 * berry cluster) bobbing in place with musical notes bouncing around it —
 * a nod to the folk song "Калинка-малинка". Same plain-div/Unicode-glyph
 * technique as the rest of the celebration cast. */
export default function Kalinka() {
  const berries = [
    { top: 6, left: 30, delay: "0s" },
    { top: 0, left: 50, delay: "0.1s" },
    { top: 10, left: 68, delay: "0.2s" },
    { top: 22, left: 40, delay: "0.15s" },
    { top: 24, left: 58, delay: "0.25s" },
  ];
  return (
    <div className="relative flex h-24 items-center justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 100, height: 70 }}>
        <span className="absolute rounded-full" style={{ width: 4, height: 30, left: "50%", bottom: 0, background: LEAF, transform: "translateX(-50%)" }} />
        <span className="absolute rounded-full" style={{ width: 22, height: 12, left: "20%", bottom: 20, background: LEAF, transform: "rotate(-20deg)" }} />
        <span className="absolute rounded-full" style={{ width: 22, height: 12, right: "20%", bottom: 20, background: LEAF, transform: "rotate(20deg)" }} />
        {berries.map((b, i) => (
          <span
            key={i}
            className="berry-bob absolute rounded-full"
            style={{ width: 16, height: 16, top: b.top, left: b.left, background: BERRY, animationDelay: b.delay }}
          >
            <span className="absolute rounded-full" style={{ width: 5, height: 5, top: 3, left: 3, background: BERRY_SHINE, opacity: 0.8 }} />
          </span>
        ))}
        <span className="note-float absolute select-none text-lg font-bold" style={{ left: "0%", top: "10%", color: NOTE_COLOR, animationDelay: "0.2s" }}>♪</span>
        <span className="note-float absolute select-none text-lg font-bold" style={{ right: "0%", top: "0%", color: NOTE_COLOR, animationDelay: "0.6s" }}>♫</span>
      </div>
    </div>
  );
}
