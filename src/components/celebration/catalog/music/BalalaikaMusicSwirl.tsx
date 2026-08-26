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
const NOTES = ["♪", "♫", "♬"];

// Story beats:
//   Loop (0–0.35s, `balalaika-shred` reused from BalalaikaRockStar.tsx):
//     the fastest strum in the catalog, played virtuoso-fast.
//   Loop (0–3.2s, `carousel-spin` reused from KaruselIceSpin.tsx, on a
//     ring of three notes): each note sits at its own fixed 120° angle
//     (a static rotate wrapper) while the ring itself carries the only
//     animated rotate — the same three-level split KaruselIceSpin.tsx and
//     MatryoshkaDizzySpin.tsx use whenever a fixed angle and a continuous
//     spin need to share a scene — reading as a musical whirlwind
//     circling him rather than notes just floating up.
/** EVERYDAY-tier win scenario: a bear playing balalaika so well a
 * whirlwind of notes forms around him. Reuses balalaika-shred and
 * carousel-spin wholesale — no new keyframes needed. */
export default function BalalaikaMusicSwirl() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="carousel-spin absolute" style={{ width: 4, height: 4, left: "50%", top: "38%" }}>
        {NOTES.map((note, i) => (
          <span key={note + i} className="absolute" style={{ width: 0, height: 0, transform: `rotate(${i * 120}deg)` }}>
            <span className="absolute select-none text-base font-bold" style={{ top: -46, left: -6, color: i % 2 === 0 ? "var(--color-folk-red)" : "var(--color-primary)" }}>
              {note}
            </span>
          </span>
        ))}
      </div>

      <div className="bear-bounce relative" style={{ width: 66, height: 66 }}>
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

        <span className="balalaika-shred absolute" style={{ width: "40%", height: "40%", bottom: "6%", right: "-6%", transformOrigin: "80% 100%" }}>
          <span className="absolute inset-0" style={{ background: BALALAIKA_BODY, clipPath: "polygon(50% 0%, 8% 100%, 92% 100%)" }} />
          <span className="absolute rounded-full" style={{ width: "20%", aspectRatio: "1", left: "40%", bottom: "126%", background: FUR_DARK }} />
          <span className="absolute" style={{ width: "14%", height: "68%", left: "43%", bottom: "66%", background: BALALAIKA_NECK }} />
          <span className="absolute" style={{ width: "2px", height: "48%", left: "36%", bottom: "22%", background: STRING, opacity: 0.8 }} />
          <span className="absolute" style={{ width: "2px", height: "48%", left: "50%", bottom: "22%", background: STRING, opacity: 0.8 }} />
          <span className="absolute" style={{ width: "2px", height: "48%", left: "64%", bottom: "22%", background: STRING, opacity: 0.8 }} />
        </span>
      </div>
    </div>
  );
}
