"use client";

const BODY = "#e0a934";
const NECK = "#5c3b26";
const STRING = "#fff8ec";
const PEG = "#3a2a20";

const NOTES = ["♪", "♫", "♬", "♪"];

/** One of CelebrationModal's randomized scenarios: a balalaika strumming
 * (reusing the CelebrationBear.tsx shape/animation) with musical notes —
 * plain Unicode glyphs, not icon assets — floating up and fading around
 * it. */
export default function BalalaikaParty() {
  return (
    <div className="relative flex h-24 w-full max-w-[200px] items-end justify-center" aria-hidden="true">
      {NOTES.map((note, i) => (
        <span
          key={i}
          className="note-float select-none text-lg font-bold"
          style={{
            left: `${18 + i * 20}%`,
            bottom: "50%",
            color: i % 2 === 0 ? "var(--brand-accent)" : "var(--brand)",
            animationDelay: `${i * 0.3}s`,
            animationDuration: `${1.6 + i * 0.15}s`,
          }}
        >
          {note}
        </span>
      ))}

      <div className="balalaika-strum relative" style={{ width: 60, height: 76, transformOrigin: "80% 100%" }}>
        <span className="absolute inset-0" style={{ background: BODY, clipPath: "polygon(50% 0%, 8% 100%, 92% 100%)" }} />
        <span className="absolute rounded-full" style={{ width: 16, height: 16, left: "42%", bottom: "94%", background: PEG }} />
        <span className="absolute" style={{ width: 10, height: 46, left: "45%", bottom: "56%", background: NECK }} />
        <span className="absolute" style={{ width: 2, height: 40, left: "30%", bottom: "16%", background: STRING, opacity: 0.85 }} />
        <span className="absolute" style={{ width: 2, height: 40, left: "50%", bottom: "16%", background: STRING, opacity: 0.85 }} />
        <span className="absolute" style={{ width: 2, height: 40, left: "70%", bottom: "16%", background: STRING, opacity: 0.85 }} />
      </div>
    </div>
  );
}
