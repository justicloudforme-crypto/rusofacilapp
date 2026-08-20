"use client";

const SPOON_WOOD = "#c9962e";
const SPOON_TRIM = "#8a6a1e";

// Story beats:
//   Phase 1 (0.00–0.5s, `spoon-fumble-left` / `spoon-fumble-right`,
//     mirrored, holds tumbled): instead of SpoonsVirtuoso's controlled
//     bowl-to-bowl clack, both ложки fly out of frame in opposite
//     directions, spinning as they go — dropped mid-rhythm, not put down.
/** EVERYDAY-tier fail scenario: the SpoonsVirtuoso win pair losing their
 * grip entirely. Same wooden-spoon shape, thrown apart instead of clapped
 * together. */
export default function SpoonsFumble() {
  return (
    <div className="relative flex h-24 items-center justify-center gap-10" aria-hidden="true">
      <span className="spoon-fumble-left relative" style={{ width: 16, height: 60 }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 16, height: 20, top: 0, background: SPOON_WOOD }} />
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 4, height: 42, top: 18, background: SPOON_TRIM, borderRadius: 9999 }} />
      </span>
      <span className="spoon-fumble-right relative" style={{ width: 16, height: 60 }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 16, height: 20, top: 0, background: SPOON_WOOD }} />
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 4, height: 42, top: 18, background: SPOON_TRIM, borderRadius: 9999 }} />
      </span>
    </div>
  );
}
