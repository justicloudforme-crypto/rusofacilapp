export type ProgressBarTone = "primary" | "success" | "neutral";

export interface ProgressBarSegment {
  percent: number;
  tone?: ProgressBarTone;
  /** Escape hatch for a one-off fill class the tone presets don't cover. */
  className?: string;
}

const TONE_FILL: Record<ProgressBarTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  neutral: "bg-neutral-500",
};

/**
 * Display-only progress indicator — consolidates the 8 independent
 * width-percentage-div implementations found across GlossaryProgress,
 * CategoryGrid, LevelGlossaryProgressBar, IdiomsList, and profile/page.tsx
 * (see AUDIT.md §3). NOT for scrubbers/seek controls (StoryAudioPlayer's
 * audio-position bar stays its own component — it overlays a real
 * `<input type="range">` for native drag/keyboard seek, which this
 * component doesn't provide).
 */
export default function ProgressBar({
  percent,
  tone = "primary",
  segments,
  size = "sm",
  className = "",
  ariaLabel,
}: {
  /** Shorthand for a single segment. */
  percent?: number;
  /** Tone for the shorthand `percent` segment (ignored when `segments` is passed). */
  tone?: ProgressBarTone;
  /** Multiple stacked segments, e.g. "seen" (primary) under "mastered" (success) — see GlossaryProgress. */
  segments?: ProgressBarSegment[];
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}) {
  const resolved = segments ?? [{ percent: percent ?? 0, tone }];
  const height = size === "md" ? "h-2" : "h-1.5";
  const clamped = (p: number) => Math.min(100, Math.max(0, p));

  return (
    <div
      role={segments ? undefined : "progressbar"}
      aria-valuenow={segments ? undefined : clamped(percent ?? 0)}
      aria-valuemin={segments ? undefined : 0}
      aria-valuemax={segments ? undefined : 100}
      aria-label={ariaLabel}
      className={`relative ${height} overflow-hidden rounded-full bg-black/10 dark:bg-white/10 ${className}`}
    >
      {resolved.map((seg, i) => (
        <div
          key={i}
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ${
            seg.className ?? TONE_FILL[seg.tone ?? "primary"]
          }`}
          style={{ width: `${clamped(seg.percent)}%` }}
        />
      ))}
    </div>
  );
}
