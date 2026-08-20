"use client";

const SNOW = "#f2ede3";
const SNOW_SHADE = "#d8d0c2";
const COAL = "#241c15";
const CARROT = "#e0a934";
const BALALAIKA_BODY = "#e0a934";
const BALALAIKA_NECK = "#5c3b26";
const DISCO_COLORS = ["#d63b2f", "#2d5f8a", "#e0a934", "#4a7a3a"];

// Story beats:
//   Loop (0–1.4s, `disco-light-blink`, staggered ×4): four little colored
//     dots orbiting the snowman blink on/off out of sync — a cardboard-box
//     disco, not an actual light rig.
//   Loop (0–0.5s, `snowman-groove`): the whole stack sways side to side —
//     a snowman has no hips, so the "dancing" is really just the three
//     balls rocking together.
//   Loop (falling snow, `snowflake-fall`, reused from CelebrationWinter):
//     doubles as festive confetti here.
/** EVERYDAY-tier win scenario: the CelebrationWinter rabbit's snowman
 * cousin throws an impromptu disco — reuses the falling-snow keyframe from
 * catalog/seasons/Winter.tsx and the balalaika shape vocabulary. */
export default function SnowmanDisco() {
  const lights = [
    { top: 4, left: 4, delay: "0s" },
    { top: 4, right: 4, delay: "0.35s" },
    { top: 40, left: -6, delay: "0.7s" },
    { top: 40, right: -6, delay: "1.05s" },
  ] as const;
  return (
    <div className="relative h-28 w-full max-w-[200px] overflow-hidden" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          className="snowflake-piece select-none text-white"
          style={{ left: `${i * 13}%`, fontSize: 10 + (i % 3) * 3, animationDelay: `${i * 0.25}s`, animationDuration: `${2.4 + (i % 3) * 0.4}s` }}
        >
          ❄
        </span>
      ))}

      <div className="snowman-groove absolute bottom-0 left-1/2 -translate-x-1/2" style={{ width: 70, height: 84 }}>
        {lights.map((l, i) => (
          <span
            key={i}
            className="disco-light-blink absolute rounded-full"
            style={{ width: 8, height: 8, top: l.top, left: "left" in l ? l.left : undefined, right: "right" in l ? l.right : undefined, background: DISCO_COLORS[i], animationDelay: l.delay }}
          />
        ))}
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 62, height: 62, bottom: 0, background: SNOW }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 44, height: 44, bottom: 46, background: SNOW }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 30, height: 30, bottom: 78, background: SNOW }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 5, bottom: 96, left: "42%", background: COAL }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 5, bottom: 96, left: "54%", background: COAL }} />
        <span className="absolute" style={{ bottom: 90, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "4px 6px 4px 0", borderColor: `transparent ${CARROT} transparent transparent` }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 60, left: "38%", background: COAL, opacity: 0.7 }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 48, left: "38%", background: COAL, opacity: 0.7 }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 36, left: "38%", background: COAL, opacity: 0.7 }} />

        <span className="absolute" style={{ width: 30, height: 30, bottom: 30, right: -14, transformOrigin: "80% 100%" }}>
          <span className="absolute inset-0" style={{ background: BALALAIKA_BODY, clipPath: "polygon(50% 0%, 8% 100%, 92% 100%)" }} />
          <span className="absolute" style={{ width: "16%", height: "60%", left: "43%", bottom: "62%", background: BALALAIKA_NECK }} />
        </span>
        <span className="absolute" style={{ width: 3, height: 18, bottom: 30, right: 8, background: SNOW_SHADE, borderRadius: 9999, transform: "rotate(24deg)" }} />
      </div>
    </div>
  );
}
