// Deliberately not real brand marks (Visa/Mastercard/OXXO logos) — copying
// those inaccurately is a trademark/legal risk, and this repo has no
// licensed asset for them. Two generic monochrome glyphs (card, banknote)
// plus a text caption instead — decorative, not a claim of any specific
// brand's endorsement.
function CardGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-foreground/50" aria-hidden fill="none">
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 9.5h19" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 14.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CashGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-foreground/50" aria-hidden fill="none">
      <rect x="2.5" y="6.5" width="19" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 9v0M18.5 15v0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function PaymentMethodLogos({ note }: { note: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex items-center gap-3">
        <CardGlyph />
        <CashGlyph />
      </div>
      <p className="text-sm text-foreground/60">{note}</p>
    </div>
  );
}
