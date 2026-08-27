import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

// Free-tier column — added so the page doesn't open straight into "pay us"
// without first showing what a visitor already has without paying. Exact
// contents come from FREEMIUM.md / src/lib/entitlement.ts (single source
// of truth for the three-tier model), not invented here.
export default function FreeTierCard({
  heading,
  description,
  features,
  cta,
  href,
  featuresTitle,
}: {
  heading: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  featuresTitle: string;
}) {
  return (
    <Card padding="lg" className="flex h-full flex-col">
      <h2 className="text-lg font-medium">{heading}</h2>
      <p className="mt-1 text-sm text-foreground/60">{description}</p>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-foreground/50">{featuresTitle}</p>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-foreground/70">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span aria-hidden>✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        <Button href={href} variant="outline" fullWidth>
          {cta}
        </Button>
      </div>
    </Card>
  );
}
