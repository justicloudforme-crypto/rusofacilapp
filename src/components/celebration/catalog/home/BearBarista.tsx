"use client";

const FUR = "#8a5a3a";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const MUZZLE = "#e6c9a0";
const INK = "#241c15";
const SAMOVAR_BODY = "#c9962e";
const SAMOVAR_DARK = "#8a6a1e";
const TEA = "#8a4a1e";
const CUP_TRIM = "#2d5f8a";

// Story beats:
//   Phase 1 (0.00–0.25s, `barista-tilt`, one-shot hold): the samovar tips a
//     few degrees toward the cup — the pour begins.
//   Phase 2 (0.15–0.55s, `tea-stream-fall`): a thin amber stream stretches
//     from the spout down to the cup rim, then vanishes — one clean pour.
//   Phase 3 (0.45s onward, `tea-fill-rise`, one-shot hold): the cup's tea
//     level rises to full, staying filled.
//   Phase 4 (0.7s onward, `barista-wink`, loop): the bear's left eye
//     squashes shut and back on a slow, deliberate loop — the "you're
//     welcome" wink, repeated because the moment is worth savoring.
/** MILESTONE-tier win scenario: the CelebrationBear cast serving tea
 * instead of playing balalaika — reuses the ushanka/muzzle vocabulary from
 * catalog/characters/Bear.tsx and the samovar body from catalog/home/
 * Samovar.tsx side by side. */
export default function BearBarista() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-2" aria-hidden="true">
      <div className="barista-tilt relative" style={{ width: 44, height: 60, transformOrigin: "bottom right" }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 8, height: 8, top: 0, background: SAMOVAR_DARK }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-2xl" style={{ width: 34, height: 34, top: 8, background: SAMOVAR_BODY }} />
        <span className="absolute rounded-full" style={{ width: 8, height: 5, left: -3, top: 26, background: SAMOVAR_DARK }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-lg" style={{ width: 22, height: 10, top: 42, background: SAMOVAR_DARK }} />

        <span className="tea-stream-fall absolute rounded-full" style={{ width: 2, height: 0, left: -2, top: 30, background: TEA }} />
      </div>

      <div className="relative" style={{ width: 32, height: 30 }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-b-2xl border-2" style={{ width: 26, height: 18, bottom: 4, borderColor: CUP_TRIM, background: "var(--background)", overflow: "hidden" }}>
          <span className="tea-fill-rise absolute inset-x-0 bottom-0" style={{ height: 0, background: TEA }} />
        </span>
        <span className="absolute rounded-full border-2" style={{ width: 8, height: 9, right: -2, bottom: 8, borderColor: CUP_TRIM }} />
      </div>

      <div className="absolute left-2 top-4" style={{ width: 40, height: 40 }}>
        <span className="absolute rounded-full" style={{ width: "40%", aspectRatio: "1", top: "4%", left: "4%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "40%", aspectRatio: "1", top: "4%", right: "4%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "78%", aspectRatio: "1", top: "16%", background: FUR }}>
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "84%", height: "14%", top: "18%", background: HAT_TRIM, borderRadius: 9999 }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "78%", height: "32%", top: "-10%", background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "50%", height: "36%", top: "48%", background: MUZZLE }} />
          <span className="barista-wink absolute rounded-full" style={{ width: "10%", aspectRatio: "1", top: "40%", left: "26%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "10%", aspectRatio: "1", top: "40%", right: "26%", background: INK }} />
        </span>
      </div>
    </div>
  );
}
