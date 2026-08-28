/** One Russian example with its Spanish translation, inline inside a
 * paragraph of a grammar guide. Every paragraph of every guide under
 * /es/gramatica carries at least one of these — an explicit rule for
 * these pages (owner's, 2026-08-28): a claim about Russian without a
 * Russian word next to it is exactly the kind of filler these pages are
 * meant not to be. Kept as a component rather than ad-hoc markup so the
 * three guides stay visually identical and the Cyrillic always gets
 * `lang="ru"` for screen readers and for Google's language detection. */
export default function RuExample({ ru, es }: { ru: string; es: string }) {
  return (
    // Deliberately no `whitespace-nowrap`: some examples are full
    // sentences, and holding those on one line overflows a 375px screen
    // (the mobile-first floor this project designs to).
    <span>
      <strong lang="ru" className="font-semibold">
        {ru}
      </strong>
      <span className="text-foreground/60"> — {es}</span>
    </span>
  );
}
