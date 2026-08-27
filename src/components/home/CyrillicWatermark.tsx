// Decorative Cyrillic letter used as a free, competitor-free brand motif
// (see CLAUDE.md's design-token rules — this is background texture, never
// placed over text). aria-hidden + select-none (screen-reader/SEO noise),
// pointer-events-none (never a tap target), and the section it sits in must
// keep overflow-hidden so a huge font-size glyph can never cause horizontal
// scroll on narrow viewports.
//
// Hidden below `sm`: even at 5% opacity the glyph visibly bled onto the
// hero badge/heading on a real phone (confirmed 2026-08-27 — a narrow
// viewport gives the `clamp(10rem, 40vw, 24rem)` floor far less room to sit
// clear of the text than on desktop, and it gets worse with a larger OS
// font-scale setting, since the floor is in `rem`). There's no good
// placement for a glyph this large on a 375px-wide screen, so it simply
// doesn't render there rather than risk overlapping content again.
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
      className={`pointer-events-none absolute hidden select-none font-serif text-foreground/[0.05] sm:inline ${className}`}
      style={{ fontSize: "clamp(10rem, 40vw, 24rem)", lineHeight: 1 }}
    >
      {letter}
    </span>
  );
}
