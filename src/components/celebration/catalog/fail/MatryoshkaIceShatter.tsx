"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const ICE = "#c7dff0";

// Story beats:
//   Loop (0–0.6s, `ice-crust-freeze`): a pale blue crust over her pulses
//     once, tightening — she's fully frozen, holding still.
//   Phase (0.5–0.9s, `pelmeni-scatter` reused, staggered ×6): the crust
//     bursts into shard pieces that tumble outward — same tumble-and-
//     settle physics already used for spilled dumplings, snow blocks, and
//     snowballs elsewhere in the catalog, now standing in for cracking
//     ice.
/** EVERYDAY-tier fail scenario: the doll frozen solid, then shattering
 * the instant she tries to move. Reuses MatryoshkaAvatar for the face and
 * the pelmeni-scatter burst wholesale for the ice shards. */
export default function MatryoshkaIceShatter() {
  const shards = [
    { left: "4%", top: "20%", delay: "0.5s" },
    { left: "70%", top: "16%", delay: "0.56s" },
    { left: "-6%", top: "50%", delay: "0.62s" },
    { left: "80%", top: "48%", delay: "0.68s" },
    { left: "10%", top: "78%", delay: "0.74s" },
    { left: "64%", top: "80%", delay: "0.8s" },
  ];
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 56 }}>
        <MatryoshkaAvatar id="matryoshka_surprised" size={56} />
        <span className="ice-crust-freeze absolute inset-0 rounded-full" style={{ background: ICE }} />

        {shards.map((s, i) => (
          <span
            key={i}
            className="pelmeni-scatter absolute"
            style={{ width: 8, height: 8, left: s.left, top: s.top, background: ICE, clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)", animationDelay: s.delay }}
          />
        ))}
      </div>
    </div>
  );
}
