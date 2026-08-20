"use client";

const ROOF = "#5c3b26";
const WALL = "#8a5a3a";
const WALL_LINE = "#6e4530";
const WINDOW_FRAME = "#e0a934";
const WINDOW_GLASS = "#2d5f8a";
const AXE_HANDLE = "#5c3b26";
const AXE_BLADE = "#c9c9c9";

/** One of CelebrationModal's randomized scenarios: a log-cabin izba with a
 * carved window and an axe leaning against it, plus a wisp of chimney
 * smoke (reusing the samovar's steam keyframe). Same plain-div/clip-path
 * technique as the rest of the celebration cast. */
export default function Izba() {
  const logLines = [16, 26, 36, 46, 56];
  return (
    <div className="cabin-pop-in relative flex h-24 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 90, height: 78 }}>
        <span className="steam-wisp absolute rounded-full bg-white" style={{ width: 3, height: 12, left: "70%", top: -8, opacity: 0.5 }} />
        <span className="absolute" style={{ left: "68%", top: 2, width: 8, height: 12, background: ROOF }} />
        <span className="absolute inset-x-0" style={{ top: 10, height: 20, background: ROOF, clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }} />
        <span className="absolute inset-x-1" style={{ top: 28, bottom: 0, background: WALL }}>
          {logLines.map((top, i) => (
            <span key={i} className="absolute inset-x-0" style={{ top, height: 2, background: WALL_LINE, opacity: 0.5 }} />
          ))}
          <span className="absolute left-1/2 -translate-x-1/2 rounded" style={{ width: 22, height: 20, top: 12, background: WINDOW_FRAME }}>
            <span className="absolute inset-1" style={{ background: WINDOW_GLASS }} />
          </span>
        </span>
        <span className="absolute" style={{ left: -6, bottom: 0, width: 4, height: 40, background: AXE_HANDLE, transform: "rotate(18deg)", transformOrigin: "bottom" }} />
        <span className="absolute rounded-sm" style={{ left: -14, bottom: 32, width: 12, height: 8, background: AXE_BLADE, transform: "rotate(18deg)" }} />
      </div>
    </div>
  );
}
