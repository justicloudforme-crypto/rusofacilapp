"use client";

const GUSLI_BODY = "#c9962e";
const GUSLI_DARK = "#8a6a1e";
const STRING = "#fff8ec";
const SOUR = "#d63b2f";

// Story beats:
//   Phase 1 (0.00–0.35s, `string-stretch` reused): the middle string
//     overtightens, same setup as MatryoshkaBalalaikaStringSnap's build-up.
//   Phase 2 (0.35s, `string-snap-left` / `string-snap-right` reused): it
//     splits and both halves curl away — identical snap physics to the
//     balalaika string, just on the gusli's flat board instead of a neck.
/** EVERYDAY-tier fail scenario: the BearGusli win instrument, mid-song,
 * losing a string. Same trapezoid board shape; reuses the exact
 * string-snap keyframes from catalog/fail/MatryoshkaBalalaikaStringSnap.tsx
 * since the physical motion is identical. */
export default function GusliStringSnap() {
  return (
    <div className="relative flex h-24 items-center justify-center" aria-hidden="true">
      <span className="sour-note-wobble absolute select-none text-lg font-bold" style={{ top: "6%", right: "22%", color: SOUR }}>
        ♭
      </span>

      <div className="relative" style={{ width: 60, height: 44 }}>
        <span className="absolute inset-0" style={{ background: GUSLI_BODY, clipPath: "polygon(0% 100%, 30% 0%, 100% 0%, 100% 78%)" }} />
        <span className="absolute inset-x-2 bottom-2" style={{ height: 4, background: GUSLI_DARK }} />
        <span className="absolute" style={{ width: 2, top: 6, height: 30, left: 10, background: STRING, opacity: 0.7 }} />
        <span className="string-stretch absolute" style={{ width: 2, bottom: 8, height: 26, left: 28, background: STRING }} />
        <span className="string-snap-left absolute" style={{ width: 2, height: 14, top: 6, left: 28, background: STRING, transformOrigin: "top" }} />
        <span className="string-snap-right absolute" style={{ width: 2, height: 14, top: 6, left: 28, background: STRING, transformOrigin: "top" }} />
        <span className="absolute" style={{ width: 2, top: 6, height: 30, left: 46, background: STRING, opacity: 0.7 }} />
      </div>
    </div>
  );
}
