import MatryoshkaMark from "@/components/MatryoshkaMark";

/** RusoFácilapp's brand mark: the matryoshka glyph + full wordmark, shown
 * in a corner of every slide (web deck and PDF export) so a presentation
 * still reads as branded material even printed or downloaded on its own. */
export default function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const dims = size === "md" ? { badge: 26, text: "text-sm", pad: "px-3 py-1.5" } : { badge: 20, text: "text-xs", pad: "px-2 py-1" };

  return (
    <div
      className={`inline-flex flex-shrink-0 items-center gap-2 rounded-full bg-background/90 shadow-sm ring-1 ring-black/5 backdrop-blur dark:ring-white/10 ${dims.pad}`}
    >
      <MatryoshkaMark size={dims.badge} />
      <span className={`${dims.text} font-serif font-bold tracking-tight text-primary-text dark:text-primary-400`}>
        RusoFácilapp
      </span>
    </div>
  );
}
