// Decorative Cyrillic letter used as a free, competitor-free brand motif
// (see CLAUDE.md's design-token rules — this is background texture, never
// placed over text). aria-hidden + select-none (screen-reader/SEO noise),
// and the section it sits in must keep overflow-hidden so a huge font-size
// glyph can never cause horizontal scroll on narrow viewports.
export default function CyrillicWatermark({
  letter,
  className = "",
}: {
  letter: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute select-none font-serif text-foreground/[0.05] ${className}`}
      style={{ fontSize: "clamp(10rem, 40vw, 24rem)", lineHeight: 1 }}
    >
      {letter}
    </span>
  );
}
