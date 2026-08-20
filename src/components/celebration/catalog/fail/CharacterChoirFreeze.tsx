"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const ICE = "#c7dff0";

// Story beats:
//   Loop (0–0.5s, `ice-crust-freeze` reused from MatryoshkaIceShatter.tsx,
//     on all three singers, no stagger): the whole choir freezes solid at
//     once, mid-note, instead of swaying together like
//     CharacterChoirSing.tsx.
//   Loop (0–2.4s, `snowflake-piece` reused, a single lone flake): one
//     sad snowflake drifts down over the frozen group.
/** EVERYDAY-tier fail scenario: the CharacterChoirSing win, silenced mid-
 * verse by the cold. Same three-performer lineup; reuses ice-crust-freeze
 * and snowflake-piece wholesale. */
export default function CharacterChoirFreeze() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      <span className="snowflake-piece absolute select-none text-white" style={{ left: "48%", fontSize: 10, animationDuration: "2.2s" }}>
        ❄
      </span>

      <span className="relative">
        <MatryoshkaAvatar id="matryoshka_surprised" size={42} />
        <span className="ice-crust-freeze absolute inset-0 rounded-full" style={{ background: ICE }} />
      </span>

      <span className="relative" style={{ width: 54, height: 54 }}>
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
        <span className="ice-crust-freeze absolute inset-0" style={{ background: ICE, borderRadius: "40%" }} />
      </span>

      <span className="relative">
        <MatryoshkaAvatar id="matryoshka_wink" size={42} />
        <span className="ice-crust-freeze absolute inset-0 rounded-full" style={{ background: ICE }} />
      </span>
    </div>
  );
}
