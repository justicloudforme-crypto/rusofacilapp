"use client";

const FUR = "#8a5a3a";
const FUR_DARK = "#5c3b26";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const BALALAIKA_BODY = "#e0a934";
const BALALAIKA_NECK = "#5c3b26";
const STRING = "#fff8ec";
const FLAME_OUTER = "#e0a934";
const FLAME_INNER = "#d63b2f";

const NOTES = ["♪", "♫", "♬"];

// Story beats:
//   Loop (0–0.9s, `balalaika-strum` reused from Bear.tsx/BalalaikaParty.tsx):
//     the same idle strum as the rest of the balalaika cast.
//   Loop (0–1.6s, `bear-bounce` reused): a small triumphant bounce the
//     whole time.
//   Loop (0–0.7s, `flame-flicker` reused from StoveFire.tsx, staggered
//     ×2): a small campfire flickers beside him — an evening jam session,
//     not a daytime performance, which is what sets this apart from the
//     other balalaika-playing scenarios sharing the same instrument shape.
//   Loop (0–1.6s, `note-float` reused, staggered ×3): notes drift up past
//     the firelight.
/** EVERYDAY-tier win scenario: a bear playing balalaika by a campfire in
 * the evening. Same fur/ushanka/balalaika vocabulary shared across the
 * whole cast — reuses balalaika-strum, bear-bounce, flame-flicker, and
 * note-float wholesale; the campfire setting is what makes this read as
 * its own moment rather than a repeat of Bear.tsx or BalalaikaParty.tsx. */
export default function BearBalalaikaFireside() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-2" aria-hidden="true">
      {NOTES.map((note, i) => (
        <span
          key={note + i}
          className="note-float absolute select-none text-base font-bold"
          style={{ left: `${14 + i * 24}%`, bottom: "60%", color: i % 2 === 0 ? "var(--color-folk-red)" : "var(--color-primary)", animationDelay: `${i * 0.4}s`, animationDuration: "1.7s" }}
        >
          {note}
        </span>
      ))}

      <div className="bear-bounce relative" style={{ width: 60, height: 60 }}>
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", left: "6%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", right: "6%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "70%", aspectRatio: "1", top: "10%", background: FUR }}>
          <span className="absolute rounded-b-full" style={{ width: "16%", height: "36%", top: "38%", left: "-6%", background: HAT_FUR }} />
          <span className="absolute rounded-b-full" style={{ width: "16%", height: "36%", top: "38%", right: "-6%", background: HAT_FUR }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "84%", height: "12%", top: "16%", background: HAT_TRIM, borderRadius: 9999 }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "80%", height: "32%", top: "-10%", background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "56%", height: "38%", top: "50%", background: MUZZLE }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", left: "27%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", right: "27%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "13%", height: "9%", top: "56%", background: INK }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />

        <span className="balalaika-strum absolute" style={{ width: "40%", height: "40%", bottom: "6%", right: "-6%", transformOrigin: "80% 100%" }}>
          <span className="absolute inset-0" style={{ background: BALALAIKA_BODY, clipPath: "polygon(50% 0%, 8% 100%, 92% 100%)" }} />
          <span className="absolute rounded-full" style={{ width: "20%", aspectRatio: "1", left: "40%", bottom: "126%", background: FUR_DARK }} />
          <span className="absolute" style={{ width: "14%", height: "68%", left: "43%", bottom: "66%", background: BALALAIKA_NECK }} />
          <span className="absolute" style={{ width: "2px", height: "48%", left: "36%", bottom: "22%", background: STRING, opacity: 0.8 }} />
          <span className="absolute" style={{ width: "2px", height: "48%", left: "50%", bottom: "22%", background: STRING, opacity: 0.8 }} />
          <span className="absolute" style={{ width: "2px", height: "48%", left: "64%", bottom: "22%", background: STRING, opacity: 0.8 }} />
        </span>
      </div>

      <div className="relative" style={{ width: 30, height: 30 }}>
        <span className="flame-flicker absolute left-1/2 -translate-x-1/2 rounded-t-full" style={{ width: 14, height: 18, bottom: 0, background: FLAME_OUTER, transformOrigin: "50% 100%" }} />
        <span className="flame-flicker absolute left-1/2 -translate-x-1/2 rounded-t-full" style={{ width: 8, height: 11, bottom: 0, background: FLAME_INNER, transformOrigin: "50% 100%", animationDelay: "0.2s" }} />
      </div>
    </div>
  );
}
