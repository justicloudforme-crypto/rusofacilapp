"use client";

import { useState } from "react";

const SNOW_COUNT = 12;
const FUR = "#f2ede3";
const FUR_SHADE = "#d8d0c2";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const NOSE = "#d63b2f";

interface Snowflake {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
}

function makeSnowflakes(): Snowflake[] {
  return Array.from({ length: SNOW_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2.4 + Math.random() * 1.8,
    size: 10 + Math.random() * 8,
  }));
}

/** One of CelebrationModal's randomized scenarios: falling snowflakes (a
 * Unicode glyph, not an icon asset — free) and a rabbit in an ushanka
 * hopping in. Same plain-div technique as the rest of the celebration
 * cast. */
export default function Winter() {
  const [flakes] = useState(makeSnowflakes);
  return (
    <div className="relative h-24 w-full max-w-[220px] overflow-hidden" aria-hidden="true">
      {flakes.map((f) => (
        <span
          key={f.id}
          className="snowflake-piece select-none text-white"
          style={{
            left: `${f.left}%`,
            fontSize: f.size,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.duration}s`,
          }}
        >
          ❄
        </span>
      ))}

      <div className="rabbit-hop-in absolute bottom-0 left-1/2 -translate-x-1/2" style={{ width: 60, height: 64 }}>
        <span className="absolute rounded-full" style={{ width: 10, height: 26, left: 10, top: -18, background: FUR, transform: "rotate(-8deg)" }} />
        <span className="absolute rounded-full" style={{ width: 10, height: 26, right: 10, top: -18, background: FUR, transform: "rotate(8deg)" }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 16, left: 13, top: -14, background: FUR_SHADE, transform: "rotate(-8deg)" }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 16, right: 13, top: -14, background: FUR_SHADE, transform: "rotate(8deg)" }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 40, height: 40, top: 0, background: FUR }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 8, top: 2, background: HAT_TRIM }} />
          <span className="absolute rounded-full" style={{ width: 4, height: 4, top: 18, left: 11, background: INK }} />
          <span className="absolute rounded-full" style={{ width: 4, height: 4, top: 18, right: 11, background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 6, height: 5, top: 24, background: NOSE }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 28, bottom: 0, background: FUR }} />
      </div>
    </div>
  );
}
