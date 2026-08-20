"use client";

const WOOD = "#5c3b26";
const BELLOWS_LIGHT = "#e0a934";
const BELLOWS_DARK = "#c9962e";
const BUTTON = "#241c15";

/** One of CelebrationModal's randomized scenarios: a garmoshka (button
 * accordion) whose bellows squeeze in and out. Same plain-div technique as
 * the rest of the celebration cast — the bellows "pleats" are just
 * alternating-color stripes, no image/SVG. */
export default function Accordion() {
  const pleats = Array.from({ length: 6 }, (_, i) => i);
  return (
    <div className="relative flex h-24 items-center justify-center" aria-hidden="true">
      <div className="accordion-squeeze flex items-stretch" style={{ height: 52 }}>
        <span className="rounded-l-lg" style={{ width: 16, background: WOOD }} />
        <span className="flex items-stretch overflow-hidden">
          {pleats.map((i) => (
            <span
              key={i}
              style={{ width: 6, background: i % 2 === 0 ? BELLOWS_LIGHT : BELLOWS_DARK }}
            />
          ))}
        </span>
        <span className="relative rounded-r-lg" style={{ width: 20, background: WOOD }}>
          <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 6, left: 5, background: BUTTON }} />
          <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 16, left: 9, background: BUTTON }} />
          <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 26, left: 5, background: BUTTON }} />
          <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 36, left: 9, background: BUTTON }} />
        </span>
      </div>
    </div>
  );
}
