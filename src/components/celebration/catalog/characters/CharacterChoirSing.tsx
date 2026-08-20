"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";

const NOTES = ["♪", "♫", "♬"];

// Story beats:
//   Loop (0–1.6s, `bear-bounce` reused, on all three singers, staggered):
//     each performer sways gently in place, slightly out of phase so the
//     group reads as singing together rather than one puppet copied
//     three times.
//   Loop (0–1.6s, `note-float` reused, staggered ×3): notes rise from the
//     whole group, same shape used across every music scenario.
/** STREAK-tier win scenario: a small choir — a bear and two dolls —
 * singing together, busier than the everyday pool. Reuses
 * MatryoshkaAvatar, bear-bounce, and note-float wholesale. */
export default function CharacterChoirSing() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      {NOTES.map((note, i) => (
        <span
          key={note + i}
          className="note-float absolute select-none text-base font-bold"
          style={{ left: `${16 + i * 30}%`, bottom: "60%", color: i % 2 === 0 ? "var(--brand-accent)" : "var(--brand)", animationDelay: `${i * 0.4}s`, animationDuration: "1.8s" }}
        >
          {note}
        </span>
      ))}

      <span className="bear-bounce" style={{ animationDelay: "0s" }}>
        <MatryoshkaAvatar id="matryoshka_laughing" size={42} />
      </span>

      <span className="bear-bounce relative" style={{ width: 54, height: 54, animationDelay: "0.15s" }}>
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
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "16%", height: "12%", top: "58%", background: INK }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />
      </span>

      <span className="bear-bounce" style={{ animationDelay: "0.3s" }}>
        <MatryoshkaAvatar id="matryoshka_happy" size={42} />
      </span>
    </div>
  );
}
