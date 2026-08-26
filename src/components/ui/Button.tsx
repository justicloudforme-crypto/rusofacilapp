"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { hapticTap } from "@/lib/haptics";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

// premium (gold) is deliberately NOT a variant here — it's a non-clickable
// value marker only (crown badge, Premium plan card, award badges), never a
// button. Enforced by `npm run check:tokens`'s premium-on-clickable guard.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover active:bg-primary-hover",
  secondary:
    "border border-primary/30 text-primary-text hover:bg-primary/10 active:bg-primary/10 dark:border-primary-400/40 dark:text-primary-400",
  // Neutral bordered button — a plain secondary action that shouldn't read
  // as "the other primary-colored choice" (e.g. OXXO cash payment next to
  // a primary card-payment CTA).
  outline:
    "border border-black/10 text-foreground/80 hover:bg-foreground/5 active:bg-foreground/5 dark:border-white/10",
  ghost: "text-foreground/70 hover:bg-neutral-200/60 active:bg-neutral-200/60 dark:hover:bg-neutral-700/40",
  danger: "bg-danger text-white hover:bg-danger-strong active:bg-danger-strong",
};

// All three sizes stay >=44px tall (min-h-11 = 2.75rem = 44px) — the
// mobile-first rule in CLAUDE.md applies even to the "small" size; only
// horizontal padding/font-size shrink.
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-4 text-sm gap-1.5",
  md: "min-h-11 px-5 text-sm gap-2",
  lg: "min-h-12 px-6 text-base gap-2",
};

const BASE_CLASSES =
  "tap inline-flex items-center justify-center rounded-full font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:pointer-events-none disabled:opacity-50";

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
  /** Fires hapticTap() on press in addition to any onClick — set false to opt out (e.g. a submit button whose own handler already does haptics). */
  haptic?: boolean;
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
    /** Disables the button, swaps the icon slot for a spinner, sets aria-busy. Button-only — a <Link> can't be "in flight". */
    loading?: boolean;
  };

type ButtonAsLink = CommonProps &
  Omit<ComponentProps<typeof Link>, "className" | "children"> & { href: ComponentProps<typeof Link>["href"] };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function classes({
  variant = "primary",
  size = "md",
  fullWidth,
  className = "",
}: Pick<CommonProps, "variant" | "size" | "fullWidth" | "className">) {
  return [BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], fullWidth ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");
}

export default function Button(props: ButtonProps) {
  const { variant, size, fullWidth, icon, children, className, haptic = true, ...rest } = props;
  const cls = classes({ variant, size, fullWidth, className });

  if ("href" in props && props.href !== undefined) {
    const { href, onClick, ...linkRest } = rest as Omit<ButtonAsLink, keyof CommonProps>;
    return (
      <Link
        href={href}
        className={cls}
        onClick={(e) => {
          if (haptic) hapticTap();
          onClick?.(e);
        }}
        {...linkRest}
      >
        {icon}
        {children}
      </Link>
    );
  }

  const { loading, ...buttonRest } = rest as Omit<ButtonAsButton, keyof CommonProps>;
  return (
    <button
      className={cls}
      aria-busy={loading || undefined}
      disabled={loading || buttonRest.disabled}
      onClick={(e) => {
        if (haptic) hapticTap();
        buttonRest.onClick?.(e);
      }}
      {...buttonRest}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
