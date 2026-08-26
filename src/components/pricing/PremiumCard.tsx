import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

// Gold stays on decorative elements only (border/badge) — the button
// itself is primary, same as every other CTA on the page, per the
// premium-is-never-clickable rule (enforced by check:tokens).
export default function PremiumCard({
  lang,
  name,
  price,
  period,
  badge,
  valueNote,
  cardCta,
  featuresTitle,
  features,
}: {
  lang: string;
  name: string;
  price: string;
  period: string;
  badge?: string;
  valueNote: string;
  cardCta: string;
  featuresTitle: string;
  features: string[];
}) {
  return (
    <Card tone="premium" padding="lg" shadow className="relative flex h-full flex-col">
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-premium-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
          <span aria-hidden>👑 </span>
          {badge}
        </span>
      )}
      <h2 className="text-lg font-medium">{name}</h2>

      <p className="mt-4 flex items-baseline gap-1">
        <span className="whitespace-nowrap text-3xl font-semibold tracking-tight">{price}</span>
        <span className="text-sm text-foreground/60">{period}</span>
      </p>
      <p className="mt-1.5 text-xs text-premium-700 dark:text-premium-300">{valueNote}</p>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-foreground/50">{featuresTitle}</p>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-foreground/70">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span aria-hidden>✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <form action="/api/checkout" method="POST" className="mt-auto pt-8">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="plan" value="lifetime" />
        <input type="hidden" name="method" value="card" />
        <Button type="submit" variant="primary" fullWidth haptic={false}>
          {cardCta}
        </Button>
      </form>
    </Card>
  );
}
