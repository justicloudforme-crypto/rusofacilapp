/**
 * Renders the hand-written origin note for a classic story (see
 * src/lib/story-culture.ts). A plain server component: the text has to be
 * in the served HTML to be worth anything, both for a crawler and for a
 * reader who never scrolls past the paywall card.
 *
 * Deliberately placed ABOVE the paywall lock on the page: this is the one
 * part of a gated story page that is genuinely free, and burying it under
 * the "subscribe" card would hide the only substance an anonymous visitor
 * gets. It says nothing about the plot, so it costs the paywall nothing.
 */
export default function CulturalNote({ heading, text }: { heading: string; text: string }) {
  return (
    <section className="mt-10 rounded-2xl border border-black/10 bg-foreground/[0.03] p-5 dark:border-white/20 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
        {heading}
      </h2>
      <p className="mt-3 text-foreground/80">{text}</p>
    </section>
  );
}
