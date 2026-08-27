export interface FaqItem {
  q: string;
  a: string;
}

// Independent <details> per question (unlike SettingsAccordion, which
// deliberately keeps only one section open at a time) — a FAQ is read by
// scanning multiple answers at once, not by focusing on exactly one
// setting, so there's no reason to close one when another opens.
export default function PricingFaq({ heading, items }: { heading: string; items: FaqItem[] }) {
  return (
    <section>
      <h2 className="font-serif text-xl font-semibold text-foreground">{heading}</h2>
      <div className="mt-4 flex flex-col divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/10 dark:border-white/30">
        {items.map((item) => (
          <details key={item.q} className="group p-5">
            <summary className="tap flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <span className="font-medium">{item.q}</span>
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="h-5 w-5 flex-shrink-0 text-foreground/40 transition-transform group-open:rotate-180"
              >
                <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <p className="mt-3 text-sm text-foreground/70">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
