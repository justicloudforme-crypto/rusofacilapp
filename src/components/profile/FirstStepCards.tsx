import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { ReactNode } from "react";

export interface FirstStepItem {
  key: string;
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  cta: string;
}

// Replaces the profile page's "wall of zeros" for a user with no (or very
// little) progress yet — AUDIT-adjacent finding from the 2026-08-26 review:
// nine 0s/0%s on first login reads as a failure screen, not a welcome.
// Used both for the fully-empty state ("Твой первый шаг") and the
// early-progress "Что дальше" state, just with a different heading/item set.
export default function FirstStepCards({
  heading,
  items,
}: {
  heading: string;
  items: FirstStepItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="font-serif text-lg font-semibold text-foreground">{heading}</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <Card key={item.key} tone="primary" className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-text">
                {item.icon}
              </span>
              <h3 className="font-medium">{item.title}</h3>
            </div>
            <p className="text-sm text-foreground/60">{item.description}</p>
            <Button href={item.href} size="sm" className="mt-auto">
              {item.cta}
            </Button>
          </Card>
        ))}
      </div>
    </section>
  );
}
