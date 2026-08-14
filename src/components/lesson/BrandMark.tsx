/** RusoFásil's brand mark: a sparkle glyph + full wordmark, shown in a
 * corner of every slide (web deck and PDF export) so a presentation still
 * reads as branded material even printed or downloaded on its own. No logo
 * image asset exists for this project, so the glyph is a small hand-drawn
 * vector (the same sparkle motif used on the "Bienvenida" slide
 * illustration, see src/lib/lessons/slideIcons.ts) rather than a photo. */
export default function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const dims = size === "md" ? { badge: 30, text: "text-sm", pad: "px-3 py-1.5" } : { badge: 22, text: "text-xs", pad: "px-2 py-1" };

  return (
    <div
      className={`inline-flex flex-shrink-0 items-center gap-2 rounded-full bg-background/90 shadow-sm ring-1 ring-black/5 backdrop-blur dark:ring-white/10 ${dims.pad}`}
    >
      <span
        className="flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-accent-light text-white"
        style={{ width: dims.badge, height: dims.badge }}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" width={dims.badge * 0.6} height={dims.badge * 0.6} fill="currentColor">
          <path d="M12 3 C13 8 15 10 21 12 C15 14 13 16 12 21 C11 16 9 14 3 12 C9 10 11 8 12 3 Z" />
        </svg>
      </span>
      <span
        className={`${dims.text} font-semibold tracking-tight bg-gradient-to-r from-brand to-brand-accent-light bg-clip-text text-transparent`}
      >
        RusoFásil
      </span>
    </div>
  );
}
