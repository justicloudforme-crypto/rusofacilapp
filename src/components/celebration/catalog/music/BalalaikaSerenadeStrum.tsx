"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const BODY = "#e0a934";
const NECK = "#5c3b26";
const STRING = "#fff8ec";
const PEG = "#3a2a20";

const NOTES = ["♪", "♫"];

// Story beats:
//   Loop (0–0.9s, `balalaika-strum` reused from Bear.tsx/BalalaikaParty.tsx):
//     the same idle strum shared across every balalaika scene in the
//     catalog.
//   Loop (0–1.6s, `note-float` reused, staggered ×2, slower duration than
//     BalalaikaParty's): notes drift up unhurried — a quiet serenade, not
//     a party.
/** EVERYDAY-tier win scenario: a doll giving a mellow balalaika serenade —
 * the calm, doll-led companion to Bear.tsx's milestone performance and
 * BalalaikaParty.tsx's up-tempo streak scene. Reuses MatryoshkaAvatar and
 * the balalaika-strum/note-float keyframes wholesale. */
export default function BalalaikaSerenadeStrum() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      <div className="relative" style={{ width: 52, height: 52 }}>
        <MatryoshkaAvatar id="matryoshka_calm" size={52} />
      </div>

      <div className="relative" style={{ width: 50, height: 66 }}>
        {NOTES.map((note, i) => (
          <span
            key={note + i}
            className="note-float absolute select-none text-base font-bold"
            style={{ left: `${10 + i * 40}%`, top: "-10%", color: i % 2 === 0 ? "var(--color-folk-red)" : "var(--color-primary)", animationDelay: `${i * 0.6}s`, animationDuration: "2.2s" }}
          >
            {note}
          </span>
        ))}

        <div className="balalaika-strum relative" style={{ width: 50, height: 66, transformOrigin: "80% 100%" }}>
          <span className="absolute inset-0" style={{ background: BODY, clipPath: "polygon(50% 0%, 8% 100%, 92% 100%)" }} />
          <span className="absolute rounded-full" style={{ width: 14, height: 14, left: "42%", bottom: "94%", background: PEG }} />
          <span className="absolute" style={{ width: 8, height: 40, left: "45%", bottom: "56%", background: NECK }} />
          <span className="absolute" style={{ width: 2, height: 34, left: "30%", bottom: "16%", background: STRING, opacity: 0.85 }} />
          <span className="absolute" style={{ width: 2, height: 34, left: "50%", bottom: "16%", background: STRING, opacity: 0.85 }} />
          <span className="absolute" style={{ width: 2, height: 34, left: "70%", bottom: "16%", background: STRING, opacity: 0.85 }} />
        </div>
      </div>
    </div>
  );
}
