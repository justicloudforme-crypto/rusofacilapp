"use client";

const HANDLE = "#5c3b26";
const LEAF = "#4a7a3a";
const DROPLET = "#c7dff0";
const STEAM = "#fff8ec";

// Story beats:
//   Loop (0–1.8s, `genie-swirl-rise` reused from SamovarSteamGenie.tsx): a
//     tall ribbon of steam corkscrews up and widens behind the veník —
//     same shape as the samovar's steam, just billowing around a broom
//     instead of a spout.
//   Loop (0–0.6s, `broom-wave` reused from BearBanyaBroom.tsx, gentler
//     arc): the veník sways lightly side to side, resting rather than
//     being waved overhead.
//   Loop (0–0.5s, `splash-pop` reused from BearFishSlipsAway.tsx,
//     staggered ×3): little droplets of clean water pop off the leaves
//     and fade — same physical pop as the ice-fishing splash, just clear
//     water instead of a fish's escape.
/** EVERYDAY-tier win scenario: a birch venik (bath broom) resting in rising
 * banya steam, flicking clean droplets — the calm counterpart to
 * BearBanyaBroom.tsx's energetic overhead wave. Reuses genie-swirl-rise,
 * broom-wave, and splash-pop wholesale. */
export default function BanyaSteamRefresh() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <span className="genie-swirl-rise absolute rounded-full" style={{ width: 40, height: 60, left: "50%", marginLeft: -20, top: -40, background: STEAM, opacity: 0.5 }} />

      <span className="broom-wave relative" style={{ width: 10, height: 60, transformOrigin: "50% 100%" }}>
        <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 30, background: HANDLE }} />
        <span className="absolute inset-x-0 top-0" style={{ height: 34, background: LEAF, clipPath: "polygon(10% 100%, 0% 20%, 30% 0%, 70% 0%, 100% 20%, 90% 100%)" }} />

        <span className="splash-pop absolute rounded-full" style={{ width: 4, height: 4, top: 6, left: -6, background: DROPLET, animationDelay: "0.1s" }} />
        <span className="splash-pop absolute rounded-full" style={{ width: 4, height: 4, top: 14, right: -6, background: DROPLET, animationDelay: "0.3s" }} />
        <span className="splash-pop absolute rounded-full" style={{ width: 3, height: 3, top: 24, left: -4, background: DROPLET, animationDelay: "0.5s" }} />
      </span>
    </div>
  );
}
