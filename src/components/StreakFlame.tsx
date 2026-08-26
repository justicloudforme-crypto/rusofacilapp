// Reusable streak indicator — a flame drawn with plain SVG paths (no
// icon library) using the flame-flicker keyframe already defined in
// globals.css for CelebrationModal's stove-fire scenario, plus the streak
// number. Used on the profile stat tile and inside WelcomeOverlay so both
// places share one visual, instead of profile's old bare 🔥 emoji.
export default function StreakFlame({
  days,
  size = 40,
  label,
}: {
  days: number;
  size?: number;
  label?: string;
}) {
  return (
    <span className="inline-flex flex-col items-center gap-1" role={label ? "img" : undefined} aria-label={label}>
      <span
        className="flame-flicker inline-block"
        style={{ width: size * 0.68, height: size }}
        aria-hidden
      >
        <svg viewBox="0 0 24 32" fill="none" width="100%" height="100%">
          <path
            d="M12 0C12 8 4 10 4 19a8 8 0 0016 0C20 12 15 11 15 6c0 4-3 5-3 8a3 3 0 01-3-3c0-4 3-5 3-11z"
            fill="#d63b2f"
          />
          <path
            d="M12 14c0 3-2 3.5-2 6.5a2.5 2.5 0 005 0c0-2-1.2-2-1.2-4.2"
            fill="#e0a934"
          />
        </svg>
      </span>
      <span className="font-serif text-2xl font-bold text-folk-red leading-none">{days}</span>
    </span>
  );
}
