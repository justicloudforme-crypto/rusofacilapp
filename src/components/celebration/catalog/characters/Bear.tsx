"use client";

// Fixed (theme-independent) palette for the bear — same "literal painted
// object" reasoning as MatryoshkaMark.tsx: a folk mascot doesn't repaint
// itself for dark mode. Sash colors reuse the brand's red/gold so the
// character still reads as part of the same identity, not a random bear.
const FUR = "#8a5a3a";
const FUR_DARK = "#5c3b26";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const SASH = "#d63b2f";
const SASH_TRIM = "#e0a934";
const BALALAIKA_BODY = "#e0a934";
const BALALAIKA_NECK = "#5c3b26";
const STRING = "#fff8ec";
const INK = "#241c15";

/** CelebrationModal's hero for bigger milestones (streak/exam/badge —
 * left for future call sites to opt into via `variant="bear"`): a bear in
 * an ushanka strumming a balalaika. Built from the same plain-div
 * border-radius/clip-path technique as MatryoshkaMark/MatryoshkaAvatar —
 * no image or SVG asset, just ~16 positioned spans. Gentle idle
 * bounce + strum loop (see globals.css); purely decorative. */
export default function Bear({ size = 96 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }} aria-hidden="true">
      <div className="bear-bounce relative h-full w-full">
        {/* Ears */}
        <span
          className="absolute rounded-full"
          style={{ width: "22%", aspectRatio: "1", top: "6%", left: "6%", background: FUR }}
        />
        <span
          className="absolute rounded-full"
          style={{ width: "22%", aspectRatio: "1", top: "6%", right: "6%", background: FUR }}
        />

        {/* Head */}
        <span
          className="absolute left-1/2 -translate-x-1/2 rounded-full"
          style={{ width: "62%", aspectRatio: "1", top: "12%", background: FUR }}
        >
          {/* Ushanka ear flaps, drawn first so the band/pompom below sit on top */}
          <span
            className="absolute rounded-b-full"
            style={{ width: "16%", height: "36%", top: "38%", left: "-6%", background: HAT_FUR }}
          />
          <span
            className="absolute rounded-b-full"
            style={{ width: "16%", height: "36%", top: "38%", right: "-6%", background: HAT_FUR }}
          />
          {/* Ushanka band across the forehead */}
          <span
            className="absolute left-1/2 -translate-x-1/2"
            style={{ width: "84%", height: "12%", top: "16%", background: HAT_TRIM, borderRadius: "9999px" }}
          />
          {/* Ushanka crown */}
          <span
            className="absolute left-1/2 -translate-x-1/2"
            style={{ width: "80%", height: "32%", top: "-10%", background: HAT_FUR, borderRadius: "50% 50% 0 0" }}
          />
          {/* Pompom */}
          <span
            className="absolute left-1/2 -translate-x-1/2 rounded-full"
            style={{ width: "14%", aspectRatio: "1", top: "-18%", background: HAT_TRIM }}
          />

          {/* Muzzle */}
          <span
            className="absolute left-1/2 -translate-x-1/2 rounded-full"
            style={{ width: "56%", height: "38%", top: "50%", background: MUZZLE }}
          />
          {/* Eyes */}
          <span
            className="absolute rounded-full"
            style={{ width: "9%", aspectRatio: "1", top: "42%", left: "27%", background: INK }}
          />
          <span
            className="absolute rounded-full"
            style={{ width: "9%", aspectRatio: "1", top: "42%", right: "27%", background: INK }}
          />
          {/* Nose */}
          <span
            className="absolute left-1/2 -translate-x-1/2 rounded-full"
            style={{ width: "13%", height: "9%", top: "56%", background: INK }}
          />
          {/* Smile */}
          <span
            className="absolute left-1/2 -translate-x-1/2"
            style={{ width: "22%", height: "8%", top: "68%", background: INK, opacity: 0.55, borderRadius: "0 0 9999px 9999px" }}
          />
        </span>

        {/* Body, with a folk sash */}
        <span
          className="absolute left-1/2 -translate-x-1/2"
          style={{ width: "70%", height: "36%", bottom: 0, background: FUR, borderRadius: "40% 40% 20% 20% / 60% 60% 20% 20%" }}
        >
          <span className="absolute inset-x-0" style={{ top: "20%", height: "24%", background: SASH }} />
          <span className="absolute inset-x-0" style={{ top: "44%", height: "9%", background: SASH_TRIM }} />
        </span>

        {/* Balalaika, held to the bear's side */}
        <span
          className="balalaika-strum absolute"
          style={{ width: "36%", height: "36%", bottom: "8%", right: "-4%", transformOrigin: "80% 100%" }}
        >
          <span
            className="absolute inset-0"
            style={{ background: BALALAIKA_BODY, clipPath: "polygon(50% 0%, 8% 100%, 92% 100%)" }}
          />
          <span
            className="absolute rounded-full"
            style={{ width: "20%", aspectRatio: "1", left: "40%", bottom: "126%", background: FUR_DARK }}
          />
          <span className="absolute" style={{ width: "14%", height: "68%", left: "43%", bottom: "66%", background: BALALAIKA_NECK }} />
          <span className="absolute" style={{ width: "2px", height: "48%", left: "36%", bottom: "22%", background: STRING, opacity: 0.8 }} />
          <span className="absolute" style={{ width: "2px", height: "48%", left: "50%", bottom: "22%", background: STRING, opacity: 0.8 }} />
          <span className="absolute" style={{ width: "2px", height: "48%", left: "64%", bottom: "22%", background: STRING, opacity: 0.8 }} />
        </span>
      </div>
    </div>
  );
}
