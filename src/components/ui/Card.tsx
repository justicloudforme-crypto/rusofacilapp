import type { HTMLAttributes, ReactNode } from "react";

export type CardPadding = "none" | "sm" | "md" | "lg";
export type CardTone = "neutral" | "primary" | "premium";

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

// Border/bg tint per tone — consolidates the ~15 hand-picked
// `rounded-2xl border ... shadow-[...]` one-offs found in the audit into
// one shared shadow token (--shadow-md, warm-tinted) instead of each file
// re-deriving its own rgba shadow.
const TONE_CLASSES: Record<CardTone, string> = {
  neutral: "border-black/10 bg-background dark:border-white/10",
  primary: "border-primary/15 bg-primary/[0.03]",
  premium: "border-premium-500/25 bg-premium-500/5",
};

export default function Card({
  tone = "neutral",
  padding = "md",
  shadow = false,
  className = "",
  children,
  ...rest
}: {
  tone?: CardTone;
  padding?: CardPadding;
  shadow?: boolean;
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        "rounded-2xl border",
        TONE_CLASSES[tone],
        PADDING_CLASSES[padding],
        shadow ? "shadow-md" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
