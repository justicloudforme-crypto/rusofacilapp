// Deliberately not real brand marks (Visa/Mastercard/OXXO logos) — copying
// those inaccurately is a trademark/legal risk, and this repo has no
// licensed asset for them. Two generic monochrome glyphs (card, banknote)
// plus a text caption instead — decorative, not a claim of any specific
// brand's endorsement.
// `className` is a parameter and not a constant because these glyphs are
// drawn in two places with different jobs: here and in the OXXO steps they
// are quiet decoration next to text (the default `text-foreground/50`), and
// inside a payment-method tab they sit on a filled pill where the label is
// white — there they must inherit `currentColor` instead of carrying a fixed
// grey of their own, or the icon on the selected tab reads as disabled.
export function CardGlyph({ className = "h-5 w-5 text-foreground/50" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 9.5h19" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 14.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CashGlyph({ className = "h-5 w-5 text-foreground/50" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <rect x="2.5" y="6.5" width="19" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 9v0M18.5 15v0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function PaymentMethodLogos({
  note,
  cashAvailable,
}: {
  note: string;
  /** The banknote glyph is a claim about what we accept, same as the
   * caption beside it — outside Mexico there is no cash method to claim
   * (PROGRESS.md 7.117), so the glyph goes with the sentence. */
  cashAvailable: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex items-center gap-3">
        <CardGlyph />
        {cashAvailable && <CashGlyph />}
      </div>
      <p className="text-sm text-foreground/60">{note}</p>
    </div>
  );
}
